import { useMemo } from "react";
import { C } from "../constants";
import useIsMobile from "../hooks/useIsMobile";
import Btn from "./ui/Btn";
import ReqCard from "./ReqCard";
import ProgressBoard from "./ProgressBoard";

export default function Dashboard({ requests, roster, meEmail, quotas, onNew, onSelect }) {
  const isMobile = useIsMobile();
  const rosterMe = roster.find(r => r.email === meEmail);

  const mine      = useMemo(() => requests.filter(r => r.applicantEmail === meEmail), [requests, meEmail]);
  const myPending = mine.filter(r => r.status === "pending" || r.status === "in_progress");
  const myDone    = mine.filter(r => r.status === "completed" || r.status === "approved");
  const myRecent  = [...mine].sort((a,b) => +new Date(b.submittedAt) - +new Date(a.submittedAt)).slice(0, 5);

  const myTeam = useMemo(() =>
    roster.filter(r => String(r.managerId) === String(rosterMe?.id) && r.email !== meEmail)
  , [roster, rosterMe, meEmail]);

  const teamReqs = useMemo(() =>
    requests.filter(r => myTeam.some(t => t.email === r.applicantEmail))
      .sort((a,b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))
  , [requests, myTeam]);

  const teamPending = teamReqs.filter(r => r.status === "pending" || r.status === "in_progress");

  const kpis = [
    { label:"My Pending",   value:myPending.length, icon:"⏳", color:C.warning, bg:C.warningLight },
    { label:"My Completed", value:myDone.length,    icon:"✅", color:C.success, bg:C.successLight },
    { label:"Total",        value:mine.length,       icon:"📋", color:C.primary, bg:C.primaryLight },
    ...(myTeam.length > 0 ? [{ label:"Team Pending", value:teamPending.length, icon:"👥", color:C.purple, bg:C.purpleLight }] : []),
  ];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Dashboard</h2>
          {rosterMe && <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{rosterMe.name} · {rosterMe.team}</div>}
        </div>
        <Btn onClick={onNew}>+ New Request</Btn>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:`repeat(${isMobile?2:kpis.length},1fr)`, gap:10, marginBottom:20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background:k.bg, borderRadius:10, padding:"14px 12px", textAlign:"center", border:`1px solid ${k.color}22` }}>
            <div style={{ fontSize:24 }}>{k.icon}</div>
            <div style={{ fontSize:24, fontWeight:800, color:k.color }}>{k.value}</div>
            <div style={{ fontSize:11, color:k.color, fontWeight:600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <ProgressBoard requests={myPending} roster={roster} quotas={quotas} onSelect={onSelect} />

      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:8, color:C.text }}>My Recent Requests</div>
        {myRecent.length === 0 ? (
          <div style={{ textAlign:"center", padding:"24px", color:C.muted, background:C.grayLight, borderRadius:8, fontSize:13 }}>
            No requests yet —{" "}
            <button onClick={onNew} style={{ background:"none", border:"none", color:C.primary, cursor:"pointer", fontWeight:600, fontSize:13 }}>
              submit your first one
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {myRecent.map(r => <ReqCard key={r.id} req={r} roster={roster} onClick={() => onSelect(r)} />)}
          </div>
        )}
      </div>

      {myTeam.length > 0 && (
        <div>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:8, color:C.text }}>
            Team Requests <span style={{ fontWeight:400, color:C.muted }}>({myTeam.length} members)</span>
          </div>
          {teamReqs.length === 0 ? (
            <div style={{ textAlign:"center", padding:"24px", color:C.muted, background:C.grayLight, borderRadius:8, fontSize:13 }}>No team requests</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {teamReqs.slice(0, 10).map(r => <ReqCard key={r.id} req={r} roster={roster} onClick={() => onSelect(r)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
