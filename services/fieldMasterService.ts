import { authHeaders } from "@/lib/auth";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in") + "/api/FieldMasterAJ";

export type FieldValueRow = {
  id:             string;
  FieldMasterID?: number;
  FieldName:      string;
  FieldValue:     string;
  SortOrder:      number;
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
  const data = await safeFetch(`${BASE}/GetFields`, { headers: authHeaders() });
  return Array.isArray(data) ? data : [];
}

export async function getFieldValues(fieldName: string): Promise<FieldValueRow[]> {
  const data = await safeFetch(
    `${BASE}/GetFieldValues?fieldName=${encodeURIComponent(fieldName)}`,
    { headers: authHeaders() }
  );
  if (!Array.isArray(data)) return [];
  return data.map((row: any, i: number) => ({
    ...row,
    id: row.FieldMasterID?.toString() ?? `${row.FieldName}-${row.FieldValue}-${i}`,
  }));
}

export async function addFieldValue(fieldName: string, fieldValue: string): Promise<string> {
  const data = await safeFetch(
    `${BASE}/AddFieldValue?fieldName=${encodeURIComponent(fieldName)}&value=${encodeURIComponent(fieldValue)}`,
    { method: "POST", headers: authHeaders() }
  );
  return typeof data === "string" ? data : (data?.Result ?? "Success");
}

export async function deleteFieldValue(fieldName: string, fieldValue: string): Promise<void> {
  await safeFetch(
    `${BASE}/DeleteFieldValue?fieldName=${encodeURIComponent(fieldName)}&value=${encodeURIComponent(fieldValue)}`,
    { method: "POST", headers: authHeaders() }
  );
}
