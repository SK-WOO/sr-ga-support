// api/gas-proxy.js
module.exports = async function handler(req, res) {
  const SCRIPT_URL = process.env.SCRIPT_URL;

  if (!SCRIPT_URL) {
    return res.status(500).json({ ok: false, error: "Server config missing" });
  }

  // ── Google OAuth 토큰 검증 ──
  const authHeader = req.headers["authorization"] || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return res.status(401).json({ ok: false, error: "Authorization required" });
  }

  try {
    const tokenRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!tokenRes.ok) {
      return res.status(401).json({ ok: false, error: "Invalid token" });
    }
    const payload = await tokenRes.json();
    if (payload.hd !== "seoulrobotics.org") {
      return res.status(403).json({ ok: false, error: "Domain not allowed" });
    }
  } catch {
    return res.status(401).json({ ok: false, error: "Token verification failed" });
  }

  // ── CORS ──
  const origin = req.headers["origin"] || "";
  const allowed = ["sr-ga-support.vercel.app", "localhost"];
  if (origin && allowed.some(h => origin.includes(h))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  // ── GAS 요청 전달 ──
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    let response;
    if (req.method === "GET") {
      const params = new URLSearchParams(req.query);
      response = await fetch(`${SCRIPT_URL}?${params}`, { redirect: "follow", signal: controller.signal });
    } else {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(body),
        redirect: "follow",
        signal: controller.signal,
      });
    }
    clearTimeout(timeoutId);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return res.status(504).json({ ok: false, error: "GAS timeout (30s)" });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
}
