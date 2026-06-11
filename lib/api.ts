// API client for AJ Shrink ERP
// Uses Basic Auth + custom headers set up in lib/auth.ts (authHeaders function).
// The [Validate] filter on every backend controller reads these headers.

import { authHeaders } from "@/lib/auth";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in").replace(/\/$/, "");

// The .NET controllers return Ok(JsonConvert.SerializeObject(data.Message))
// which wraps the JSON in an extra string layer — double-parse to get the object.
async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    // Some .NET endpoints triple-encode: ToJson(DataTable) + JsonConvert.SerializeObject + Ok(serializer).
    // Keep unwrapping string layers until we reach the actual data object/array.
    let result: any = JSON.parse(text);
    while (typeof result === "string") {
      try { result = JSON.parse(result); } catch { break; }
    }
    return result as T;
  } catch {
    return text as unknown as T;
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers = authHeaders();
  // If basicAuth is missing, redirect to login rather than sending broken header
  if (!localStorage.getItem("basicAuth") && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Session expired — redirecting to login");
  }
  return headers;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path.replace(/^\//, "")}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  return parseResponse<T>(res);
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  return parseResponse<T>(res);
}
