// Shared API client for AJ Shrink ERP backend (ASP.NET 5.2 / .NET 4.8)
// Base URL read from NEXT_PUBLIC_API_URL env var, falls back to localhost:57214

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:57214").replace(/\/$/, "");

// ── Bearer token (OAuth2) – used by legacy endpoints ──────────────────────
export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("erp_token") ?? "";
}
export function setToken(t: string) { localStorage.setItem("erp_token", t); }
export function clearToken()        { localStorage.removeItem("erp_token"); }

// ── Basic Auth – used by [ValidateUserCRM] / [Validate] controllers ───────
// Stores base64(username:password) so every API call to Shrink endpoints works.
export function setCredentials(username: string, password: string) {
  if (typeof window === "undefined") return;
  const encoded = btoa(`${username}:${password}`);
  localStorage.setItem("erp_basic", encoded);
}
export function getBasicAuth(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("erp_basic") ?? "";
}
export function clearCredentials() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("erp_basic");
  localStorage.removeItem("erp_token");
}

// ── Response parser ────────────────────────────────────────────────────────
// The .NET controllers return Ok(JsonConvert.SerializeObject(data.Message))
// which means the response is a JSON string containing another JSON string.
// We double-parse to get the actual object.
async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    const outer = JSON.parse(text);
    return typeof outer === "string" ? JSON.parse(outer) : outer;
  } catch {
    return text as unknown as T;
  }
}

// ── Request headers ────────────────────────────────────────────────────────
// Sends Basic Auth if credentials are stored (for [ValidateUserCRM] controllers).
// Falls back to Bearer token for OAuth-protected controllers.
function headers(extra?: Record<string, string>): Record<string, string> {
  const basicAuth = getBasicAuth();
  const bearerToken = getToken();

  const result: Record<string, string> = { "Content-Type": "application/json" };
  if (basicAuth) {
    result["Authorization"] = `Basic ${basicAuth}`;
  } else if (bearerToken) {
    result["Authorization"] = `Bearer ${bearerToken}`;
  }
  if (extra) Object.assign(result, extra);
  return result;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path.replace(/^\//, "")}`, {
    method: "GET",
    headers: headers(),
  });
  return parseResponse<T>(res);
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

// Login → POST /token (OAuth2 password grant against CompanyMaster.ApiClientID/ApiClientSecretID)
// Also stores credentials as Basic Auth for [ValidateUserCRM] endpoints.
export async function apiLogin(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  const token = data.access_token as string;
  setToken(token);
  // Store Basic Auth credentials so Shrink controllers ([ValidateUserCRM]) work
  setCredentials(username, password);
  return token;
}
