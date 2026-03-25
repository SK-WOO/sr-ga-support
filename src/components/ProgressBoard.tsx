import { C, REQ_TYPES, DEFAULT_CHAINS } from "../constants";

export default function ProgressBoard({ requests, roster, quotas, onSelect }) {
  const sorted = [...requests]
    .sort((a, b) => +new Date(a.submittedAt) - +new Date(b.submittedAt));

  if (sorted.length === 0) {
    return <div style={{ color: C.muted, fontSize: 13, padding: "12px 0" }}>진행 중인 요청이 없습니다.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map(r => {
        const t         = REQ_TYPES[r.type] || {};
        const step      = r.currentStep || 0;
        const sub       = new Date(r.submittedAt);
        const diffH     = Math.floor((Date.now() - +sub) / 3600000);
        const diffD     = Math.floor((Date.now() - +sub) / 86400000);
        const sameDay   = new Date().toDateString() === sub.toDateString();
        const waitLabel = sameDay ? (diffH > 0 ? `${diffH}h 경과` : "방금 전") : `${diffD}일 경과`;
        const chain     = (quotas?.approvalChains?.[r.type]) || DEFAULT_CHAINS[r.type] || ["assignee"];
        const statusColor = r.status === "in_progress" ? C.primary : C.warning;
        return (
          <div key={r.id} onClick={() => onSelect(r)}
            style={{
              background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8,
              padding: "10px 14px", cursor: "pointer", display: "flex",
              justifyContent: "space-between", alignItems: "center", gap: 12,
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>{t.icon || "📋"}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.title || t.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                Step {step + 1}/{chain.length} · {waitLabel}
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: statusColor, whiteSpace: "nowrap" }}>
              {r.status === "in_progress" ? "진행 중" : "대기 중"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
