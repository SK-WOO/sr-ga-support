import { useState, useEffect, useCallback } from "react";

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

export default function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem("ga_user") || "null");
      if (u && (!u.exp || u.exp * 1000 < Date.now())) { sessionStorage.removeItem("ga_user"); return null; }
      return u;
    } catch { return null; }
  });

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace("#", "?").slice(1));
    const tok  = hash.get("id_token");
    if (tok) {
      try {
        const b64    = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, "=");
        const p      = JSON.parse(atob(padded));
        const storedNonce = sessionStorage.getItem(GA_NONCE_KEY);
        sessionStorage.removeItem(GA_NONCE_KEY);
        if (storedNonce && p.nonce !== storedNonce) throw new Error("nonce mismatch");
        if (p?.email && p.email.endsWith("@seoulrobotics.org") && (!p.exp || p.exp * 1000 > Date.now())) {
          // Phase 6-1: store id_token for server-side verification
          const u = { name: p.name, email: p.email, picture: p.picture, exp: p.exp, id_token: tok };
          setUser(u);
          sessionStorage.setItem("ga_user", JSON.stringify(u));
        }
      } catch (e) { console.warn("OAuth validation failed:", e.message); }
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const logout = useCallback(() => { sessionStorage.removeItem("ga_user"); setUser(null); }, []);
  return { user, logout };
}
