/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { C, VERSION, BUILD_DATE, SR_GATE_URL, MANUAL_URL_KO, MANUAL_URL_EN, DEFAULT_CHAINS } from "./constants";
import useAuth, { buildOAuthUrl } from "./hooks/useAuth";
import { SRAuthGate } from "@sr/auth-gate";

const ACCESS_SHEET_ID = "11yfJSCpTuX6aoxLDoAlqgCP74JhMm5ukjqPdfgLY3xo";
import useIsMobile from "./hooks/useIsMobile";
import { post, get, APPS_SCRIPT_URL } from "./api/client";
import { useI18n } from "./i18n/useI18n";
import type { Quotas, Request, RosterMember, Notification } from "./types";

import Dashboard from "./components/Dashboard";
import MyRequests from "./components/MyRequests";
import Approvals from "./components/Approvals";
import Analytics from "./components/Analytics";
import Admin from "./components/Admin";
import RequestDetail from "./components/RequestDetail";
import NewRequestModal from "./components/NewRequestModal";
import MobileMenu from "./components/MobileMenu";
import NotificationBell from "./components/NotificationBell";
import Toast from "./components/ui/Toast";

export default function App() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const { lang, setLang } = useI18n();

  const [tab,           setTab]           = useState("dashboard");
  const [requests,      setRequests]      = useState<Request[]>([]);
  const [roster,        setRoster]        = useState<RosterMember[]>([]);
  const [quotas,        setQuotas]        = useState<Quotas>({});
  const [toast,         setToast]         = useState<{ msg: string; type: string } | null>(null);
  const [showNew,       setShowNew]       = useState(false);
  const [selected,      setSelected]      = useState<Request | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const pendingIds   = useRef(new Set<string>());
  const initialLoad  = useRef(true);
  const notify = useCallback((msg: string, type = "info") => setToast({ msg, type }), []);

  const loadData = useCallback(async () => {
    if (!APPS_SCRIPT_URL) {
      if (initialLoad.current) { setLoading(false); initialLoad.current = false; }
      return;
    }
    try {
      const meEmail = user?.email || "";
      const [rd, qd, rod, nd] = await Promise.all([
        get("get_requests"),
        get("get_quotas"),
        get("get_roster"),
        meEmail ? get(`get_notifications&userEmail=${encodeURIComponent(meEmail)}`) : Promise.resolve({ ok: false }),
      ]);
      if (rd.ok)  setRequests(prev => ((rd.data as Request[]) || []).map(r => pendingIds.current.has(r.id) ? (prev.find(p => p.id === r.id) || r) : r));
      if (qd.ok)  setQuotas((qd.data as Quotas) || {});
      if (rod.ok) setRoster((rod.data as RosterMember[]) || []);
      if (nd.ok)  setNotifications(((nd as any).data as Notification[]) || []);
    } catch { notify("Sync failed", "error"); }
    finally { if (initialLoad.current) { setLoading(false); initialLoad.current = false; } }
  }, [notify, user?.email]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    initialLoad.current = true;
    const safeLoad = () => { if (active) loadData(); };
    safeLoad();
    const t = setInterval(safeLoad, 30000);
    return () => { active = false; clearInterval(t); };
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

  const handleSubmit = async (data: any, targets: string[] = []) => {
    const emailList = targets.length > 0 ? targets : [meEmail];
    let success = 0;
    for (const email of emailList) {
      const ap  = roster.find(r => r.email === email);
      const req: Request = {
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...data,
        applicantEmail: email,
        applicantId:    ap?.id || "",
        ...(email !== meEmail ? { submittedBy: meEmail } : {}),
        status:      "pending",
        currentStep: 0,
        submittedAt: new Date().toISOString(),
      };
      pendingIds.current.add(req.id);
      setRequests(prev => [req, ...prev]);
      try {
        const res = await post({ action: "save_request", data: req });
        if (!res.ok) throw new Error((res.error as string) || "Failed");
        success++;
      } catch (e: any) {
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

  const handleUpdate = async ({ action, id, comment, step, role }: { action: string; id: string; comment: string; step: number; role: string }) => {
    pendingIds.current.add(id);
    const prevSnapshot = requests.map(r => ({ ...r }));
    setRequests(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (action === "approve") {
        const chain = (quotas?.approvalChains?.[r.type]) || DEFAULT_CHAINS[r.type] || ["assignee"];
        const next  = step + 1;
        return { ...r, currentStep: next, status: next >= chain.length ? "completed" : "in_progress" };
      }
      if (action === "reject") return { ...r, status: "rejected"  };
      if (action === "cancel") return { ...r, status: "cancelled" };
      return r;
    }));
    try {
      const res = await post({ action: "update_request", id, decision: action, comment, step, role, callerEmail: meEmail });
      if (!res.ok) throw new Error((res.error as string) || "Failed");
      notify(action === "approve" ? "승인됐습니다!" : action === "reject" ? "반려됐습니다" : "취소됐습니다", "success");
    } catch (e: any) {
      setRequests(prevSnapshot);
      notify("Action failed: " + e.message, "error");
    } finally {
      pendingIds.current.delete(id);
      setTimeout(loadData, 2500);
    }
  };

  const handleSaveQuotas = async (data: Quotas) => {
    try {
      const res = await post({ action: "save_quotas", data });
      if (!res.ok) throw new Error((res.error as string) || "Failed");
      setQuotas(data);
      notify("Settings saved!", "success");
    } catch (e: any) { notify("Save failed: " + e.message, "error"); }
  };

  const handleReadNotification = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: "true" } : n));
  };

  const handleSelectByRequestId = (requestId: string) => {
    const req = requests.find(r => r.id === requestId);
    if (req) setSelected(req);
  };

  const TABS = [
    { key: "dashboard", label: "Dashboard",   icon: "🏠"                     },
    { key: "my",        label: "My Requests", icon: "📋"                     },
    { key: "approvals", label: "Approvals",   icon: "✅", badge: pendingCount },
    { key: "analytics", label: "Analytics",   icon: "📊"                     },
    ...(isAdmin ? [{ key: "admin", label: "Admin", icon: "⚙️", badge: 0 }] : []),
  ];

  if (user && loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <div style={{ textAlign: "center", color: C.muted }}>
        <div style={{ fontSize: 32, marginBottom: 12, display: "inline-block" }}>⟳</div>
        <div style={{ fontSize: 13 }}>Loading...</div>
      </div>
    </div>
  );

  if (!user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#1d4ed8 0%,#0f172a 100%)" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 380,
        textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>SR GA Support</h1>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 28px" }}>Seoul Robotics General Affairs</p>
        <a href={buildOAuthUrl()}
          style={{ display: "block", background: C.primary, color: "#fff", padding: "12px 0",
            borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
          Sign in with Google
        </a>
        <p style={{ color: C.muted, fontSize: 11, marginTop: 16 }}>{VERSION} · SR employees only</p>
      </div>
    </div>
  );

  return (
    <SRAuthGate appSlug="ga-support" sheetId={ACCESS_SHEET_ID} userEmail={user?.email || ""}>
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.primary, color: "#fff", padding: "0 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", height: 52,
        position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏢</span>
          <strong style={{ fontSize: 15 }}>SR GA Support</strong>
          <span style={{ fontSize: 10, opacity: .6 }}>{VERSION} · {BUILD_DATE}</span>
        </div>
        {isMobile ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NotificationBell
              notifications={notifications}
              onRead={handleReadNotification}
              onSelectRequest={handleSelectByRequestId}
              meEmail={meEmail}
            />
            <MobileMenu user={user} onLogout={logout} />
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NotificationBell
              notifications={notifications}
              onRead={handleReadNotification}
              onSelectRequest={handleSelectByRequestId}
              meEmail={meEmail}
            />
            {user.picture && <img src={user.picture} alt="" style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid rgba(255,255,255,.4)" }} referrerPolicy="no-referrer" />}
            <span style={{ fontSize: 12, opacity: .8 }}>{user.name}</span>
            <button onClick={() => setLang(lang === "ko" ? "en" : "ko")}
              style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
              {lang === "ko" ? "EN" : "KO"}
            </button>
            <a href={MANUAL_URL_KO} target="_blank" rel="noreferrer"
              style={{ background: "rgba(255,255,255,.15)", color: "#fff", padding: "4px 10px", borderRadius: 4, fontSize: 11, textDecoration: "none" }}>📖 KO</a>
            <a href={MANUAL_URL_EN} target="_blank" rel="noreferrer"
              style={{ background: "rgba(255,255,255,.15)", color: "#fff", padding: "4px 10px", borderRadius: 4, fontSize: 11, textDecoration: "none" }}>📖 EN</a>
            <a href={SR_GATE_URL} target="_blank" rel="noreferrer"
              style={{ background: "rgba(255,255,255,.15)", color: "#fff", padding: "4px 10px", borderRadius: 4, fontSize: 11, textDecoration: "none" }}>🏠 Gate</a>
            <button onClick={logout}
              style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Sign out</button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${C.border}`, display: "flex", overflowX: "auto", padding: "0 16px" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "12px 16px", border: "none", background: "none", cursor: "pointer", whiteSpace: "nowrap",
              fontWeight: tab === t.key ? 700 : 400,
              borderBottom: tab === t.key ? `2px solid ${C.primary}` : "2px solid transparent",
              color: tab === t.key ? C.primary : C.text, fontSize: 13,
              display: "flex", alignItems: "center", gap: 5 }}>
            <span>{t.icon}</span>
            {isMobile
              ? <span style={{ fontSize: 10 }}>{t.label.split(" ")[0]}</span>
              : <span>{t.label}</span>}
            {(t.badge ?? 0) > 0 && (
              <span style={{ background: C.danger, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px" }}>
        {tab === "dashboard" && (
          <Dashboard requests={requests} roster={roster} meEmail={meEmail} quotas={quotas}
            onNew={() => setShowNew(true)} onSelect={setSelected} />
        )}
        {tab === "my" && (
          <MyRequests requests={requests} meEmail={meEmail} roster={roster} quotas={quotas}
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

      {/* Modals */}
      {showNew && (
        <NewRequestModal onClose={() => setShowNew(false)} onSubmit={handleSubmit}
          roster={roster} quotas={quotas} user={user} meEmail={meEmail} />
      )}
      {selected && (
        <RequestDetail req={selected} onClose={() => setSelected(null)} onAction={handleUpdate}
          meEmail={meEmail} roster={roster} quotas={quotas} />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
    </SRAuthGate>
  );
}
