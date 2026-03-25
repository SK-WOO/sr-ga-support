import { useState, useMemo } from "react";
import { C, REQ_TYPES, DEFAULT_CHAINS } from "../constants";
import Badge from "./ui/Badge";

const PAGE_SIZE = 20;

// Phase 3-2: 페이지네이션 포함
export default function Approvals({ requests, meEmail, roster, quotas, onSelect }) {
  const [page, setPage] = useState(1);
  const rosterMe = roster.find(r => r.email === meEmail);
  const isCEO    = meEmail === (quotas?.ceoEmail || "");

  const pending = useMemo(() => {
    return requests.filter(r => {
      if (r.status !== "pending" && r.status !== "in_progress") return false;
      if (r.applicantEmail === meEmail) return false;
      const chain = (quotas?.approvalChains?.[r.type]) || DEFAULT_CHAINS[r.type] || ["assignee"];
      const role  = chain[r.currentStep || 0];
      const ap    = roster.find(u => String(u.id) === String(r.applicantId));
      if (role === "assignee") return (quotas?.assignees?.[r.type] || []).includes(meEmail);
      if (role === "manager")  return rosterMe && String(rosterMe.id) === String(ap?.managerId);
      if (role === "ceo")      return isCEO;
      return false;
    }).sort((a,b) => +new Date(a.submittedAt) - +new Date(b.submittedAt));
  }, [requests, meEmail, roster, quotas, rosterMe, isCEO]);

  const totalPages = Math.ceil(pending.length / PAGE_SIZE);
  const list       = pending.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Pending Approvals</h2>
        <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{pending.length} item(s) awaiting action</div>
      </div>
      {pending.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted, background:C.grayLight, borderRadius:10 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✅</div><div>All clear</div>
        </div>
      ) : (
        <>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {list.map(r => {
              const t         = REQ_TYPES[r.type] || {};
              const applicant = roster.find(u => String(u.id) === String(r.applicantId));
              const waitH     = Math.floor((Date.now() - +new Date(r.submittedAt)) / 3600000);
              return (
                <div key={r.id} onClick={() => onSelect(r)}
                  style={{ background:"#fff", border:`2px solid ${C.warning}`, borderRadius:8,
                    padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}
                  onMouseOver={e => e.currentTarget.style.background = C.warningLight}
                  onMouseOut={e  => e.currentTarget.style.background = "#fff"}>
                  <span style={{ fontSize:22 }}>{t.icon || "📋"}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{r.title}</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                      {t.label} · from {applicant?.name || r.applicantEmail}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <Badge status={r.status} />
                    <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>Waiting {waitH > 0 ? `${waitH}h` : "<1h"}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:12, marginTop:16, fontSize:13 }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                style={{ padding:"4px 12px", borderRadius:6, border:`1px solid ${C.border}`, background:"#fff", cursor:page===1?"not-allowed":"pointer", opacity:page===1?.4:1 }}>
                ← 이전
              </button>
              <span style={{ color:C.muted }}>페이지 {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                style={{ padding:"4px 12px", borderRadius:6, border:`1px solid ${C.border}`, background:"#fff", cursor:page===totalPages?"not-allowed":"pointer", opacity:page===totalPages?.4:1 }}>
                다음 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
