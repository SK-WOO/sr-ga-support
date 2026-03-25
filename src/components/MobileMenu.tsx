import { useState } from "react";
import { C, SR_GATE_URL, MANUAL_URL_KO, MANUAL_URL_EN } from "../constants";

export default function MobileMenu({ user, onLogout }) {
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
            <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8 }}>
              {user.picture && <img src={user.picture} alt="" style={{ width:28, height:28, borderRadius:"50%" }} referrerPolicy="no-referrer" />}
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{user.name}</div>
                <div style={{ fontSize:11, color:C.muted }}>{user.email}</div>
              </div>
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
