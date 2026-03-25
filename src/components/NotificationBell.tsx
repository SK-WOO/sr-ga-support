import { useState } from "react";
import { C } from "../constants";
import { post } from "../api/client";

export default function NotificationBell({ notifications, onRead, onSelectRequest, meEmail }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n => String(n.read) !== "true").length;

  const handleClick = async (notif) => {
    setOpen(false);
    if (String(notif.read) !== "true") {
      await post({ action: "mark_read", notificationId: String(notif.id), callerEmail: meEmail });
      onRead(notif.id);
    }
    if (notif.requestId) onSelectRequest(notif.requestId);
  };

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(p => !p)}
        style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff",
          padding:"4px 10px", borderRadius:4, cursor:"pointer", fontSize:16, position:"relative" }}>
        🔔
        {unread > 0 && (
          <span style={{ position:"absolute", top:-4, right:-4, background:C.danger, color:"#fff",
            borderRadius:10, padding:"0 5px", fontSize:10, fontWeight:700, minWidth:16, textAlign:"center" }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:"fixed", inset:0, zIndex:199 }} />
          <div style={{ position:"absolute", right:0, top:"calc(100% + 6px)", background:"#fff",
            borderRadius:8, boxShadow:"0 8px 24px rgba(0,0,0,.2)", zIndex:200, width:320, overflow:"hidden" }}>
            <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, fontWeight:700, fontSize:13 }}>
              알림 {unread > 0 && <span style={{ color:C.danger, fontWeight:400, fontSize:11 }}>({unread}개 미읽음)</span>}
            </div>
            <div style={{ maxHeight:360, overflowY:"auto" }}>
              {notifications.length === 0 ? (
                <div style={{ padding:"24px", textAlign:"center", color:C.muted, fontSize:13 }}>알림 없음</div>
              ) : (
                notifications.slice(0, 20).map(n => {
                  const isRead = String(n.read) === "true";
                  return (
                    <div key={n.id} onClick={() => handleClick(n)}
                      style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, cursor:"pointer",
                        background:isRead ? "#fff" : C.primaryLight }}
                      onMouseOver={e => e.currentTarget.style.background = C.grayLight}
                      onMouseOut={e  => e.currentTarget.style.background = isRead ? "#fff" : C.primaryLight}>
                      <div style={{ fontSize:13, fontWeight:isRead ? 400 : 600, color:C.text }}>{n.title}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{n.message}</div>
                      <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
