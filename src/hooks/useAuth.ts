import { useState, useCallback, useEffect } from "react";

const CLIENT_ID   = process.env.REACT_APP_CLIENT_ID || "";
export const GA_NONCE_KEY = "ga-oauth-nonce";

export function buildOAuthUrl() {
  const arr   = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const nonce = Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
  sessionStorage.setItem(GA_NONCE_KEY, nonce);
  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: window.location.origin,
    response_type: "id_token", scope: "openid email profile", nonce,
    hd: "seoulrobotics.org",
  })}`;
}

// id_token을 렌더 전(useState 초기화) 시점에 처리 — 렌더 중 buildOAuthUrl()이 nonce를 덮어쓰기 전에 검증
function processHashToken() {
  const hash = new URLSearchParams(window.location.hash.replace("#", "?").slice(1));
  const tok  = hash.get("id_token");
  if (!tok) return null;
  window.history.replaceState(null, "", window.location.pathname);
  try {
    const b64    = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, "=");
    const p      = JSON.parse(atob(padded));
    const storedNonce = sessionStorage.getItem(GA_NONCE_KEY);
    sessionStorage.removeItem(GA_NONCE_KEY);
    if (storedNonce && p.nonce !== storedNonce) throw new Error("nonce mismatch");
    if (p?.email && p.email.endsWith("@seoulrobotics.org") && (!p.exp || p.exp * 1000 > Date.now())) {
      const u = { name: p.name, email: p.email, picture: p.picture, exp: p.exp, id_token: tok };
      sessionStorage.setItem("ga_user", JSON.stringify(u));
      return u;
    }
  } catch (e: any) { console.warn("OAuth validation failed:", e.message); }
  return null;
}

export default function useAuth() {
  const [user, setUser] = useState(() => {
    // OAuth 리다이렉트 토큰을 먼저 처리 (렌더 전이므로 nonce 덮어쓰기 없음)
    const fromHash = processHashToken();
    if (fromHash) return fromHash;
    // 기존 세션 확인
    try {
      const u = JSON.parse(sessionStorage.getItem("ga_user") || "null");
      if (u && (!u.exp || u.exp * 1000 < Date.now())) { sessionStorage.removeItem("ga_user"); return null; }
      return u;
    } catch { return null; }
  });

  // 만료 5분 전 자동 재로그인
  useEffect(() => {
    if (!user?.exp) return;
    const ms = user.exp * 1000 - Date.now() - 5 * 60 * 1000;
    if (ms <= 0) { sessionStorage.removeItem("ga_user"); window.location.href = buildOAuthUrl(); return; }
    const timer = setTimeout(() => { sessionStorage.removeItem("ga_user"); window.location.href = buildOAuthUrl(); }, ms);
    return () => clearTimeout(timer);
  }, [user?.exp]);

  const logout = useCallback(() => { sessionStorage.removeItem("ga_user"); setUser(null); }, []);
  return { user, logout };
}
