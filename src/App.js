/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Chart as ChartJS,
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
ChartJS.register(ArcElement, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const VERSION         = "v0.3.2";
const BUILD_DATE      = "2026-03-18";
const SR_GATE_URL     = "https://sr-gate.vercel.app";
const MANUAL_URL_EN   = "https://seoulrobotics.atlassian.net/wiki/spaces/~7120204b7d273e948148e7a6e61c8a943425b1/pages/3879501832";
const MANUAL_URL_KO   = "https://seoulrobotics.atlassian.net/wiki/spaces/~7120204b7d273e948148e7a6e61c8a943425b1/pages/3879501832";
const APPS_SCRIPT_URL = process.env.REACT_APP_SCRIPT_URL || "";
const CLIENT_ID       = process.env.REACT_APP_CLIENT_ID  || "";

const REQ_CATEGORIES = {
  general:   { label:"General Request",  icon:"📋", types:["business_card","onboarding_item","onboarding_account","offboarding_item","offboarding_account","corporate_card"] },
  travel:    { label:"Business Travel",  icon:"✈️", types:["domestic_trip","overseas_trip"] },
  breakdown: { label:"Breakdown Report", icon:"🔧", types:["asset_breakdown","facility_breakdown","it_breakdown","item_breakdown"] },
  rental:    { label:"Rental Request",   icon:"📦", types:["car_rental","rnd_item","equipment_rental"] },
};

const REQ_TYPES = {
  business_card:       { label:"Business Card",           cat:"general",   icon:"🪪" },
  onboarding_item:     { label:"Onboarding Items",        cat:"general",   icon:"🎁" },
  onboarding_account:  { label:"Onboarding Account",      cat:"general",   icon:"🔑" },
  offboarding_item:    { label:"Offboarding Item Return", cat:"general",   icon:"↩️" },
  offboarding_account: { label:"Offboarding Account",     cat:"general",   icon:"🔐" },
  corporate_card:      { label:"Corporate Card",          cat:"general",   icon:"💳" },
  domestic_trip:       { label:"Domestic Trip",           cat:"travel",    icon:"🚆" },
  overseas_trip:       { label:"Overseas Trip",           cat:"travel",    icon:"✈️" },
  asset_breakdown:     { label:"Asset Breakdown",         cat:"breakdown", icon:"💻" },
  facility_breakdown:  { label:"Facility Breakdown",      cat:"breakdown", icon:"🏢" },
  it_breakdown:        { label:"IT Breakdown",            cat:"breakdown", icon:"🖥️" },
  item_breakdown:      { label:"Item Breakdown",          cat:"breakdown", icon:"📦" },
  car_rental:          { label:"Company Car Rental",      cat:"rental",    icon:"🚗" },
  rnd_item:            { label:"R&D Item Request",        cat:"rental",    icon:"🔬" },
  equipment_rental:    { label:"Equipment Rental",        cat:"rental",    icon:"🪑" },
};

const DEFAULT_CHAINS = {
  business_card:["assignee"], onboarding_item:["assignee"],
  onboarding_account:["assignee"], offboarding_item:["assignee"],
  offboarding_account:["assignee"], corporate_card:["manager","ceo","assignee"],
  domestic_trip:["manager","assignee"], overseas_trip:["manager","ceo","assignee"],
  asset_breakdown:["assignee"], facility_breakdown:["assignee"],
  it_breakdown:["assignee"], item_breakdown:["assignee"],
  car_rental:["assignee"], rnd_item:["assignee"], equipment_rental:["assignee"],
};

const ONBOARDING_ITEMS = ["PC / Laptop","Monitor","Uniform","Sticker","Crocs","Desk Chair","Access Card","Other"];
const TRAVEL_SUBS_DOMESTIC = ["Airfare","Hotel","Transportation","Other","Expense Claim"];
const TRAVEL_SUBS_OVERSEAS = ["Airfare","Hotel","Transportation","Other","Expense Claim"];

const C = {
  primary:"#1d4ed8", primaryLight:"#dbeafe",
  danger:"#dc2626",  dangerLight:"#fee2e2",
  success:"#16a34a", successLight:"#dcfce7",
  warning:"#d97706", warningLight:"#fef3c7",
  purple:"#7c3aed",  purpleLight:"#ede9fe",
  gray:"#6b7280",    grayLight:"#f3f4f6",
  border:"#e5e7eb",  text:"#111827", muted:"#6b7280",
  bg:"#f9fafb",      white:"#ffffff",
};

const STATUS = {
  pending:     { bg:"#fef9c3", color:"#854d0e", label:"Pending"     },
  in_progress: { bg:"#dbeafe", color:"#1e40af", label:"In Progress" },
  approved:    { bg:"#dcfce7", color:"#15803d", label:"Approved"    },
  rejected:    { bg:"#fee2e2", color:"#b91c1c", label:"Rejected"    },
  completed:   { bg:"#f0fdf4", color:"#166534", label:"Completed"   },
  cancelled:   { bg:"#f3f4f6", color:"#6b7280", label:"Cancelled"   },
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
function useIsMobile(bp=680) {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w < bp;
}

function buildOAuthUrl() {
  const arr   = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const nonce = Array.from(arr, b => b.toString(16).padStart(2,"0")).join("");
  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: window.location.origin,
    response_type: "id_token", scope: "openid email profile", nonce,
  })}`;
}

// FIX 2: parse JSON string fields (attachments/items) coming from Sheets
function parseJsonField(val) {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
function useAuth() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ga_user") || "null"); } catch { return null; }
  });
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace("#", "?").slice(1));
    const tok = hash.get("id_token");
    if (tok) {
      try {
        const p = JSON.parse(atob(tok.split(".")[1]));
        if (p?.email && p.email.endsWith("@seoulrobotics.org") && (!p.exp || p.exp * 1000 > Date.now())) {
          const u = { name: p.name, email: p.email, picture: p.picture };
          setUser(u);
          localStorage.setItem("ga_user", JSON.stringify(u));
        }
      } catch {}
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const logout = useCallback(() => { localStorage.removeItem("ga_user"); setUser(null); }, []);
  return { user, logout };
}

// ─── API ─────────────────────────────────────────────────────────────────────
const API_TOKEN = process.env.REACT_APP_API_TOKEN || "";

const post = body => fetch(APPS_SCRIPT_URL, {
  method: "POST", redirect: "follow",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify(API_TOKEN ? { ...body, token: API_TOKEN } : body),
}).then(r => r.json());

const get = action =>
  fetch(`${APPS_SCRIPT_URL}?action=${action}${API_TOKEN ? `&token=${API_TOKEN}` : ""}`, { redirect: "follow" })
    .then(r => r.json());

// FIX 1: was "base64Data" — must be "base64" to match Code.gs body.base64
async function uploadFileViaScript(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      try {
        const res = await post({ action:"upload_file", fileName:file.name, mimeType:file.type, base64 });
        if (res.ok) resolve({ url:res.url, name:file.name });
        else reject(new Error(res.error || "Upload failed"));
      } catch (err) { reject(err); }
    };
    reader.readAsDataURL(file);
  });
}

// ─── SMALL UI ────────────────────────────────────────────────────────────────
function Badge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return <span style={{ padding:"2px 8px", borderRadius:12, background:s.bg, color:s.color, fontSize:11, fontWeight:600 }}>{s.label}</span>;
}

function Btn({ onClick, children, variant="primary", disabled, style={} }) {
  const v = {
    primary: { background:C.primary, color:"#fff" },
    danger:  { background:C.danger,  color:"#fff" },
    success: { background:C.success, color:"#fff" },
    outline: { background:"#fff",    color:C.primary, border:`1px solid ${C.primary}` },
    gray:    { background:C.grayLight, color:C.text },
  }[variant] || {};
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding:"8px 16px", borderRadius:6, border:"none", cursor:"pointer",
        fontWeight:600, fontSize:13, opacity:disabled ? .5 : 1, ...v, ...style }}>
      {children}
    </button>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg    = type === "error" ? C.dangerLight  : type === "success" ? C.successLight : "#f0f9ff";
  const color = type === "error" ? C.danger       : type === "success" ? C.success      : C.primary;
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, background:bg, color,
      border:`1px solid ${color}`, borderRadius:8, padding:"12px 16px", maxWidth:320,
      boxShadow:"0 4px 12px rgba(0,0,0,.15)", fontSize:14, display:"flex", gap:8 }}>
      <span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color, fontWeight:700 }}>×</button>
    </div>
  );
}

function Modal({ title, onClose, children, width=520 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:12, width:"100%", maxWidth:width,
        maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"16px 20px", borderBottom:`1px solid ${C.border}`,
          position:"sticky", top:0, background:"#fff", zIndex:1 }}>
          <strong style={{ fontSize:16 }}>{title}</strong>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:C.gray }}>×</button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  );
}

function Fld({ label, required, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ fontSize:12, fontWeight:600, color:C.muted, display:"block", marginBottom:4 }}>
        {label}{required && <span style={{ color:C.danger }}> *</span>}
      </label>}
      {children}
    </div>
  );
}

const inputStyle = { width:"100%", border:`1px solid ${C.border}`, borderRadius:6,
  padding:"8px 10px", fontSize:13, boxSizing:"border-box", background:"#fff" };

function Inp({ value, onChange, placeholder, type="text", style={} }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    type={type} style={{ ...inputStyle, ...style }} />;
}

function Sel({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  );
}

function Txa({ value, onChange, placeholder, rows=3 }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    rows={rows} style={{ ...inputStyle, resize:"vertical" }} />;
}

function ReqCard({ req, roster, onClick }) {
  const t = REQ_TYPES[req.type] || {};
  const applicant = roster.find(r => String(r.id) === String(req.applicantId));
  return (
    <div onClick={onClick}
      style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:8,
        padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}
      onMouseOver={e => e.currentTarget.style.borderColor = C.primary}
      onMouseOut={e => e.currentTarget.style.borderColor = C.border}>
      <span style={{ fontSize:22 }}>{t.icon || "📋"}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{req.title}</div>
        <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
          {t.label}{applicant && applicant.email !== req.applicantEmail ? ` · ${applicant.name}` : ""}
          {" · "}{req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : ""}
        </div>
      </div>
      <Badge status={req.status} />
    </div>
  );
}

// ─── PROGRESS BOARD ──────────────────────────────────────────────────────────
function resolveHolder(role, reqType, applicantId, roster, quotas) {
  if (role === "assignee") {
    const emails = (quotas?.assignees?.[reqType] || []);
    if (emails.length === 0) return "담당자 미지정";
    return emails.map(e => {
      const r = roster.find(u => u.email === e);
      return r ? r.name : e.split("@")[0];
    }).join(", ");
  }
  if (role === "manager") {
    const ap = roster.find(r => String(r.id) === String(applicantId));
    const mg = ap ? roster.find(r => String(r.id) === String(ap.managerId)) : null;
    return mg ? mg.name : "매니저 미지정";
  }
  if (role === "ceo") {
    const ceo = roster.find(r => r.email === (quotas?.ceoEmail || ""));
    return ceo ? ceo.name : "CEO";
  }
  return role;
}

function ProgressBoard({ requests, roster, quotas, onSelect }) {
  const active = requests
    .filter(r => r.status === "pending" || r.status === "in_progress")
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  if (active.length === 0) return null;

  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:8, color:C.text }}>
        진행 중인 요청 <span style={{ fontWeight:400, color:C.muted }}>({active.length})</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {active.map(r => {
          const t     = REQ_TYPES[r.type] || {};
          const chain = (quotas?.approvalChains?.[r.type]) || DEFAULT_CHAINS[r.type] || ["assignee"];
          const step  = r.currentStep || 0;
          const sub    = new Date(r.submittedAt);
          const diffMs = Date.now() - sub;
          const diffH  = Math.floor(diffMs / 3600000);
          const diffD  = Math.floor(diffMs / 86400000);
          const sameDay = new Date().toDateString() === sub.toDateString();
          const waitLabel = sameDay ? (diffH > 0 ? `${diffH}h 경과` : "방금 전") : `${diffD}일 경과`;
          return (
            <div key={r.id} onClick={() => onSelect(r)}
              style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:10,
                padding:"12px 14px", cursor:"pointer" }}
              onMouseOver={e => e.currentTarget.style.borderColor = C.primary}
              onMouseOut={e  => e.currentTarget.style.borderColor = C.border}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                  <span style={{ fontSize:18 }}>{t.icon || "📋"}</span>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.title}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{t.label} · {waitLabel}</div>
                  </div>
                </div>
                <Badge status={r.status} />
              </div>
              <div style={{ display:"flex", alignItems:"flex-start", gap:4 }}>
                {chain.map((role, i) => {
                  const done   = i < step;
                  const active = i === step;
                  const holder = resolveHolder(role, r.type, r.applicantId, roster, quotas);
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:4, flex:1, minWidth:0 }}>
                      <div style={{ flex:1, minWidth:0, textAlign:"center" }}>
                        <div style={{ padding:"3px 6px", borderRadius:8, fontSize:11, fontWeight:600, marginBottom:3,
                          background:done?C.successLight:active?C.primaryLight:C.grayLight,
                          color:done?C.success:active?C.primary:C.muted,
                          border:`1px solid ${done?C.success:active?C.primary:C.border}` }}>
                          {done ? "✓ " : active ? "● " : ""}{role.charAt(0).toUpperCase()+role.slice(1)}
                        </div>
                        <div style={{ fontSize:10, color:done?C.success:active?C.primary:C.muted,
                          fontWeight:active?600:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {holder}
                        </div>
                      </div>
                      {i < chain.length - 1 && (
                        <div style={{ fontSize:10, color:done?C.success:C.border, flexShrink:0, marginBottom:14 }}>→</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({ requests, roster, meEmail, quotas, onNew, onSelect }) {
  const isMobile = useIsMobile();
  const rosterMe = roster.find(r => r.email === meEmail);

  const mine      = useMemo(() => requests.filter(r => r.applicantEmail === meEmail), [requests, meEmail]);
  const myPending = mine.filter(r => r.status === "pending" || r.status === "in_progress");
  const myDone    = mine.filter(r => r.status === "completed" || r.status === "approved");
  const myRecent  = [...mine].sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0,5);

  const myTeam = useMemo(() =>
    roster.filter(r => String(r.managerId) === String(rosterMe?.id) && r.email !== meEmail)
  , [roster, rosterMe, meEmail]);

  const teamReqs = useMemo(() =>
    requests.filter(r => myTeam.some(t => t.email === r.applicantEmail))
      .sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt))
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
            No requests yet — <button onClick={onNew} style={{ background:"none", border:"none", color:C.primary, cursor:"pointer", fontWeight:600, fontSize:13 }}>submit your first one</button>
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
              {teamReqs.slice(0,10).map(r => <ReqCard key={r.id} req={r} roster={roster} onClick={() => onSelect(r)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── NEW REQUEST MODAL ───────────────────────────────────────────────────────
// FIX 7: "on behalf of" Admin only
// FIX 9: single onSubmit(data, targets) call — loop & notify in App
function NewRequestModal({ onClose, onSubmit, roster, quotas, user, meEmail }) {
  const [step,     setStep]     = useState(1);
  const [cat,      setCat]      = useState("");
  const [type,     setType]     = useState("");
  const [form,     setForm]     = useState({});
  const [files,      setFiles]      = useState([]);
  const [busy,       setBusy]       = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState("");
  const [onBehalf,   setOnBehalf]   = useState(false);
  const [targets,  setTargets]  = useState([]);
  const fileRef = useRef();

  const isAdmin = (quotas?.adminEmails || []).includes(meEmail) || meEmail === (quotas?.ceoEmail || "");
  const set = (k, v) => setForm(p => ({ ...p, [k]:v }));
  const selectType = (t) => { setType(t); setForm({}); setFiles([]); setStep(3); };

  const typeInfo   = type ? REQ_TYPES[type] : null;
  const catTypes   = cat ? REQ_CATEGORIES[cat]?.types.map(t => ({ value:t, ...REQ_TYPES[t] })) : [];
  const needAttach  = form.subType === "Expense Claim";
  const isTravel    = type === "domestic_trip" || type === "overseas_trip";
  const isRental    = type === "car_rental" || type === "equipment_rental" || type === "rnd_item";
  const isBreakdown = cat === "breakdown";
  const canSubmit   = type && form.title
    && !(needAttach && files.length === 0)
    && !(isTravel    && (!form.subType || !form.startDate || !form.endDate || !form.destination))
    && !(isRental    && (!form.startDate || !form.endDate))
    && !(isBreakdown && !form.asset);
  const rosterOthers = roster.filter(r => r.email && r.email !== meEmail);
  const toggleTarget = (email) => setTargets(p => p.includes(email) ? p.filter(e => e !== email) : [...p, email]);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        setUploadMsg(`파일 업로드 중 (${i+1}/${files.length})...`);
        try { const r = await uploadFileViaScript(files[i]); uploaded.push(r); }
        catch { uploaded.push({ url:"", name:files[i].name }); }
      }
      setUploadMsg("");
      const attachments = uploaded.map(u => ({ url:u.url, name:u.name })).filter(u => u.url);
      const baseData = { type, category:cat, ...form, attachments };
      await onSubmit(baseData, onBehalf && targets.length > 0 ? targets : []);
      onClose();
    } catch(e) { alert("Submit failed: " + e.message); }
    finally { setBusy(false); }
  };

  if (step === 1) return (
    <Modal title="New Request — Category" onClose={onClose}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {Object.entries(REQ_CATEGORIES).map(([k, c]) => (
          <button key={k} onClick={() => { setCat(k); setStep(2); }}
            style={{ padding:"18px 12px", border:`2px solid ${C.border}`, borderRadius:10, background:"#fff", cursor:"pointer", textAlign:"center" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.background = C.primaryLight; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "#fff"; }}>
            <div style={{ fontSize:28, marginBottom:6 }}>{c.icon}</div>
            <div style={{ fontWeight:700, fontSize:13 }}>{c.label}</div>
          </button>
        ))}
      </div>
    </Modal>
  );

  if (step === 2) return (
    <Modal title={REQ_CATEGORIES[cat]?.label} onClose={onClose}>
      <button onClick={() => setStep(1)} style={{ background:"none", border:"none", color:C.primary, cursor:"pointer", marginBottom:12, fontSize:13 }}>← Back</button>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {catTypes.map(t => (
          <button key={t.value} onClick={() => selectType(t.value)}
            style={{ padding:"12px 14px", border:`1px solid ${C.border}`, borderRadius:8, background:"#fff", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:10 }}
            onMouseOver={e => e.currentTarget.style.background = C.primaryLight}
            onMouseOut={e => e.currentTarget.style.background = "#fff"}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span style={{ fontWeight:600, fontSize:14 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );

  return (
    <Modal title={`${typeInfo?.icon} ${typeInfo?.label}`} onClose={onClose} width={560}>
      <button onClick={() => setStep(2)} style={{ background:"none", border:"none", color:C.primary, cursor:"pointer", marginBottom:12, fontSize:13 }}>← Back</button>

      <Fld label="Title / Summary" required>
        <Inp value={form.title || ""} onChange={v => set("title", v)} placeholder="Brief description" />
      </Fld>

      {type === "onboarding_item" && (
        <Fld label="Items Needed">
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {ONBOARDING_ITEMS.map(item => {
              const on = (form.items || []).includes(item);
              return (
                <button key={item} onClick={() => set("items", on ? (form.items||[]).filter(i=>i!==item) : [...(form.items||[]), item])}
                  style={{ padding:"4px 10px", borderRadius:16, border:`1px solid ${on?C.primary:C.border}`,
                    background:on?C.primaryLight:"#fff", cursor:"pointer", fontSize:12, fontWeight:on?600:400 }}>
                  {item}
                </button>
              );
            })}
          </div>
        </Fld>
      )}

      {(type === "domestic_trip" || type === "overseas_trip") && (
        <>
          <Fld label="Travel Support Type" required>
            <Sel value={form.subType || ""} onChange={v => set("subType", v)}
              options={type === "overseas_trip" ? TRAVEL_SUBS_OVERSEAS : TRAVEL_SUBS_DOMESTIC} placeholder="Select..." />
          </Fld>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Fld label="Departure" required><Inp type="date" value={form.startDate||""} onChange={v=>set("startDate",v)} /></Fld>
            <Fld label="Return"    required><Inp type="date" value={form.endDate||""}   onChange={v=>set("endDate",v)}   /></Fld>
          </div>
          <Fld label="Destination" required>
            <Inp value={form.destination||""} onChange={v=>set("destination",v)}
              placeholder={type==="overseas_trip"?"e.g. Tokyo, Japan":"e.g. Busan"} />
          </Fld>
          {form.subType === "Expense Claim" && (
            <Fld label="Amount (KRW)" required>
              <Inp type="number" value={form.amount||""} onChange={v=>set("amount",v)} placeholder="0" />
            </Fld>
          )}
        </>
      )}

      {(type === "car_rental" || type === "equipment_rental" || type === "rnd_item") && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Fld label="From" required><Inp type="date" value={form.startDate||""} onChange={v=>set("startDate",v)} /></Fld>
          <Fld label="To"   required><Inp type="date" value={form.endDate||""}   onChange={v=>set("endDate",v)}   /></Fld>
        </div>
      )}

      {cat === "breakdown" && (
        <Fld label="Asset / Location" required>
          <Inp value={form.asset||""} onChange={v=>set("asset",v)} placeholder="e.g. MacBook SN:XXX / Meeting Room B" />
        </Fld>
      )}

      <Fld label="Details / Notes">
        <Txa value={form.notes||""} onChange={v=>set("notes",v)} placeholder="Additional details..." />
      </Fld>

      <Fld label={`Attachments${needAttach?" (required)":""}`}>
        <div style={{ border:`1px dashed ${C.border}`, borderRadius:8, padding:12,
          background:C.grayLight, cursor:"pointer", textAlign:"center" }}
          onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" multiple style={{ display:"none" }}
            onChange={e => setFiles(Array.from(e.target.files))} />
          <div style={{ fontSize:12, color:C.muted }}>
            {files.length > 0 ? files.map(f => f.name).join(", ") : "Click to attach receipts / photos"}
          </div>
        </div>
      </Fld>

      {/* FIX 7: Admin only */}
      {isAdmin && roster.length > 0 && (
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12, marginTop:4 }}>
          <button onClick={() => setOnBehalf(p => !p)}
            style={{ background:"none", border:"none", cursor:"pointer", color:C.primary, fontSize:12, fontWeight:600, padding:0 }}>
            {onBehalf ? "▼" : "▶"} Submit on behalf of others
          </button>
          {onBehalf && (
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Select team members:</div>
              <div style={{ maxHeight:160, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:6 }}>
                {rosterOthers.map(r => (
                  <label key={r.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
                    cursor:"pointer", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                    <input type="checkbox" checked={targets.includes(r.email)} onChange={() => toggleTarget(r.email)} />
                    <span>{r.name}</span>
                    <span style={{ color:C.muted, fontSize:11 }}>{r.team}</span>
                  </label>
                ))}
              </div>
              {targets.length > 0 && (
                <div style={{ fontSize:11, color:C.primary, marginTop:4, fontWeight:600 }}>
                  {targets.length}명: {targets.map(e => roster.find(r=>r.email===e)?.name||e).join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:14 }}>
        <Btn variant="gray" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSubmit} disabled={!canSubmit || busy}>
          {uploadMsg || (busy ? "Submitting..." : onBehalf && targets.length > 0 ? `Submit for ${targets.length} people` : "Submit Request")}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── REQUEST DETAIL ──────────────────────────────────────────────────────────
function RequestDetail({ req, onClose, onAction, meEmail, roster, quotas }) {
  const [comment,     setComment]     = useState("");
  const [busy,        setBusy]        = useState(false);
  const [confirmAppr, setConfirmAppr] = useState(false);

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

  // FIX 2: parse JSON string fields from Sheets
  const attachments = parseJsonField(req.attachments);
  const items       = parseJsonField(req.items);

  const act = async (action) => {
    setBusy(true);
    try {
      await onAction({ action, id:req.id, comment, step, role:curRole });
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

      {/* FIX 6: show filename */}
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

      {myTurn && (
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12, marginTop:4 }}>
          <Fld label="Comment (반려 시 필수)">
            <Txa value={comment} onChange={setComment} placeholder="Add a comment..." rows={2} />
          </Fld>
          {confirmAppr ? (
            <div style={{ background:C.primaryLight, borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>승인하시겠습니까?</div>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <Btn variant="gray" onClick={() => setConfirmAppr(false)} disabled={busy}>취소</Btn>
                <Btn onClick={() => act("approve")} disabled={busy}>
                  {busy ? "..." : "확인"}
                </Btn>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <Btn variant="danger" onClick={() => act("reject")} disabled={busy || !comment.trim()}>Reject</Btn>
              <Btn onClick={() => setConfirmAppr(true)} disabled={busy}>
                {step === chain.length - 1 ? "Complete" : "Approve →"}
              </Btn>
            </div>
          )}
        </div>
      )}

      {isSelf && (req.status === "pending" || req.status === "in_progress") && (
        <div style={{ marginTop:12, textAlign:"right" }}>
          <Btn variant="outline" onClick={() => act("cancel")} disabled={busy}>Withdraw</Btn>
        </div>
      )}
    </Modal>
  );
}

// ─── MY REQUESTS ─────────────────────────────────────────────────────────────
function MyRequests({ requests, meEmail, roster, onNew, onSelect }) {
  const [filter,  setFilter]  = useState("all");
  const [search,  setSearch]  = useState("");
  const [typeF,   setTypeF]   = useState("all");

  const mine = useMemo(() =>
    requests.filter(r => r.applicantEmail === meEmail)
      .sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt))
  , [requests, meEmail]);

  const list = useMemo(() => mine.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (typeF   !== "all" && r.type   !== typeF)  return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!r.title?.toLowerCase().includes(q) && !REQ_TYPES[r.type]?.label.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [mine, filter, typeF, search]);

  const usedTypes = useMemo(() => [...new Set(mine.map(r => r.type))], [mine]);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>My Requests</h2>
        <Btn onClick={onNew}>+ New Request</Btn>
      </div>
      <div style={{ marginBottom:10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="제목 또는 유형 검색..."
          style={{ ...inputStyle, marginBottom:8 }} />
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
          {["all","pending","in_progress","completed","rejected","cancelled"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding:"3px 11px", borderRadius:16,
                border:`1px solid ${filter===s?C.primary:C.border}`,
                background:filter===s?C.primary:"#fff", color:filter===s?"#fff":C.text,
                cursor:"pointer", fontSize:12, fontWeight:600 }}>
              {s === "all" ? "All Status" : STATUS[s]?.label || s}
            </button>
          ))}
        </div>
        {usedTypes.length > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <button onClick={() => setTypeF("all")}
              style={{ padding:"3px 11px", borderRadius:16,
                border:`1px solid ${typeF==="all"?C.purple:C.border}`,
                background:typeF==="all"?C.purple:"#fff", color:typeF==="all"?"#fff":C.text,
                cursor:"pointer", fontSize:12, fontWeight:600 }}>All Types</button>
            {usedTypes.map(t => (
              <button key={t} onClick={() => setTypeF(t)}
                style={{ padding:"3px 11px", borderRadius:16,
                  border:`1px solid ${typeF===t?C.purple:C.border}`,
                  background:typeF===t?C.purple:"#fff", color:typeF===t?"#fff":C.text,
                  cursor:"pointer", fontSize:12, fontWeight:600 }}>
                {REQ_TYPES[t]?.icon} {REQ_TYPES[t]?.label || t}
              </button>
            ))}
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted, background:C.grayLight, borderRadius:10 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📭</div><div>No requests found</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {list.map(r => <ReqCard key={r.id} req={r} roster={roster} onClick={() => onSelect(r)} />)}
        </div>
      )}
    </div>
  );
}

// ─── APPROVALS ───────────────────────────────────────────────────────────────
function Approvals({ requests, meEmail, roster, quotas, onSelect }) {
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
    }).sort((a,b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  }, [requests, meEmail, roster, quotas, rosterMe, isCEO]);

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
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {pending.map(r => {
            const t         = REQ_TYPES[r.type] || {};
            const applicant = roster.find(u => String(u.id) === String(r.applicantId));
            const waitH     = Math.floor((Date.now() - new Date(r.submittedAt)) / 3600000);
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
      )}
    </div>
  );
}

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
// FIX 3: Admin/Manager sees all; others see only their own
// FIX 4: mobile → 1 column charts
function Analytics({ requests, roster, meEmail, quotas }) {
  const isMobile = useIsMobile();
  const [range, setRange] = useState("30");

  const isAdmin   = (quotas?.adminEmails || []).includes(meEmail) || meEmail === (quotas?.ceoEmail || "");
  const rosterMe  = roster.find(r => r.email === meEmail);
  const isManager = rosterMe && roster.some(r => String(r.managerId) === String(rosterMe.id));
  const canSeeAll = isAdmin || isManager;

  const source  = canSeeAll ? requests : requests.filter(r => r.applicantEmail === meEmail);
  const cutoff  = useMemo(() => new Date(Date.now() - Number(range) * 86400000), [range]);
  const inRange = useMemo(() => source.filter(r => new Date(r.submittedAt) >= cutoff), [source, cutoff]);

  const byCat    = useMemo(() => { const c={}; inRange.forEach(r=>{ const k=REQ_TYPES[r.type]?.cat||"other"; c[k]=(c[k]||0)+1; }); return c; }, [inRange]);
  const byType   = useMemo(() => { const c={}; inRange.forEach(r=>{ c[r.type]=(c[r.type]||0)+1; }); return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,8); }, [inRange]);
  const byStatus = useMemo(() => { const c={}; inRange.forEach(r=>{ c[r.status]=(c[r.status]||0)+1; }); return c; }, [inRange]);

  const byPerson = useMemo(() => {
    if (!canSeeAll) return [];
    const c = {};
    inRange.forEach(r => { c[r.applicantEmail] = (c[r.applicantEmail]||0)+1; });
    return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([email,count]) => {
      const member = roster.find(r => r.email === email);
      return { name: member?.name || email, count };
    });
  }, [inRange, roster, canSeeAll]);

  const total    = inRange.length;
  const approved = inRange.filter(r => r.status === "completed" || r.status === "approved").length;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Analytics</h2>
          {!canSeeAll && <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>My requests only</div>}
        </div>
        <select value={range} onChange={e => setRange(e.target.value)} style={{ ...inputStyle, width:"auto" }}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
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

      {/* FIX 4: 1 column on mobile */}
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

// ─── ADMIN ───────────────────────────────────────────────────────────────────
function Admin({ quotas, roster, onSaveQuotas }) {
  const [sub,    setSub]    = useState("assignees");
  const [lq,     setLq]     = useState(() => JSON.parse(JSON.stringify(quotas || {})));
  const [saving, setSaving] = useState(false);

  useEffect(() => setLq(JSON.parse(JSON.stringify(quotas || {}))), [quotas]);

  const setQ = (k, v) => setLq(p => ({ ...p, [k]:v }));
  const save = async () => { setSaving(true); await onSaveQuotas(lq); setSaving(false); };
  const SUBTABS = ["assignees","chains","roster","settings"];
  const ROLES   = ["manager","ceo","assignee"];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Admin</h2>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving..." : "Save All"}</Btn>
      </div>
      <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${C.border}`, marginBottom:16 }}>
        {SUBTABS.map(t => (
          <button key={t} onClick={() => setSub(t)}
            style={{ padding:"8px 14px", border:"none", background:"none", cursor:"pointer",
              fontWeight:sub===t?700:400, borderBottom:sub===t?`2px solid ${C.primary}`:"2px solid transparent",
              color:sub===t?C.primary:C.text, fontSize:13, textTransform:"capitalize" }}>{t}</button>
        ))}
      </div>

      {sub === "assignees" && (
        <div>
          <p style={{ fontSize:12, color:C.muted, marginTop:0 }}>Who handles each request type (comma-separated emails)</p>
          {Object.entries(REQ_TYPES).map(([k, t]) => {
            const a = lq.assignees || {};
            return (
              <div key={k} style={{ marginBottom:10, display:"grid", gridTemplateColumns:"220px 1fr", alignItems:"center", gap:10 }}>
                <div style={{ fontSize:13 }}><span style={{ marginRight:6 }}>{t.icon}</span>{t.label}</div>
                <Inp value={(a[k]||[]).join(", ")}
                  onChange={v => setQ("assignees", { ...a, [k]: v.split(",").map(e=>e.trim()).filter(Boolean) })}
                  placeholder="email@sr.ai, ..." />
              </div>
            );
          })}
        </div>
      )}

      {sub === "chains" && (
        <div>
          <p style={{ fontSize:12, color:C.muted, marginTop:0 }}>Toggle approval steps per request type</p>
          {Object.entries(REQ_TYPES).map(([k, t]) => {
            const ch    = lq.approvalChains || {};
            const chain = ch[k] || DEFAULT_CHAINS[k] || ["assignee"];
            return (
              <div key={k} style={{ marginBottom:10, padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>{t.icon} {t.label}</div>
                <div style={{ display:"flex", gap:6 }}>
                  {ROLES.map(role => {
                    const on = chain.includes(role);
                    return (
                      <button key={role} onClick={() => {
                        const base   = on ? chain.filter(r=>r!==role) : [...chain, role];
                        const sorted = [...["manager","ceo"].filter(r=>base.includes(r)), ...(base.includes("assignee")?["assignee"]:[])];
                        setQ("approvalChains", { ...ch, [k]: sorted.length > 0 ? sorted : ["assignee"] });
                      }} style={{ padding:"3px 10px", borderRadius:12, border:`1px solid ${on?C.primary:C.border}`,
                        background:on?C.primaryLight:"#fff", color:on?C.primary:C.gray, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                        {on ? "✓ " : ""}{role.charAt(0).toUpperCase()+role.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sub === "roster" && (
        <div style={{ overflowX:"auto" }}>
          <p style={{ fontSize:12, color:C.muted, marginTop:0 }}>Loaded from Sheets ROSTER tab (read-only here)</p>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead><tr style={{ background:C.grayLight }}>
              {["ID","Name","Email","Team","Manager ID"].map(h => (
                <th key={h} style={{ padding:"6px 10px", textAlign:"left", borderBottom:`1px solid ${C.border}`, fontWeight:600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {roster.map(r => (
                <tr key={r.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"6px 10px" }}>{r.id}</td>
                  <td style={{ padding:"6px 10px" }}>{r.name}</td>
                  <td style={{ padding:"6px 10px" }}>{r.email}</td>
                  <td style={{ padding:"6px 10px" }}>{r.team}</td>
                  <td style={{ padding:"6px 10px" }}>{r.managerId || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sub === "settings" && (
        <div>
          {[
            { label:"CEO Email",         key:"ceoEmail",       ph:"ceo@sr.ai" },
            { label:"Admin Emails",      key:"adminEmails_raw",ph:"admin1@sr.ai, admin2@sr.ai" },
            { label:"Slack Webhook URL", key:"slackWebhook",   ph:"https://hooks.slack.com/..." },
            { label:"App URL",           key:"appUrl",         ph:"https://sr-ga-support.vercel.app" },
            { label:"Drive Folder ID",   key:"driveFolderId",  ph:"Google Drive folder ID for attachments" },
          ].map(f => (
            <Fld key={f.key} label={f.label}>
              <Inp
                value={f.key === "adminEmails_raw" ? (lq.adminEmails||[]).join(", ") : lq[f.key] || ""}
                onChange={v => {
                  if (f.key === "adminEmails_raw") setQ("adminEmails", v.split(",").map(e=>e.trim()).filter(Boolean));
                  else setQ(f.key, v);
                }}
                placeholder={f.ph}
              />
            </Fld>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MOBILE MENU ─────────────────────────────────────────────────────────────
function MobileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(p => !p)}
        style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff",
          padding:"4px 10px", borderRadius:4, cursor:"pointer", fontSize:16 }}>⋯</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:"fixed", inset:0, zIndex:199 }} />
          <div style={{ position:"absolute", right:0, top:"calc(100% + 6px)", background:"#fff",
            borderRadius:8, boxShadow:"0 8px 24px rgba(0,0,0,.2)", zIndex:200, minWidth:160, overflow:"hidden" }}>
            <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, fontSize:12, fontWeight:600, color:C.muted }}>
              {user.name}
            </div>
            {[
              { label:"📖 Manual (KO)", href:MANUAL_URL_KO },
              { label:"📖 Manual (EN)", href:MANUAL_URL_EN },
              { label:"🏠 SR Gate",     href:SR_GATE_URL   },
            ].map(item => (
              <a key={item.label} href={item.href} target="_blank" rel="noreferrer"
                onClick={() => setOpen(false)}
                style={{ display:"block", padding:"10px 14px", fontSize:13, color:C.text,
                  textDecoration:"none", borderBottom:`1px solid ${C.border}` }}
                onMouseOver={e => e.currentTarget.style.background = C.grayLight}
                onMouseOut={e  => e.currentTarget.style.background = "#fff"}>
                {item.label}
              </a>
            ))}
            <button onClick={() => { setOpen(false); onLogout(); }}
              style={{ display:"block", width:"100%", padding:"10px 14px", fontSize:13, fontWeight:600,
                background:"none", border:"none", cursor:"pointer", textAlign:"left", color:C.danger }}>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();

  const [tab,      setTab]      = useState("dashboard");
  const [requests, setRequests] = useState([]);
  const [roster,   setRoster]   = useState([]);
  const [quotas,   setQuotas]   = useState({});
  const [toast,    setToast]    = useState(null);
  const [showNew,  setShowNew]  = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);

  const pendingIds = useRef(new Set());
  const initialLoad = useRef(true);
  const notify = useCallback((msg, type="info") => setToast({ msg, type }), []);

  const loadData = useCallback(async () => {
    if (!APPS_SCRIPT_URL) {
      if (initialLoad.current) { setLoading(false); initialLoad.current = false; }
      return;
    }
    try {
      const [rd, qd, rod] = await Promise.all([get("get_requests"), get("get_quotas"), get("get_roster")]);
      if (rd.ok)  setRequests(prev => (rd.data||[]).map(r => pendingIds.current.has(r.id) ? (prev.find(p=>p.id===r.id)||r) : r));
      if (qd.ok)  setQuotas(qd.data || {});
      if (rod.ok) setRoster(rod.data || []);
    } catch { notify("Sync failed", "error"); }
    finally { if (initialLoad.current) { setLoading(false); initialLoad.current = false; } }
  }, [notify]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    initialLoad.current = true;
    loadData();
    const t = setInterval(loadData, 30000);
    return () => clearInterval(t);
  }, [user, loadData]);

  useEffect(() => {
    if (!selected) return;
    const updated = requests.find(r => r.id === selected.id);
    if (updated && updated !== selected) setSelected(updated);
  }, [requests]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("new") === "1") { setShowNew(true); window.history.replaceState(null, "", window.location.pathname); }
  }, []);

  const meEmail = user?.email || "";
  const isAdmin = (quotas?.adminEmails || []).includes(meEmail) || meEmail === (quotas?.ceoEmail || "");

  const pendingCount = useMemo(() => {
    const rMe = roster.find(r => r.email === meEmail);
    return requests.filter(r => {
      if (r.status !== "pending" && r.status !== "in_progress") return false;
      if (r.applicantEmail === meEmail) return false;
      const chain = (quotas?.approvalChains?.[r.type]) || DEFAULT_CHAINS[r.type] || ["assignee"];
      const role  = chain[r.currentStep || 0];
      const ap    = roster.find(u => String(u.id) === String(r.applicantId));
      if (role === "assignee") return (quotas?.assignees?.[r.type] || []).includes(meEmail);
      if (role === "manager")  return rMe && String(rMe.id) === String(ap?.managerId);
      if (role === "ceo")      return meEmail === (quotas?.ceoEmail || "");
      return false;
    }).length;
  }, [requests, meEmail, roster, quotas]);

  // FIX 8: single handleSubmit — removed handleSubmitAll / handleSubmitWrapper
  // FIX 9: loop here → notify fires once
  // FIX 5: setTab("my") after success
  const handleSubmit = async (data, targets = []) => {
    const emailList = targets.length > 0 ? targets : [meEmail];
    let success = 0;
    for (const email of emailList) {
      const ap  = roster.find(r => r.email === email);
      const req = {
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        ...data,
        applicantEmail: email,
        applicantId:    ap?.id || "",
        status:         "pending",
        currentStep:    0,
        submittedAt:    new Date().toISOString(),
      };
      pendingIds.current.add(req.id);
      setRequests(prev => [req, ...prev]);
      try {
        const res = await post({ action:"save_request", data:req });
        if (!res.ok) throw new Error(res.error || "Failed");
        success++;
      } catch(e) {
        notify("Submit failed: " + e.message, "error");
        setRequests(prev => prev.filter(r => r.id !== req.id));
      } finally {
        pendingIds.current.delete(req.id);
      }
    }
    if (success > 0) {
      notify(success > 1 ? `${success}건 신청 완료!` : "신청이 접수됐습니다!", "success");
      setTab("my");
      setTimeout(loadData, 2000);
    }
  };

  const handleAction = async ({ action, id, comment, step, role }) => {
    pendingIds.current.add(id);
    const prev = requests;
    setRequests(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (action === "approve") {
        const chain = (quotas?.approvalChains?.[r.type]) || DEFAULT_CHAINS[r.type] || ["assignee"];
        const next  = step + 1;
        return { ...r, currentStep:next, status:next>=chain.length?"completed":"in_progress" };
      }
      if (action === "reject") return { ...r, status:"rejected"  };
      if (action === "cancel") return { ...r, status:"cancelled" };
      return r;
    }));
    try {
      const res = await post({ action:"update_request", id, decision:action, comment, step, role, callerEmail:meEmail });
      if (!res.ok) throw new Error(res.error || "Failed");
      notify(action==="approve"?"승인됐습니다!":action==="reject"?"반려됐습니다":"취소됐습니다", "success");
    } catch(e) {
      setRequests(prev);
      notify("Action failed: " + e.message, "error");
    }
    finally {
      pendingIds.current.delete(id);
      setTimeout(loadData, 2500);
    }
  };

  const handleSaveQuotas = async (data) => {
    try {
      const res = await post({ action:"save_quotas", data });
      if (!res.ok) throw new Error(res.error || "Failed");
      setQuotas(data);
      notify("Settings saved!", "success");
    } catch(e) { notify("Save failed: " + e.message, "error"); }
  };

  const TABS = [
    { key:"dashboard", label:"Dashboard",   icon:"🏠"                    },
    { key:"my",        label:"My Requests", icon:"📋"                    },
    { key:"approvals", label:"Approvals",   icon:"✅", badge:pendingCount },
    { key:"analytics", label:"Analytics",   icon:"📊"                    },
    ...(isAdmin ? [{ key:"admin", label:"Admin", icon:"⚙️" }] : []),
  ];

  if (user && loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg }}>
      <div style={{ textAlign:"center", color:C.muted }}>
        <div style={{ fontSize:32, marginBottom:12, animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</div>
        <div style={{ fontSize:13 }}>Loading...</div>
      </div>
    </div>
  );

  if (!user) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(135deg,#1d4ed8 0%,#0f172a 100%)" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:"40px 36px", width:"100%", maxWidth:380,
        textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,.4)" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🏢</div>
        <h1 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>SR GA Support</h1>
        <p style={{ color:C.muted, fontSize:13, margin:"0 0 28px" }}>Seoul Robotics General Affairs</p>
        <a href={buildOAuthUrl()}
          style={{ display:"block", background:C.primary, color:"#fff", padding:"12px 0",
            borderRadius:8, fontWeight:700, fontSize:14, textDecoration:"none" }}>
          Sign in with Google
        </a>
        <p style={{ color:C.muted, fontSize:11, marginTop:16 }}>{VERSION} · SR employees only</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ background:C.primary, color:"#fff", padding:"0 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between", height:52,
        position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>🏢</span>
          <strong style={{ fontSize:15 }}>SR GA Support</strong>
          <span style={{ fontSize:10, opacity:.6 }}>{VERSION} · {BUILD_DATE}</span>
        </div>
        {isMobile ? (
          <MobileMenu user={user} onLogout={logout} />
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12, opacity:.8 }}>{user.name}</span>
            <a href={MANUAL_URL_KO} target="_blank" rel="noreferrer"
              style={{ background:"rgba(255,255,255,.15)", color:"#fff", padding:"4px 10px", borderRadius:4, fontSize:11, textDecoration:"none" }}>📖 KO</a>
            <a href={MANUAL_URL_EN} target="_blank" rel="noreferrer"
              style={{ background:"rgba(255,255,255,.15)", color:"#fff", padding:"4px 10px", borderRadius:4, fontSize:11, textDecoration:"none" }}>📖 EN</a>
            <a href={SR_GATE_URL} target="_blank" rel="noreferrer"
              style={{ background:"rgba(255,255,255,.15)", color:"#fff", padding:"4px 10px", borderRadius:4, fontSize:11, textDecoration:"none" }}>🏠 Gate</a>
            <button onClick={logout}
              style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff", padding:"4px 10px", borderRadius:4, cursor:"pointer", fontSize:11 }}>Sign out</button>
          </div>
        )}
      </div>

      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, display:"flex", overflowX:"auto", padding:"0 16px" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:"12px 16px", border:"none", background:"none", cursor:"pointer", whiteSpace:"nowrap",
              fontWeight:tab===t.key?700:400,
              borderBottom:tab===t.key?`2px solid ${C.primary}`:"2px solid transparent",
              color:tab===t.key?C.primary:C.text, fontSize:13,
              display:"flex", alignItems:"center", gap:5 }}>
            <span>{t.icon}</span>
            {isMobile
              ? <span style={{ fontSize:10 }}>{t.label.split(" ")[0]}</span>
              : <span>{t.label}</span>}
            {t.badge > 0 && (
              <span style={{ background:C.danger, color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"20px 16px" }}>
        {tab === "dashboard" && (
          <Dashboard requests={requests} roster={roster} meEmail={meEmail} quotas={quotas}
            onNew={() => setShowNew(true)} onSelect={setSelected} />
        )}
        {tab === "my" && (
          <MyRequests requests={requests} meEmail={meEmail} roster={roster}
            onNew={() => setShowNew(true)} onSelect={setSelected} />
        )}
        {tab === "approvals" && (
          <Approvals requests={requests} meEmail={meEmail} roster={roster} quotas={quotas} onSelect={setSelected} />
        )}
        {tab === "analytics" && (
          <Analytics requests={requests} roster={roster} meEmail={meEmail} quotas={quotas} />
        )}
        {tab === "admin" && isAdmin && (
          <Admin quotas={quotas} roster={roster} onSaveQuotas={handleSaveQuotas} />
        )}
      </div>

      {showNew && (
        <NewRequestModal onClose={() => setShowNew(false)} onSubmit={handleSubmit}
          roster={roster} quotas={quotas} user={user} meEmail={meEmail} />
      )}
      {selected && (
        <RequestDetail req={selected} onClose={() => setSelected(null)} onAction={handleAction}
          meEmail={meEmail} roster={roster} quotas={quotas} />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
