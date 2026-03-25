import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Chart as ChartJS,
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { C, REQ_TYPES, REQ_CATEGORIES, STATUS } from "../constants";
import { inputStyle } from "./ui/Fld";
import useIsMobile from "../hooks/useIsMobile";
import Btn from "./ui/Btn";

ChartJS.register(ArcElement, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function Analytics({ requests, roster, meEmail, quotas }) {
  const isMobile = useIsMobile();
  const [range, setRange] = useState("30");

  const isAdmin   = (quotas?.adminEmails || []).includes(meEmail) || meEmail === (quotas?.ceoEmail || "");
  const rosterMe  = roster.find(r => r.email === meEmail);
  const isManager = rosterMe && roster.some(r => String(r.managerId) === String(rosterMe.id));
  const canSeeAll = isAdmin || isManager;

  const source  = canSeeAll ? requests : requests.filter(r => r.applicantEmail === meEmail);
  const cutoff  = useMemo(() => new Date(Date.now() - Number(range) * 86400000), [range]);
  const inRange = useMemo(() => source.filter(r => new Date(r.submittedAt) >= cutoff), [source, cutoff]);

  const byCat    = useMemo(() => { const c: Record<string,number>={}; inRange.forEach(r=>{ const k=REQ_TYPES[r.type]?.cat||"other"; c[k]=(c[k]||0)+1; }); return c; }, [inRange]);
  const byType   = useMemo(() => { const c: Record<string,number>={}; inRange.forEach(r=>{ c[r.type]=(c[r.type]||0)+1; }); return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,8); }, [inRange]);
  const byStatus = useMemo(() => { const c: Record<string,number>={}; inRange.forEach(r=>{ c[r.status]=(c[r.status]||0)+1; }); return c; }, [inRange]);

  const byPerson = useMemo(() => {
    if (!canSeeAll) return [];
    const c: Record<string,number> = {};
    inRange.forEach(r => { c[r.applicantEmail] = (c[r.applicantEmail]||0)+1; });
    return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([email,count]) => {
      const member = roster.find(r => r.email === email);
      return { name: member?.name || email, count };
    });
  }, [inRange, roster, canSeeAll]);

  const total    = inRange.length;
  const approved = inRange.filter(r => r.status === "completed" || r.status === "approved").length;

  const handleExport = () => {
    const exportSource = canSeeAll ? inRange : inRange.filter(r => r.applicantEmail === meEmail);
    const rows = exportSource.map(r => ({
      "요청ID":  r.id,
      "유형":    REQ_TYPES[r.type]?.label   || r.type,
      "분류":    REQ_CATEGORIES[REQ_TYPES[r.type]?.cat]?.label || "",
      "제목":    r.title,
      "신청자":  r.applicantEmail,
      "상태":    STATUS[r.status]?.label    || r.status,
      "신청일":  r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "",
      "목적지":  r.destination || "",
      "기간":    r.startDate   ? `${r.startDate} ~ ${r.endDate}` : "",
      "금액":    r.amount      || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Requests");
    XLSX.writeFile(wb, `sr-ga-requests-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Analytics</h2>
          {!canSeeAll && <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>My requests only</div>}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <Btn onClick={handleExport} variant="outline" style={{ fontSize:12 }}>📥 Excel</Btn>
          <select value={range} onChange={e => setRange(e.target.value)} style={{ ...inputStyle, width:"auto" }}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          { label:"Total",    value:total,    icon:"📋", color:C.primary },
          { label:"Approved", value:approved, icon:"✅", color:C.success },
          { label:"Rate",     value:`${total>0?Math.round(approved/total*100):0}%`, icon:"📈", color:C.success },
          { label:"Pending",  value:(byStatus.pending||0)+(byStatus.in_progress||0), icon:"⏳", color:C.warning },
        ].map(k => (
          <div key={k.label} style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:8, padding:"14px 10px", textAlign:"center" }}>
            <div style={{ fontSize:22 }}>{k.icon}</div>
            <div style={{ fontSize:20, fontWeight:700, color:k.color }}>{k.value}</div>
            <div style={{ fontSize:11, color:C.muted }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:14 }}>
        <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>By Category</div>
          {Object.keys(byCat).length === 0
            ? <div style={{ textAlign:"center", padding:"32px 0", color:C.muted, fontSize:13 }}>데이터 없음</div>
            : <Doughnut data={{
                labels: Object.keys(byCat).map(k => REQ_CATEGORIES[k]?.label || k),
                datasets: [{ data:Object.values(byCat), backgroundColor:["#1d4ed8","#16a34a","#d97706","#9333ea"] }],
              }} options={{ plugins:{ legend:{ position:"bottom" } }, maintainAspectRatio:true }} />
          }
        </div>
        <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Top Request Types</div>
          {byType.length === 0
            ? <div style={{ textAlign:"center", padding:"32px 0", color:C.muted, fontSize:13 }}>데이터 없음</div>
            : <Bar data={{
                labels: byType.map(([t]) => REQ_TYPES[t]?.label || t),
                datasets: [{ data:byType.map(([,v])=>v), backgroundColor:"#1d4ed8" }],
              }} options={{ indexAxis:"y", plugins:{ legend:{ display:false } }, maintainAspectRatio:true }} />
          }
        </div>
      </div>

      {byPerson.length > 0 && (
        <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Top Requesters</div>
          {byPerson.map((p, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <span style={{ fontSize:12, color:C.muted, width:16, textAlign:"right" }}>{i+1}</span>
              <div style={{ flex:1, fontSize:13 }}>{p.name}</div>
              <div style={{ height:8, borderRadius:4, background:C.primaryLight, width:`${Math.round(p.count/byPerson[0].count*100)}%`, minWidth:24 }} />
              <span style={{ fontSize:12, fontWeight:600, color:C.primary, width:24, textAlign:"right" }}>{p.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
