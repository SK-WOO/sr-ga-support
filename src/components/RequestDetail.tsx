import { useState } from "react";
import { C, REQ_TYPES, DEFAULT_CHAINS } from "../constants";
import parseJsonField from "../utils/parseJsonField";
import Modal from "./ui/Modal";
import Btn from "./ui/Btn";
import Badge from "./ui/Badge";
import { Fld, Txa } from "./ui/Fld";

export default function RequestDetail({ req, onClose, onAction, meEmail, roster, quotas }) {
  const [comment,       setComment]       = useState("");
  const [busy,          setBusy]          = useState(false);
  const [confirmAppr,   setConfirmAppr]   = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const typeInfo = REQ_TYPES[req.type] || {};
  const chain    = quotas?.approvalChains?.[req.type] || DEFAULT_CHAINS[req.type] || ["assignee"];
  const step     = req.currentStep || 0;
  const curRole  = chain[step];
  const canAct   = req.status === "pending" || req.status === "in_progress";

  const applicant  = roster.find(r => String(r.id) === String(req.applicantId));
  const rosterMe   = roster.find(r => r.email === meEmail);
  const isAssignee = (quotas?.assignees?.[req.type] || []).includes(meEmail);
  const isManager  = rosterMe && String(rosterMe.id) === String(applicant?.managerId);
  const isCEO      = meEmail === (quotas?.ceoEmail || "");
  const isSelf     = meEmail === req.applicantEmail;

  const myTurn = canAct && !isSelf && (
    (curRole === "assignee" && isAssignee) ||
    (curRole === "manager"  && isManager)  ||
    (curRole === "ceo"      && isCEO)
  );

  const attachments = parseJsonField(req.attachments);
  const items       = parseJsonField(req.items);

  const act = async (action) => {
    setBusy(true);
    try {
      await onAction({ action, id: req.id, comment, step, role: curRole });
      onClose();
    } finally { setBusy(false); }
  };

  let history = [];
  try { history = JSON.parse(req.approvalHistory || "[]"); } catch {}

  return (
    <Modal title={`${typeInfo.icon || "📋"} ${typeInfo.label || req.type}`} onClose={onClose} width={560}>
      <div style={{ background:C.grayLight, borderRadius:8, padding:"12px 14px", marginBottom:16,
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontWeight:700, fontSize:15 }}>{req.title}</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
            {applicant?.name || req.applicantEmail} · {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : ""}
            {req.submittedBy && (() => { const sb = roster.find(r => r.email === req.submittedBy); return <span style={{ color:C.warning, marginLeft:6 }}>({sb?.name || req.submittedBy} 대신 제출)</span>; })()}
          </div>
        </div>
        <Badge status={req.status} />
      </div>

      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:6 }}>Approval Chain</div>
        <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
          {chain.map((role, i) => {
            const done = i < step; const active = i === step && canAct;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ padding:"3px 10px", borderRadius:12, fontSize:11, fontWeight:600,
                  background:done?C.successLight:active?C.primaryLight:C.grayLight,
                  color:done?C.success:active?C.primary:C.gray,
                  border:`1px solid ${done?C.success:active?C.primary:C.border}` }}>
                  {done ? "✓ " : ""}{role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
                {i < chain.length - 1 && <span style={{ color:C.border }}>→</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12, fontSize:13 }}>
        {req.destination && <div><div style={{ fontSize:11,color:C.muted }}>Destination</div><strong>{req.destination}</strong></div>}
        {req.startDate   && <div><div style={{ fontSize:11,color:C.muted }}>Period</div><strong>{req.startDate} ~ {req.endDate}</strong></div>}
        {req.asset       && <div><div style={{ fontSize:11,color:C.muted }}>Asset/Location</div><strong>{req.asset}</strong></div>}
        {req.amount      && <div><div style={{ fontSize:11,color:C.muted }}>Amount</div><strong>₩{Number(req.amount).toLocaleString()}</strong></div>}
        {req.subType     && <div><div style={{ fontSize:11,color:C.muted }}>Sub Type</div><strong>{req.subType}</strong></div>}
        {items.length > 0 && (
          <div style={{ gridColumn:"span 2" }}>
            <div style={{ fontSize:11,color:C.muted }}>Items</div>
            <strong>{items.join(", ")}</strong>
          </div>
        )}
      </div>

      {req.notes && <div style={{ background:C.grayLight,borderRadius:6,padding:10,marginBottom:12,fontSize:13 }}>{req.notes}</div>}

      {attachments.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11,fontWeight:600,color:C.muted,marginBottom:4 }}>Attachments</div>
          {attachments.filter(Boolean).map((a, i) => {
            const url  = typeof a === "string" ? a : a.url;
            const name = typeof a === "string" ? `Attachment ${i+1}` : (a.name || `Attachment ${i+1}`);
            return (
              <a key={i} href={url} target="_blank" rel="noreferrer"
                style={{ display:"block", fontSize:12, color:C.primary, marginBottom:2 }}>📎 {name}</a>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11,fontWeight:600,color:C.muted,marginBottom:6 }}>History</div>
          {history.map((h, i) => (
            <div key={i} style={{ fontSize:11, padding:"4px 0", borderBottom:`1px solid ${C.border}`, display:"flex", gap:8 }}>
              <span style={{ color:h.decision==="approved"?C.success:C.danger, fontWeight:600 }}>
                {h.decision === "approved" ? "✓" : "✗"} {h.role}
              </span>
              <span style={{ color:C.muted }}>{h.ts ? new Date(h.ts).toLocaleDateString() : ""}</span>
              {h.comment && <span>{h.comment}</span>}
            </div>
          ))}
        </div>
      )}

      {canAct && !myTurn && !isSelf && (
        <div style={{ marginTop:8, padding:"8px 12px", background:C.grayLight, borderRadius:8, fontSize:12, color:C.muted }}>
          대기 중: <strong style={{ color:C.text }}>
            {curRole === "assignee" ? `담당자 (${(quotas?.assignees?.[req.type]||[]).join(", ") || "미지정"})`
            : curRole === "manager" ? `${applicant?.name || req.applicantEmail}의 매니저`
            : curRole === "ceo"     ? "CEO"
            : curRole}
          </strong>
        </div>
      )}

      {myTurn && (
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12, marginTop:4 }}>
          <Fld label={step === chain.length - 1 ? "Comment (필수)" : "Comment (반려 시 필수)"}>
            <Txa value={comment} onChange={setComment} placeholder="Add a comment..." rows={2} />
          </Fld>
          {confirmAppr ? (
            <div style={{ background:C.primaryLight, borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>승인하시겠습니까?</div>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <Btn variant="gray" onClick={() => setConfirmAppr(false)} disabled={busy}>취소</Btn>
                <Btn onClick={() => act("approve")} disabled={busy}>{busy ? "..." : "확인"}</Btn>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <Btn variant="danger" onClick={() => act("reject")} disabled={busy || !comment.trim()}>Reject</Btn>
              <Btn onClick={() => setConfirmAppr(true)} disabled={busy || (step === chain.length - 1 && !comment.trim())}>
                {step === chain.length - 1 ? "Complete" : "Approve →"}
              </Btn>
            </div>
          )}
        </div>
      )}

      {isSelf && (req.status === "pending" || req.status === "in_progress") && (
        <div style={{ marginTop:12, textAlign:"right" }}>
          {confirmCancel ? (
            <div style={{ background:"#fef2f2", borderRadius:8, padding:"10px 12px", textAlign:"left" }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:C.danger }}>신청을 취소하시겠습니까?</div>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <Btn variant="gray" onClick={() => setConfirmCancel(false)} disabled={busy}>아니요</Btn>
                <Btn variant="danger" onClick={() => act("cancel")} disabled={busy}>{busy ? "..." : "취소 확인"}</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="outline" onClick={() => setConfirmCancel(true)} disabled={busy}>Withdraw</Btn>
          )}
        </div>
      )}
    </Modal>
  );
}
