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

// ─── Phase 6-2: Input sanitization helpers ────────────────────────────────────
function stripHtml(str) {
  return String(str || "").replace(/<[^>]*>/g, "").trim();
}

function sanitizeText(str, maxLen) {
  var s = stripHtml(str);
  return maxLen ? s.slice(0, maxLen) : s;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

// ─── CORS RESPONSE ────────────────────────────────────────────────────────────
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── TOKEN VERIFICATION ───────────────────────────────────────────────────────
// Phase 6-1: id_token 검증 (Google tokeninfo)
// fallback: API_TOKEN (하위 호환 — migration period)
function verifyIdToken(idToken) {
  if (!idToken) return null;
  try {
    var resp = UrlFetchApp.fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) return null;
    var data = JSON.parse(resp.getContentText());
    if (!data.email) return null;
    if (!data.email.endsWith("@seoulrobotics.org")) return null;
    if (data.exp && Number(data.exp) * 1000 < Date.now()) return null;
    return data.email;
  } catch(e) {
    Logger.log("verifyIdToken error: " + e.message);
    return null;
  }
}

function verifyToken(e) {
  // 1) id_token 우선 시도
  var idToken = (e.parameter && e.parameter.id_token) || "";
  if (!idToken && e.postData) {
    try { idToken = JSON.parse(e.postData.contents).id_token || ""; } catch {}
  }
  if (idToken) {
    var email = verifyIdToken(idToken);
    if (email) return true;
    Logger.log("verifyToken: id_token validation failed");
    return false;
  }

  // 2) fallback: API_TOKEN
  var stored = PropertiesService.getScriptProperties().getProperty("API_TOKEN") || "";
  if (!stored) return true;
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

  // Phase 4-3: 인앱 알림 조회
  if (action === "get_notifications") {
    var userEmail = String(e.parameter.userEmail || "").toLowerCase();
    if (!userEmail) return corsResponse({ ok:false, error:"userEmail required" });
    const sheet = ss.getSheetByName("NOTIFICATIONS");
    if (!sheet) return corsResponse({ ok:true, data:[] });
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const all    = sheetToObjects(sheet);
    const data   = all.filter(function(n) {
      return String(n.targetEmail || "").toLowerCase() === userEmail && String(n.createdAt || "") >= cutoff;
    });
    return corsResponse({ ok:true, data: data });
  }

  return corsResponse({ ok:false, error:"Unknown action" });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
function doPost(e) {
  if (!verifyToken(e)) {
    Logger.log("doPost: Unauthorized — invalid or missing token, action=" + (e.postData ? "body" : "none"));
    return corsResponse({ ok: false, error: "Unauthorized" });
  }

  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (ex) {
    Logger.log("doPost: JSON parse error — " + ex.message);
    return corsResponse({ ok: false, error: "Bad request: invalid JSON" });
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);

  // ─── Phase 2-3: LockService for save_request ──────────────────────────────
  if (body.action === "save_request") {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch(ex) {
      Logger.log("save_request: lock timeout — " + ex.message);
      return corsResponse({ ok:false, error:"서버가 바쁩니다. 잠시 후 다시 시도해주세요." });
    }
    try {
      const sheet = getOrCreateSheet(ss, "REQUESTS", [
        "id","type","category","title","applicantEmail","applicantId",
        "status","currentStep","submittedAt","notes","destination",
        "startDate","endDate","subType","amount","asset","items",
        "attachments","approvalHistory"
      ]);
      const req     = body.data;

      // Phase 6-2: sanitize user-input fields
      req.title       = sanitizeText(req.title,       200);
      req.notes       = sanitizeText(req.notes,       2000);
      req.destination = sanitizeText(req.destination, 200);
      req.asset       = sanitizeText(req.asset,       200);

      const headers = sheetHeaders(sheet);
      sheet.appendRow(headers.map(h => {
        const v = req[h];
        if (Array.isArray(v)) return JSON.stringify(v);
        return v !== undefined ? v : "";
      }));
      sendSlackNotification(ss, req);
      notifyNewRequest(ss, req);
      createNotificationsForNewRequest(ss, req);
      return corsResponse({ ok:true });
    } finally {
      lock.releaseLock();
    }
  }

  // ─── Phase 2-3: LockService for update_request ────────────────────────────
  if (body.action === "update_request") {
    var callerEmail = String(body.callerEmail || "").trim().toLowerCase();
    if (!callerEmail) {
      Logger.log("update_request: rejected — callerEmail missing");
      return corsResponse({ ok:false, error:"Unauthorized: callerEmail required" });
    }

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(15000);
    } catch(ex) {
      Logger.log("update_request: lock timeout — " + ex.message);
      return corsResponse({ ok:false, error:"서버가 바쁩니다. 잠시 후 다시 시도해주세요." });
    }

    try {
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

        const reqType        = String(data[i][headers.indexOf("type")]           || "");
        const curStep        = Number(data[i][headers.indexOf("currentStep")])   || 0;
        const applicantEmail = String(data[i][headers.indexOf("applicantEmail")] || "").toLowerCase();
        const applicantId    = String(data[i][headers.indexOf("applicantId")]    || "");
        const reqStatus      = String(data[i][headers.indexOf("status")]         || "");
        const decision       = body.decision;

        if (callerEmail === applicantEmail && decision !== "cancel") {
          Logger.log("AUTHZ_FAIL: self-approval attempted by " + callerEmail + " on req " + body.id);
          return corsResponse({ ok:false, error:"Unauthorized: self-approval not allowed" });
        }

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
            // 다음 결재자 이메일 계산
            var nextApproverEmail = null;
            if (!isLast) {
              const nextRole = chain[nextStep];
              const quotasForEmail = getQuotas(ss);
              if (nextRole === "assignee") {
                var assigneeList = (quotasForEmail.assignees && quotasForEmail.assignees[reqType]) || [];
                if (assigneeList.length > 0) nextApproverEmail = assigneeList[0];
              } else if (nextRole === "ceo") {
                nextApproverEmail = quotasForEmail.ceoEmail || null;
              }
            }
            notifyApprovalUpdate(ss, data[i], headers, "approve", isLast, nextApproverEmail);
            // 인앱 알림
            const reqTitle = data[i][headers.indexOf("title")] || "";
            if (isLast) {
              createNotification(ss, applicantEmail, "completed", "요청 완료", reqTitle + " — 완료됐습니다", body.id);
            } else if (nextApproverEmail) {
              createNotification(ss, nextApproverEmail, "approval_required", "결재 요청", reqTitle + " — 결재가 필요합니다", body.id);
            }
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
            notifyApprovalUpdate(ss, data[i], headers, "reject", false, null);
            // 인앱 알림
            const rejTitle = data[i][headers.indexOf("title")] || "";
            createNotification(ss, applicantEmail, "rejected", "요청 반려", rejTitle + " — 반려됐습니다", body.id);
          }

          return corsResponse({ ok:true });
        }

        return corsResponse({ ok:false, error:"Unknown decision: " + decision });
      }
      return corsResponse({ ok:false, error:"Request not found" });
    } finally {
      lock.releaseLock();
    }
  }

  if (body.action === "upload_file") {
    try {
      var mimeType = body.mimeType || "";
      if (ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) {
        return corsResponse({ ok:false, error:"허용되지 않는 파일 형식입니다. (허용: 이미지/PDF/Office/텍스트)" });
      }
      var base64Data = body.base64Data || body.base64 || "";
      if (!base64Data) {
        return corsResponse({ ok:false, error:"파일 데이터가 없습니다." });
      }
      if (base64Data.length > MAX_BASE64_LENGTH) {
        return corsResponse({ ok:false, error:"파일 크기가 10MB를 초과합니다." });
      }
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

  // ─── Phase 2-3: LockService for save_quotas ───────────────────────────────
  // Phase 4-3: 알림 읽음 처리
  if (body.action === "mark_read") {
    var notifId = String(body.notificationId || "");
    if (!notifId) return corsResponse({ ok:false, error:"notificationId required" });
    const nSheet = ss.getSheetByName("NOTIFICATIONS");
    if (!nSheet) return corsResponse({ ok:true });
    const nHeaders = sheetHeaders(nSheet);
    const nIdCol   = nHeaders.indexOf("id") + 1;
    const nReadCol = nHeaders.indexOf("read") + 1;
    if (nIdCol < 1 || nReadCol < 1) return corsResponse({ ok:true });
    const nData = nSheet.getDataRange().getValues();
    for (var ni = 1; ni < nData.length; ni++) {
      if (String(nData[ni][nIdCol-1]) === notifId) {
        nSheet.getRange(ni+1, nReadCol).setValue("true");
        return corsResponse({ ok:true });
      }
    }
    return corsResponse({ ok:true });
  }

  if (body.action === "save_quotas") {
    // Phase 6-2: validate quotas input
    var qData = body.data || {};
    if (qData.adminEmails && Array.isArray(qData.adminEmails)) {
      var invalidEmails = qData.adminEmails.filter(function(e) { return !isValidEmail(e); });
      if (invalidEmails.length > 0) {
        return corsResponse({ ok:false, error:"유효하지 않은 이메일 형식: " + invalidEmails.join(", ") });
      }
    }
    if (qData.approvalChains) {
      var allowedRoles = ["manager","ceo","assignee"];
      var chainError = null;
      Object.keys(qData.approvalChains).forEach(function(k) {
        var chain = qData.approvalChains[k];
        if (!Array.isArray(chain)) return;
        chain.forEach(function(role) {
          if (allowedRoles.indexOf(role) === -1) chainError = "허용되지 않는 역할: " + role;
        });
      });
      if (chainError) return corsResponse({ ok:false, error:chainError });
    }

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch(ex) {
      return corsResponse({ ok:false, error:"서버가 바쁩니다. 잠시 후 다시 시도해주세요." });
    }
    try {
      const sheet = getOrCreateSheet(ss, "QUOTAS", ["key","value"]);
      const data  = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === "config") {
          sheet.getRange(i+1, 2).setValue(JSON.stringify(qData));
          return corsResponse({ ok:true });
        }
      }
      sheet.appendRow(["config", JSON.stringify(qData)]);
      return corsResponse({ ok:true });
    } finally {
      lock.releaseLock();
    }
  }

  return corsResponse({ ok:false, error:"Unknown action" });
}

// ─── IN-APP NOTIFICATIONS (Phase 4-3) ────────────────────────────────────────
function createNotification(ss, targetEmail, type, title, message, requestId) {
  try {
    if (!targetEmail) return;
    const sheet = getOrCreateSheet(ss, "NOTIFICATIONS", ["id","targetEmail","type","title","message","requestId","read","createdAt"]);
    const id = "notif_" + Date.now() + "_" + Math.random().toString(36).slice(2,5);
    sheet.appendRow([id, targetEmail, type, title, message, requestId || "", "false", new Date().toISOString()]);
  } catch(e) { Logger.log("createNotification error: " + e.message); }
}

function createNotificationsForNewRequest(ss, req) {
  try {
    const quotas = getQuotas(ss);
    const chain  = (quotas.approvalChains && quotas.approvalChains[req.type]) || getDefaultChains()[req.type] || ["assignee"];
    const role   = chain[0];
    var targets  = [];
    if (role === "assignee") {
      targets = (quotas.assignees && quotas.assignees[req.type]) || [];
    } else if (role === "manager") {
      const rSheet = ss.getSheetByName("ROSTER");
      if (rSheet) {
        const roster = sheetToObjects(rSheet);
        const ap = roster.find(function(r) { return r.email === req.applicantEmail; });
        if (ap) {
          const mg = roster.find(function(r) { return String(r.id) === String(ap.managerId); });
          if (mg && mg.email) targets = [mg.email];
        }
      }
    } else if (role === "ceo") {
      if (quotas.ceoEmail) targets = [quotas.ceoEmail];
    }
    targets.forEach(function(email) {
      createNotification(ss, email, "approval_required", "결재 요청", req.title + " — 결재가 필요합니다", req.id);
    });
  } catch(e) { Logger.log("createNotificationsForNewRequest error: " + e.message); }
}

// ─── EMAIL NOTIFICATIONS (Phase 4-2) ─────────────────────────────────────────
function sendEmailNotification(toEmail, subject, htmlBody) {
  try {
    MailApp.sendEmail({
      to: toEmail,
      subject: subject,
      htmlBody: htmlBody,
    });
    Logger.log("Email sent to: " + toEmail + " | " + subject);
  } catch(e) {
    Logger.log("Email send error (silent): " + e.message);
  }
}

function buildEmailHtml(title, bodyText, appUrl) {
  var btnHtml = appUrl
    ? `<p style="margin-top:20px;"><a href="${appUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Open App</a></p>`
    : "";
  return `
    <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#1d4ed8;margin-top:0;">🏢 SR GA Support</h2>
      <h3 style="margin-top:0;">${title}</h3>
      <p style="color:#374151;">${bodyText}</p>
      ${btnHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin-top:24px;" />
      <p style="font-size:11px;color:#9ca3af;">Seoul Robotics General Affairs · SR employees only</p>
    </div>`;
}

function notifyNewRequest(ss, req) {
  try {
    const quotas = getQuotas(ss);
    if (!quotas.emailNotifications) return;
    const appUrl  = quotas.appUrl || "";
    const chain   = (quotas.approvalChains && quotas.approvalChains[req.type]) || getDefaultChains()[req.type] || ["assignee"];
    const role    = chain[0];
    var targets   = [];
    if (role === "assignee") {
      targets = (quotas.assignees && quotas.assignees[req.type]) || [];
    } else if (role === "manager") {
      const rosterSheet = ss.getSheetByName("ROSTER");
      if (rosterSheet) {
        const roster = sheetToObjects(rosterSheet);
        const ap = roster.find(function(r) { return r.email === req.applicantEmail; });
        if (ap) {
          const mg = roster.find(function(r) { return String(r.id) === String(ap.managerId); });
          if (mg && mg.email) targets = [mg.email];
        }
      }
    } else if (role === "ceo") {
      if (quotas.ceoEmail) targets = [quotas.ceoEmail];
    }
    const typeLabels = { business_card:"Business Card", onboarding_item:"Onboarding Items", onboarding_account:"Onboarding Account", offboarding_item:"Offboarding Item Return", offboarding_account:"Offboarding Account", corporate_card:"Corporate Card", domestic_trip:"Domestic Trip", overseas_trip:"Overseas Trip", asset_breakdown:"Asset Breakdown", facility_breakdown:"Facility Breakdown", it_breakdown:"IT Breakdown", item_breakdown:"Item Breakdown", car_rental:"Company Car Rental", rnd_item:"R&D Item", equipment_rental:"Equipment Rental" };
    const typeLabel = typeLabels[req.type] || req.type;
    targets.forEach(function(email) {
      sendEmailNotification(
        email,
        "[SR GA] 신규 요청: " + req.title,
        buildEmailHtml(
          "신규 결재 요청",
          `<b>${req.applicantEmail}</b>이(가) <b>${typeLabel}</b> 요청을 제출했습니다.<br/><br/>제목: <b>${req.title}</b>`,
          appUrl
        )
      );
    });
  } catch(e) { Logger.log("notifyNewRequest error: " + e.message); }
}

function notifyApprovalUpdate(ss, rowData, headers, decision, isCompleted, nextApproverEmail) {
  try {
    const quotas = getQuotas(ss);
    if (!quotas.emailNotifications) return;
    const appUrl     = quotas.appUrl || "";
    const title      = rowData[headers.indexOf("title")]          || "";
    const applicant  = rowData[headers.indexOf("applicantEmail")] || "";
    if (decision === "reject" && applicant) {
      sendEmailNotification(
        applicant,
        "[SR GA] 요청 반려: " + title,
        buildEmailHtml("요청이 반려됐습니다", `제목: <b>${title}</b><br/>귀하의 요청이 반려됐습니다. 앱에서 자세한 내용을 확인하세요.`, appUrl)
      );
    } else if (decision === "approve") {
      if (isCompleted && applicant) {
        sendEmailNotification(
          applicant,
          "[SR GA] 요청 완료: " + title,
          buildEmailHtml("요청이 완료됐습니다 ✅", `제목: <b>${title}</b><br/>모든 결재가 완료됐습니다.`, appUrl)
        );
      } else if (nextApproverEmail) {
        sendEmailNotification(
          nextApproverEmail,
          "[SR GA] 결재 요청: " + title,
          buildEmailHtml("결재가 필요합니다", `제목: <b>${title}</b><br/>귀하의 결재가 필요한 요청이 있습니다.`, appUrl)
        );
      }
    }
  } catch(e) { Logger.log("notifyApprovalUpdate error: " + e.message); }
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
    const appUrl    = quotas.appUrl || "";
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
    business_card:["assignee"],       onboarding_item:["assignee"],
    onboarding_account:["assignee"],  offboarding_item:["assignee"],
    offboarding_account:["assignee"], corporate_card:["manager","ceo","assignee"],
    domestic_trip:["manager","assignee"], overseas_trip:["manager","ceo","assignee"],
    asset_breakdown:["assignee"],     facility_breakdown:["assignee"],
    it_breakdown:["assignee"],        item_breakdown:["assignee"],
    car_rental:["assignee"],          rnd_item:["assignee"], equipment_rental:["assignee"],
  };
}
