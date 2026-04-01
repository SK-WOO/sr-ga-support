import { ALLOWED_MIME, MAX_FILE_SIZE } from "../constants";

const API_BASE = "/api/gas-proxy";

// Phase 6-1: id_token 추출 (sessionStorage에서)
function getIdToken() {
  try {
    const u = JSON.parse(sessionStorage.getItem("ga_user") || "null");
    return u?.id_token || "";
  } catch { return ""; }
}

interface FetchOpts { retries?: number; timeout?: number; }
type ApiResult = { ok: boolean; [key: string]: unknown };

// Phase 2-1: retry + timeout + JSON error handling
async function fetchWithRetry(url: string, options: RequestInit, { retries = 2, timeout = 30000 }: FetchOpts = {}): Promise<ApiResult> {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) {
          let text;
          try { text = await res.text(); } catch {}
          try { return JSON.parse(text); } catch {}
          return { ok: false, error: `HTTP ${res.status}` };
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      try { return JSON.parse(text); } catch {
        return { ok: false, error: "Invalid JSON response" };
      }
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, attempt === 0 ? 1000 : 3000));
      }
    }
  }
  return { ok: false, error: lastError?.name === "AbortError" ? "Request timeout" : (lastError?.message || "Network error") };
}

export async function post(body, opts = {}) {
  const idToken = getIdToken();
  return fetchWithRetry(
    API_BASE,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(body),
    },
    opts
  );
}

export async function get(action, opts = {}) {
  const idToken = getIdToken();
  const url = `${API_BASE}?action=${action}`;
  return fetchWithRetry(
    url,
    {
      headers: {
        ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {}),
      },
    },
    opts
  );
}

export async function uploadFileViaScript(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error(`파일 크기가 10MB를 초과합니다: ${file.name}`);
  if (!ALLOWED_MIME.includes(file.type)) throw new Error(`지원하지 않는 파일 형식입니다: ${file.name}`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target.result as string).split(",")[1];
      try {
        const res = await post({ action: "upload_file", fileName: file.name, mimeType: file.type, base64 });
        if (res.ok) resolve({ url: res.url, name: file.name });
        else reject(new Error((res.error as string) || "Upload failed"));
      } catch (err) { reject(err); }
    };
    reader.readAsDataURL(file);
  });
}
