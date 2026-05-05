import { authHeaders } from "@/lib/auth";

// ── TODO: Replace with correct backend endpoint once confirmed ──────────────
// Current pattern from other masters: /api/[moduleName]Shrink/[action]
// Example: /api/categorymasterShrink/getcategory
// Update BASE below when you know the correct controller name.
const BASE = "https://api.indusanalytics.co.in/api/fieldmasterShrink";

export type FieldValueRow = {
  id:         string;
  FieldName:  string;
  FieldValue: string;
  SortOrder:  number;
};

async function safeFetch(url: string, options?: RequestInit): Promise<any> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function getFields(): Promise<string[]> {
  const data = await safeFetch(`${BASE}/getfields`, { headers: authHeaders() });
  return Array.isArray(data) ? data : [];
}

export async function getFieldValues(fieldName: string): Promise<FieldValueRow[]> {
  const data = await safeFetch(
    `${BASE}/getvalues/${encodeURIComponent(fieldName)}`,
    { headers: authHeaders() }
  );
  if (!Array.isArray(data)) return [];
  return data.map((row: any, i: number) => ({
    ...row,
    id: row.id ?? `${row.FieldName}-${row.FieldValue}-${i}`,
  }));
}

export async function addFieldValue(fieldName: string, fieldValue: string): Promise<string> {
  const data = await safeFetch(`${BASE}/addvalue`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify({ FieldName: fieldName, FieldValue: fieldValue }),
  });
  return data?.Result ?? data ?? "Success";
}

export async function deleteFieldValue(fieldName: string, fieldValue: string): Promise<void> {
  await safeFetch(`${BASE}/deletevalue`, {
    method:  "DELETE",
    headers: authHeaders(),
    body:    JSON.stringify({ FieldName: fieldName, FieldValue: fieldValue }),
  });
}
