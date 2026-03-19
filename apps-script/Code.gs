// SR GA Support — Apps Script Backend
// Deploy as: Web App → Execute as Me → Anyone with Google Account

const SHEET_ID = "181lU70DSUlLB_6y8e71vjr7slAEMQLPElma5k7RXOLo";

// ─── FILE UPLOAD SECURITY ─────────────────────────────────────────────────────
var ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv"
];
// 10MB in base64 length (10 * 1024 * 1024 * 4/3 ≈ 13,981,013)
var MAX_BASE64_LENGTH = 13981013;

// ─── CORS RESPONSE ────────────────────────────────────────────────────────────
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── TOKEN VERIFICATION ───────────────────────────────────────────────────────
// 토큰 설정 방법: GAS 에디터 → 프로젝트 설정 → 스크립트 속성 → API_TOKEN 추가
// 값이 비어있으면 검증 건너뜀 (하위 호환 — 배포 초기 마이그레이션용)
function verifyToken(e) {
  var stored = PropertiesService.getScriptProperties().getProperty("API_TOKEN") || "";
  if (!stored) return true;
  // GET: token in URL param / POST: token in JSON body (parsed separately)
  var provided = (e.parameter && e.parameter.token) || "";
  if (!provided && e.postData) {
    try { provided = JSON.parse(e.postData.contents).token || ""; } catch {}
  }
  return provided === stored;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
function doGet(e) {
  if (!verifyToken(e)) {
    Logger.log("doGet: Unauthorized — invalid or missing token from " + (e.parameter && e.parameter.action));
    return corsResponse({ ok: false, error: "Unauthorized" });
  }
  const { action } = e.parameter;
  const ss = SpreadsheetApp.openById(SHEET_ID);

  if (action === "get_requests") {
    const sheet = ss.getSheetByName("REQUESTS") || ss.insertSheet("REQUESTS");
    return corsResponse({ ok:true, data: sheetToObjects(sheet) });
  }
  if (action === "get_quotas") {
    const sheet = ss.getSheetByName("QUOTAS") || ss.insertSheet("QUOTAS");
    const data  = sheetToObjects(sheet);
    const row   = data.find(r => r.key === "config");
    const quotas = row ? JSON.parse(row.value || "{}") : {};
    return corsResponse({ ok:true, data: quotas });
  }
  if (action === "get_roster") {
    const sheet = ss.getSheetByName("ROSTER") || ss.insertSheet("ROSTER");
    return corsResponse({ ok:true, data: sheetToObjects(sheet) });
  }
  return corsResponse({ ok:false, error:"Unknown action" });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
function doPost(e) {
  // [FIX ①] doPost 토큰 검증 — doGet과 동일하게 API_TOKEN 체크
  if (!verifyToken(e)) {
    Logger.log("doPost: Unauthorized — invalid or missing token, action=" + (e.postData ? "body" : "none"));
    return corsResponse({ ok: false, error: "Unauthorized" });
  }

  // [FIX ②] JSON 파싱 오류 방어 — malformed 요청이 500 대신 400 반환
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (ex) {
    Logger.log("doPost: JSON parse error — " + ex.message);
    return corsResponse({ ok: false, error: "Bad request: invalid JSON" });
  }

  const ss   = SpreadsheetApp.openById(SHEET_ID);

  if (body.action === "save_request") {
    const sheet = getOrCreateSheet(ss, "REQUESTS", [
      "id","type","category","title","applicantEmail","applicantId",
      "status","currentStep","submittedAt","notes","destination",
      "startDate","endDate","subType","amount","asset","items",
      "attachments","approvalHistory"
    ]);
    const req     = body.data;
    const headers = sheetHeaders(sheet);
    sheet.appendRow(headers.map(h => {
      const v = req[h];
      if (Array.isArray(v)) return JSON.stringify(v);
      return v !== undefined ? v : "";
    }));
    sendSlackNotification(ss, req);
    return corsResponse({ ok:true });
  }

  if (body.action === "update_request") {
    // ── Server-side caller identity requirement ──────────────────────────────
    var callerEmail = String(body.callerEmail || "").trim().toLowerCase();
    if (!callerEmail) {
      Logger.log("update_request: rejected — callerEmail missing");
      return corsResponse({ ok:false, error:"Unauthorized: callerEmail required" });
    }

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

      // ── Re-read authoritative request fields from sheet ──────────────────
      const reqType        = String(data[i][headers.indexOf("type")]           || "");
      const curStep        = Number(data[i][headers.indexOf("currentStep")])   || 0;
      const applicantEmail = String(data[i][headers.indexOf("applicantEmail")] || "").toLowerCase();
      const applicantId    = String(data[i][headers.indexOf("applicantId")]    || "");
      const reqStatus      = String(data[i][headers.indexOf("status")]         || "");
      const decision       = body.decision;

      // ── Self-approval block ───────────────────────────────────────────────
      if (callerEmail === applicantEmail && decision !== "cancel") {
        Logger.log("AUTHZ_FAIL: self-approval attempted by " + callerEmail + " on req " + body.id);
        return corsResponse({ ok:false, error:"Unauthorized: self-approval not allowed" });
      }

      // ── Cancel: only applicant may cancel a pending/in_progress request ──
      if (decision === "cancel") {
        if (callerEmail !== applicantEmail) {
          Logger.log("AUTHZ_FAIL: " + callerEmail + " tried to cancel req owned by " + applicantEmail);
          return corsResponse({ ok:false, error:"Unauthorized: only the applicant can cancel" });
        }
        if (reqStatus !== "pending" && reqStatus !== "in_progress") {
          return corsResponse({ ok:false, error:"Cannot cancel: request is already " + reqStatus });
        }
        setCol("status", "cancelled");
        Logger.log("CANCEL: " + callerEmail + " cancelled req=" + body.id);
        return corsResponse({ ok:true });
      }

      // ── Approve / Reject: verify caller's role against current chain step ─
      if (decision === "approve" || decision === "reject") {
        if (reqStatus !== "pending" && reqStatus !== "in_progress") {
          return corsResponse({ ok:false, error:"Request is not in an actionable state: " + reqStatus });
        }

        const quotas       = getQuotas(ss);
        const chain        = (quotas.approvalChains && quotas.approvalChains[reqType]) || getDefaultChains()[reqType] || ["assignee"];
        const expectedRole = chain[curStep];
        const rosterSheet  = ss.getSheetByName("ROSTER");
        const roster       = rosterSheet ? sheetToObjects(rosterSheet) : [];
        const callerRow    = roster.find(function(r) { return String(r.email || "").toLowerCase() === callerEmail; });
        const applicantRow = roster.find(function(r) { return String(r.id || "") === applicantId; });

        var authorized = false;
        if (expectedRole === "assignee") {
          var assignees = (quotas.assignees && quotas.assignees[reqType]) || [];
          authorized = assignees.map(function(e) { return String(e).toLowerCase(); }).indexOf(callerEmail) >= 0;
        } else if (expectedRole === "manager") {
          authorized = !!(callerRow && applicantRow && String(callerRow.id) === String(applicantRow.managerId));
        } else if (expectedRole === "ceo") {
          authorized = callerEmail === String(quotas.ceoEmail || "").toLowerCase();
        }

        if (!authorized) {
          Logger.log("AUTHZ_FAIL: " + callerEmail + " tried to " + decision + " step=" + curStep + " role=" + expectedRole + " req=" + body.id);
          return corsResponse({ ok:false, error:"Unauthorized: you are not the expected approver for this step (" + expectedRole + ")" });
        }

        if (decision === "approve") {
          const nextStep = curStep + 1;
          const isLast   = nextStep >= chain.length;
          setCol("currentStep", nextStep);
          setCol("status", isLast ? "completed" : "in_progress");
          const histIdx = headers.indexOf("approvalHistory");
          var hist = [];
          try { hist = JSON.parse(data[i][histIdx] || "[]"); } catch(ex) {}
          hist.push({ step:curStep, role:expectedRole, approverEmail:callerEmail, decision:"approved", comment:body.comment||"", ts:new Date().toISOString() });
          if (histIdx >= 0) sheet.getRange(row, histIdx+1).setValue(JSON.stringify(hist));
          Logger.log("APPROVE: " + callerEmail + " approved step=" + curStep + " req=" + body.id);
          sendApprovalSlack(ss, data[i], headers, "approved", body.comment, isLast);
        }

        if (decision === "reject") {
          setCol("status", "rejected");
          const histIdx = headers.indexOf("approvalHistory");
          var hist = [];
          try { hist = JSON.parse(data[i][histIdx] || "[]"); } catch(ex) {}
          hist.push({ step:curStep, role:expectedRole, approverEmail:callerEmail, decision:"rejected", comment:body.comment||"", ts:new Date().toISOString() });
          if (histIdx >= 0) sheet.getRange(row, histIdx+1).setValue(JSON.stringify(hist));
          Logger.log("REJECT: " + callerEmail + " rejected req=" + body.id);
          sendApprovalSlack(ss, data[i], headers, "rejected", body.comment, false);
        }

        return corsResponse({ ok:true });
      }

      return corsResponse({ ok:false, error:"Unknown decision: " + decision });
    }
    return corsResponse({ ok:false, error:"Request not found" });
  }

  if (body.action === "upload_file") {
    try {
      // Validate MIME type against whitelist
      var mimeType = body.mimeType || "";
      if (ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) {
        return corsResponse({ ok:false, error:"허용되지 않는 파일 형식입니다. (허용: 이미지/PDF/Office/텍스트)" });
      }
      // Validate file size (base64 length → original ~10MB)
      var base64Data = body.base64Data || body.base64 || "";
      if (!base64Data) {
        return corsResponse({ ok:false, error:"파일 데이터가 없습니다." });
      }
      if (base64Data.length > MAX_BASE64_LENGTH) {
        return corsResponse({ ok:false, error:"파일 크기가 10MB를 초과합니다." });
      }
      // Validate file name (prevent path traversal)
      var fileName = (body.fileName || "upload").replace(/[\/\\:*?"<>|]/g, "_");

      const quotas   = getQuotas(ss);
      const folderId = quotas.driveFolderId || "";
      const decoded  = Utilities.base64Decode(base64Data);
      const blob     = Utilities.newBlob(decoded, mimeType, fileName);
      const meta     = { title: fileName, mimeType: mimeType };
      if (folderId) meta.parents = [{ id: folderId }];
      const file = Drive.Files.insert(meta, blob, { supportsAllDrives: true });
      Drive.Permissions.insert(
        { role: "reader", type: "anyone" },
        file.id,
        { supportsAllDrives: true }
      );
      const url = "https://drive.google.com/file/d/" + file.id + "/view";
      Logger.log("File uploaded: " + fileName + " (" + mimeType + ", " + decoded.length + " bytes)");
      return corsResponse({ ok:true, fileId:file.id, url:url });
    } catch(e) {
      Logger.log("upload_file error: " + e.message);
      return corsResponse({ ok:false, error:e.message });
    }
  }

  if (body.action === "save_quotas") {
    const sheet = getOrCreateSheet(ss, "QUOTAS", ["key","value"]);
    const data  = sheet.getDataRange().getValues();
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
    const quotas  = getQuotas(ss);
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
    const blocks = [
      { type:"section", text:{ type:"mrkdwn", text:`📋 *New GA Support Request*\n*Type:* ${typeLabel}\n*From:* ${req.applicantEmail}\n*Title:* ${req.title}` } },
    ];
    if (appUrl) blocks.push({ type:"actions", elements:[{ type:"button", style:"primary", text:{ type:"plain_text", text:"View & Approve" }, url:appUrl }] });
    const payload = { text:`📋 *New GA Request* — ${typeLabel}`, blocks };
    UrlFetchApp.fetch(webhook, { method:"post", contentType:"application/json", payload:JSON.stringify(payload), muteHttpExceptions:true });
  } catch(e) { Logger.log("Slack error: "+e.message); }
}

function sendApprovalSlack(ss, rowData, headers, decision, comment, isCompleted) {
  try {
    const quotas  = getQuotas(ss);
    const webhook = quotas.slackWebhook;
    if (!webhook) return;
    const appUrl = quotas.appUrl || "";
    const title     = rowData[headers.indexOf("title")]          || "";
    const applicant = rowData[headers.indexOf("applicantEmail")] || "";
    const icon   = decision === "approved" ? (isCompleted ? "✅" : "⏩") : "❌";
    const status = decision === "approved" ? (isCompleted ? "Completed" : "Approved — next step") : "Rejected";
    const blocks2 = [
      { type:"section", text:{ type:"mrkdwn", text:`${icon} *Request Update*\n*Title:* ${title}\n*Applicant:* ${applicant}\n*Status:* ${status}${comment?`\n*Comment:* ${comment}`:""}` } },
    ];
    if (appUrl) blocks2.push({ type:"actions", elements:[{ type:"button", text:{ type:"plain_text", text:"Open App" }, url:appUrl }] });
    const payload = { text:`${icon} *Request Update* — ${title}`, blocks:blocks2 };
    UrlFetchApp.fetch(webhook, { method:"post", contentType:"application/json", payload:JSON.stringify(payload), muteHttpExceptions:true });
  } catch(e) { Logger.log("Approval slack error: "+e.message); }
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
    business_card:["assignee"], onboarding_item:["assignee"],
    onboarding_account:["assignee"], offboarding_item:["assignee"],
    offboarding_account:["assignee"], corporate_card:["manager","ceo","assignee"],
    domestic_trip:["manager","assignee"], overseas_trip:["manager","ceo","assignee"],
    asset_breakdown:["assignee"], facility_breakdown:["assignee"],
    it_breakdown:["assignee"], item_breakdown:["assignee"],
    car_rental:["assignee"], rnd_item:["assignee"], equipment_rental:["assignee"],
  };
}
