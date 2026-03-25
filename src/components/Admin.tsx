import { useState, useEffect } from "react";
import { C, REQ_TYPES, DEFAULT_CHAINS } from "../constants";
import Btn from "./ui/Btn";
import { Fld, Inp } from "./ui/Fld";

export default function Admin({ quotas, roster, onSaveQuotas }) {
  const [sub,    setSub]    = useState("assignees");
  const [lq,     setLq]     = useState(() => JSON.parse(JSON.stringify(quotas || {})));
  const [saving, setSaving] = useState(false);

  useEffect(() => setLq(JSON.parse(JSON.stringify(quotas || {}))), [quotas]);

  const setQ  = (k, v) => setLq(p => ({ ...p, [k]: v }));
  const save  = async () => { setSaving(true); await onSaveQuotas(lq); setSaving(false); };
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
          <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8, padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8 }}>
            <input type="checkbox" id="emailNotif" checked={!!lq.emailNotifications}
              onChange={e => setQ("emailNotifications", e.target.checked)}
              style={{ width:16, height:16, cursor:"pointer" }} />
            <label htmlFor="emailNotif" style={{ fontSize:13, cursor:"pointer", userSelect:"none" }}>
              이메일 알림 활성화 (GmailApp — 일 100통 제한)
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
