// SR GA Support — Apps Script Backend
// Deploy as: Web App → Execute as Me → Anyone with Google Account

const SHEET_ID    = "YOUR_SHEET_ID_HERE";
const API_SECRET  = "ga-secret-2026";
const SLACK_BOT_TOKEN = ""; // optional, for DM notifications

// ─── CORS RESPONSE ────────────────────────────────────────────────────────────
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── AUTH CHECK ───────────────────────────────────────────────────────────────
function checkSecret(secret) {
  return secret === API_SECRET;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
function doGet(e) {
  const { action, secret } = e.parameter;
  if (!checkSecret(secret)) return corsResponse({ ok:false, error:"Unauthorized" });

  const ss = SpreadsheetApp.openById(SHEET_ID);

  if (action === "get_requests") {
    const sheet = ss.getSheetByName("REQUESTS") || ss.insertSheet("REQUESTS");
    const data  = sheetToObjects(sheet);
    return corsResponse({ ok:true, data });
  }

  if (action === "get_quotas") {
    const sheet = ss.getSheetByName("QUOTAS") || ss.insertSheet("QUOTAS");
    const data  = sheetToObjects(sheet);
    const quotas = data.length > 0 ? JSON.parse(data[0].value || "{}") : {};
    return corsResponse({ ok:true, data: quotas });
  }

  if (action === "get_roster") {
    const sheet = ss.getSheetByName("ROSTER") || ss.insertSheet("ROSTER");
    const data  = sheetToObjects(sheet);
    return corsResponse({ ok:true, data });
  }

  return corsResponse({ ok:false, error:"Unknown action" });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
function doPost(e) {
  const body   = JSON.parse(e.postData.contents);
  const secret = body.secret;
  if (!checkSecret(secret)) return corsResponse({ ok:false, error:"Unauthorized" });

  const ss = SpreadsheetApp.openById(SHEET_ID);

  // ── save_request ──────────────────────────────────────────────────────────
  if (body.action === "save_request") {
    const sheet = getOrCreateSheet(ss, "REQUESTS", [
      "id","type","category","title","applicantEmail","applicantId",
      "status","currentStep","submittedAt","notes","destination",
      "startDate","endDate","subType","amount","asset","items",
      "attachments","approvalHistory"
    ]);
    const req = body.data;
    const headers = sheetHeaders(sheet);
    sheet.appendRow(headers.map(h => {
      const v = req[h];
      if (Array.isArray(v)) return JSON.stringify(v);
      return v !== undefined ? v : "";
    }));

    // Slack notification
    sendSlackNotification(ss, req);

    return corsResponse({ ok:true });
  }

  // ── update_request ────────────────────────────────────────────────────────
  if (body.action === "update_request") {
    const sheet = ss.getSheetByName("REQUESTS");
    if (!sheet) return corsResponse({ ok:false, error:"REQUESTS sheet not found" });

    const headers = sheetHeaders(sheet);
    const idCol   = headers.indexOf("id") + 1;
    const data    = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol-1]) !== String(body.id)) continue;

      const row    = i + 1;
      const setCol = (key, val) => {
        const c = headers.indexOf(key) + 1;
        if (c > 0) sheet.getRange(row, c).setValue(val);
      };

      const decision = body.decision;

      if (decision === "approve") {
        const chainRaw = data[i][headers.indexOf("approvalChain")] || "[]";
        // Determine new step and status from currentStep
        const curStep = Number(data[i][headers.indexOf("currentStep")]) || 0;
        const nextStep = curStep + 1;

        // Read chain from quotas to determine length
        const quotasSheet = ss.getSheetByName("QUOTAS");
        const quotasData  = quotasSheet ? sheetToObjects(quotasSheet) : [];
        const quotas      = quotasData.length > 0 ? JSON.parse(quotasData[0].value || "{}") : {};
        const type        = data[i][headers.indexOf("type")];
        const defaultChains = getDefaultChains();
        const chain = (quotas.approvalChains && quotas.approvalChains[type]) || defaultChains[type] || ["assignee"];

        const isLast = nextStep >= chain.length;
        setCol("currentStep", nextStep);
        setCol("status", isLast ? "completed" : "in_progress");

        // Append to approval history
        const histIdx = headers.indexOf("approvalHistory");
        const existing = histIdx >= 0 ? (data[i][histIdx] || "[]") : "[]";
        let hist = [];
        try { hist = JSON.parse(existing); } catch {}
        hist.push({ step: curStep, role: body.role, decision:"approved", comment: body.comment||"", ts: new Date().toISOString() });
        if (histIdx >= 0) sheet.getRange(row, histIdx+1).setValue(JSON.stringify(hist));

        // Notify next approver or applicant
        sendApprovalSlack(ss, data[i], headers, "approved", body.comment, isLast);
      }

      if (decision === "reject") {
        setCol("status", "rejected");
        const histIdx = headers.indexOf("approvalHistory");
        const existing = histIdx >= 0 ? (data[i][histIdx] || "[]") : "[]";
        let hist = [];
        try { hist = JSON.parse(existing); } catch {}
        hist.push({ step: body.step, role: body.role, decision:"rejected", comment: body.comment||"", ts: new Date().toISOString() });
        if (histIdx >= 0) sheet.getRange(row, histIdx+1).setValue(JSON.stringify(hist));
        sendApprovalSlack(ss, data[i], headers, "rejected", body.comment, false);
      }

      if (decision === "cancel") {
        setCol("status", "cancelled");
      }

      return corsResponse({ ok:true });
    }
    return corsResponse({ ok:false, error:"Request not found" });
  }

  // ── save_quotas ───────────────────────────────────────────────────────────
  if (body.action === "save_quotas") {
    const sheet = getOrCreateSheet(ss, "QUOTAS", ["key","value"]);
    const data  = sheet.getDataRange().getValues();
    // Find or create row with key="config"
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === "config") {
        sheet.getRange(i+1, 2).setValue(JSON.stringify(body.data));
        return corsResponse({ ok:true });
      }
    }
    sheet.appendRow(["config", JSON.stringify(body.data)]);
    return corsResponse({ ok:true });
  }

  return corsResponse({ ok:false, error:"Unknown action" });
}

// ─── SLACK NOTIFICATIONS ──────────────────────────────────────────────────────
function sendSlackNotification(ss, req) {
  try {
    const quotas = getQuotas(ss);
    const webhook = quotas.slackWebhook;
    if (!webhook) return;

    const appUrl = quotas.appUrl || "";
    const typeLabels = {
      business_card:"Business Card", onboarding_item:"Onboarding Items",
      onboarding_account:"Onboarding Account", offboarding_item:"Offboarding Item Return",
      offboarding_account:"Offboarding Account", corporate_card:"Corporate Card",
      domestic_trip:"Domestic Trip", overseas_trip:"Overseas Trip",
      asset_breakdown:"Asset Breakdown", facility_breakdown:"Facility Breakdown",
      it_breakdown:"IT Breakdown", item_breakdown:"Item Breakdown",
      car_rental:"Company Car Rental", rnd_item:"R&D Item", equipment_rental:"Equipment Rental",
    };

    const typeLabel = typeLabels[req.type] || req.type;
    const deepLink  = appUrl ? `${appUrl}?new=0` : "";

    const payload = {
      text: `📋 *New GA Request* — ${typeLabel}`,
      blocks: [
        {
          type: "section",
          text: { type:"mrkdwn", text:`📋 *New GA Support Request*\n*Type:* ${typeLabel}\n*From:* ${req.applicantEmail}\n*Title:* ${req.title}` }
        },
        {
          type: "actions",
          elements: deepLink ? [{
            type: "button", style: "primary",
            text: { type:"plain_text", text:"View & Approve" },
            url: deepLink,
          }] : [],
        }
      ]
    };

    UrlFetchApp.fetch(webhook, {
      method:"post", contentType:"application/json",
      payload: JSON.stringify(payload), muteHttpExceptions: true,
    });
  } catch(e) {
    Logger.log("Slack notification failed: " + e.message);
  }
}

function sendApprovalSlack(ss, rowData, headers, decision, comment, isCompleted) {
  try {
    const quotas  = getQuotas(ss);
    const webhook = quotas.slackWebhook;
    if (!webhook) return;

    const appUrl       = quotas.appUrl || "";
    const applicantEmail = rowData[headers.indexOf("applicantEmail")] || "";
    const title        = rowData[headers.indexOf("title")] || "";
    const icon         = decision === "approved" ? (isCompleted ? "✅" : "⏩") : "❌";
    const statusText   = decision === "approved" ? (isCompleted ? "Completed" : "Approved — moving to next step") : "Rejected";

    const payload = {
      text: `${icon} *Request Update* — ${title}`,
      blocks: [
        {
          type:"section",
          text:{ type:"mrkdwn", text:`${icon} *Request Update*\n*Title:* ${title}\n*Status:* ${statusText}${comment?`\n*Comment:* ${comment}`:""}` }
        },
        ...(appUrl ? [{
          type:"actions",
          elements:[{ type:"button", text:{ type:"plain_text", text:"Open App" }, url:appUrl }]
        }] : [])
      ]
    };

    UrlFetchApp.fetch(webhook, {
      method:"post", contentType:"application/json",
      payload:JSON.stringify(payload), muteHttpExceptions:true,
    });
  } catch(e) {
    Logger.log("Approval slack failed: " + e.message);
  }
}

// ─── SLACK BOT (separate deployment or same script) ──────────────────────────
// Handle Slack slash command /ga or interactive button
function handleSlackCommand(e) {
  const quotas = getQuotas(SpreadsheetApp.openById(SHEET_ID));
  const appUrl = quotas.appUrl || "https://sr-ga-support.vercel.app";

  const text = e.parameter.text || "";
  const responseUrl = e.parameter.response_url;

  const categories = [
    { label:"📋 General Request", url:`${appUrl}?cat=general&new=1` },
    { label:"✈️ Business Travel",  url:`${appUrl}?cat=travel&new=1`   },
    { label:"🔧 Breakdown Report", url:`${appUrl}?cat=breakdown&new=1` },
    { label:"📦 Rental Request",   url:`${appUrl}?cat=rental&new=1`   },
  ];

  const payload = {
    response_type: "ephemeral",
    text: "🏢 *GA Support* — Choose a category:",
    blocks: [
      { type:"section", text:{ type:"mrkdwn", text:"🏢 *GA Support* — Select what you need:" } },
      {
        type:"actions",
        elements: categories.map(c => ({
          type:"button",
          text:{ type:"plain_text", text:c.label },
          url: c.url,
        }))
      }
    ]
  };

  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
  }
  return sheet;
}

function sheetHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function getQuotas(ss) {
  try {
    const sheet = ss.getSheetByName("QUOTAS");
    if (!sheet) return {};
    const data = sheetToObjects(sheet);
    const row  = data.find(r => r.key === "config");
    return row ? JSON.parse(row.value || "{}") : {};
  } catch { return {}; }
}

function getDefaultChains() {
  return {
    business_card:       ["assignee"],
    onboarding_item:     ["assignee"],
    onboarding_account:  ["assignee"],
    offboarding_item:    ["assignee"],
    offboarding_account: ["assignee"],
    corporate_card:      ["manager","ceo","assignee"],
    domestic_trip:       ["manager","assignee"],
    overseas_trip:       ["manager","ceo","assignee"],
    asset_breakdown:     ["assignee"],
    facility_breakdown:  ["assignee"],
    it_breakdown:        ["assignee"],
    item_breakdown:      ["assignee"],
    car_rental:          ["assignee"],
    rnd_item:            ["assignee"],
    equipment_rental:    ["assignee"],
  };
}
