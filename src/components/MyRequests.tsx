import { useState, useMemo } from "react";
import { C, REQ_TYPES, STATUS } from "../constants";
import { inputStyle } from "./ui/Fld";
import type { Request, RosterMember, Quotas } from "../types";
import Btn from "./ui/Btn";
import ReqCard from "./ReqCard";

const PAGE_SIZE = 10;

export default function MyRequests({ requests, meEmail, roster, quotas, onNew, onSelect }: {
  requests: Request[];
  meEmail: string;
  roster: RosterMember[];
  quotas: Quotas;
  onNew: () => void;
  onSelect: (r: Request) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [typeF,  setTypeF]  = useState("all");
  const [page,   setPage]   = useState(1);

  const mine = useMemo(() =>
    requests
      .filter(r => r.applicantEmail === meEmail)
      .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))
  , [requests, meEmail]);

  const filtered = useMemo(() => mine.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (typeF   !== "all" && r.type   !== typeF)  return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const fields = [r.title, r.notes, r.destination, r.asset, REQ_TYPES[r.type]?.label];
      if (!fields.some(f => f?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [mine, filter, typeF, search]);

  const usedTypes  = useMemo(() => Array.from(new Set(mine.map(r => r.type))), [mine]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const list       = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (f: string) => { setFilter(f); setPage(1); };
  const handleTypeChange   = (t: string) => { setTypeF(t);  setPage(1); };
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>My Requests</h2>
        <Btn onClick={onNew}>+ New Request</Btn>
      </div>

      <div style={{ marginBottom: 10 }}>
        <input
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search / 검색 (제목, 유형, 메모)"
          style={{ ...inputStyle, marginBottom: 8 }}
        />

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {(["all", "pending", "in_progress", "completed", "rejected", "cancelled"] as const).map(s => (
            <button key={s} onClick={() => handleFilterChange(s)}
              style={{ padding: "3px 11px", borderRadius: 16,
                border: `1px solid ${filter === s ? C.primary : C.border}`,
                background: filter === s ? C.primary : "#fff",
                color: filter === s ? "#fff" : C.text,
                cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {s === "all" ? "All Status" : STATUS[s]?.label || s}
            </button>
          ))}
        </div>

        {usedTypes.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => handleTypeChange("all")}
              style={{ padding: "3px 11px", borderRadius: 16,
                border: `1px solid ${typeF === "all" ? C.purple : C.border}`,
                background: typeF === "all" ? C.purple : "#fff",
                color: typeF === "all" ? "#fff" : C.text,
                cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              All Types
            </button>
            {usedTypes.map(t => (
              <button key={t} onClick={() => handleTypeChange(t)}
                style={{ padding: "3px 11px", borderRadius: 16,
                  border: `1px solid ${typeF === t ? C.purple : C.border}`,
                  background: typeF === t ? C.purple : "#fff",
                  color: typeF === t ? "#fff" : C.text,
                  cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                {REQ_TYPES[t]?.icon} {REQ_TYPES[t]?.label || t}
              </button>
            ))}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted, background: C.grayLight, borderRadius: 10 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div>No requests found</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map(r => <ReqCard key={r.id} req={r} roster={roster} onClick={() => onSelect(r)} />)}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16, fontSize: 13 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff",
                  cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? .4 : 1 }}>
                ← 이전
              </button>
              <span style={{ color: C.muted }}>페이지 {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff",
                  cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? .4 : 1 }}>
                다음 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
