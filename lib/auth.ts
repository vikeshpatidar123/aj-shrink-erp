// ─── Auth Utility — Centralised session management ───────────────────────────
//
// LOGIN FLOW (2 Steps):
//
// STEP 1 — Company Login
//   POST /api/Login/CompanyLogin
//   Header: Authorization: Basic base64(ApiCompanyUserName:ApiCompanyPassword)
//   Source: Indus_Company_Authentication_For_Web_Modules table
//   Returns: { CompanyName }
//
// STEP 2 — User Login
//   POST /api/Login/UserLogin
//   Header: Authorization: Basic base64(ApiCompanyUserName:ApiCompanyPassword)  ← same
//   Body:   { UserName, Password }  ← from UserMaster table (password encrypted server-side)
//   Returns: { UserID, UserName, CompanyID, FYear, DBType, ProductionUnits[] }
//
// ALL API CALLS (e.g. Item Master):
//   Header: Authorization: Basic base64(ApiCompanyUserName:ApiCompanyPassword)
//   The [Validate] filter on every controller checks this same header.
//
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.indusanalytics.co.in";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CompanyLoginResult =
  | { success: true; companyName: string }
  | { success: false; error: string };

export interface UserSession {
  userID: string;
  userName: string;
  companyID: string;
  companyName: string;
  fYear: string;
  dbType: string;
  basicAuth: string;               // base64(ApiCompanyUserName:ApiCompanyPassword)
  productionUnits: { ProductionUnitID: string; ProductionUnitName: string }[];
  productionUnitID: string;        // first/active production unit ID
}

// ── Step 1: Company Login ─────────────────────────────────────────────────────

/**
 * Validates company credentials against Indus_Company_Authentication_For_Web_Modules.
 * Sends: Authorization: Basic base64(apiCompanyUserName:apiCompanyPassword)
 * Returns company name on success — stores basicAuth in localStorage for step 2 and API calls.
 */
export async function loginCompany(
  apiCompanyUserName: string,
  apiCompanyPassword: string
): Promise<{ success: true; companyName: string } | { success: false; error: string }> {
  try {
    const basicAuth = btoa(`${apiCompanyUserName.trim()}:${apiCompanyPassword.trim()}`);

    const res = await fetch(`${BASE_URL}/api/Login/CompanyLogin`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401) return { success: false, error: "Invalid company credentials." };
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: text || "Company login failed." };
    }

    const data = await res.json();

    // Store basicAuth temporarily (needed for Step 2 and all API calls)
    localStorage.setItem("basicAuth", basicAuth);
    localStorage.setItem("companyName", data.CompanyName || apiCompanyUserName);

    return { success: true, companyName: data.CompanyName || "" };
  } catch {
    return { success: false, error: "Network error — server unreachable." };
  }
}

// ── Step 2: User Login ────────────────────────────────────────────────────────

/**
 * Validates user credentials against UserMaster (password encrypted server-side).
 * Sends: Authorization: Basic base64(apiCompanyUserName:apiCompanyPassword)
 *        Body: { UserName, Password }
 * Returns full session on success.
 */
export async function loginUser(
  userName: string,
  password: string
): Promise<{ success: true; session: UserSession } | { success: false; error: string }> {
  try {
    const basicAuth = localStorage.getItem("basicAuth");
    if (!basicAuth) return { success: false, error: "Company not verified. Please go back to Step 1." };

    const res = await fetch(`${BASE_URL}/api/Login/UserLogin`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ UserName: userName.trim(), Password: password }),
    });

    if (res.status === 401) return { success: false, error: "Invalid username or password." };
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: text || "User login failed." };
    }

    const data = await res.json();

    const productionUnits = data.ProductionUnits ?? [];
    const session: UserSession = {
      userID: String(data.UserID ?? ""),
      userName: data.UserName ?? userName,
      companyID: String(data.CompanyID ?? ""),
      companyName: localStorage.getItem("companyName") || "",
      fYear: data.FYear ?? "",
      dbType: data.DBType ?? "MSSQL",
      basicAuth,
      productionUnits,
      productionUnitID: String(productionUnits[0]?.ProductionUnitID ?? ""),
    };

    saveSession(session);
    return { success: true, session };
  } catch {
    return { success: false, error: "Network error — server unreachable." };
  }
}

// ── Session storage ───────────────────────────────────────────────────────────

export function saveSession(session: UserSession): void {
  localStorage.setItem("userID", session.userID);
  localStorage.setItem("userName", session.userName);
  localStorage.setItem("companyID", session.companyID);
  localStorage.setItem("companyName", session.companyName);
  localStorage.setItem("fYear", session.fYear);
  localStorage.setItem("dbType", session.dbType);
  localStorage.setItem("basicAuth", session.basicAuth);
  localStorage.setItem("productionUnits", JSON.stringify(session.productionUnits));
  localStorage.setItem("productionUnitID", session.productionUnitID);
}

export function getSession(): UserSession | null {
  const basicAuth = localStorage.getItem("basicAuth");
  const userID    = localStorage.getItem("userID");
  if (!basicAuth || !userID) return null;
  return {
    userID,
    userName:         localStorage.getItem("userName") || "",
    companyID:        localStorage.getItem("companyID") || "",
    companyName:      localStorage.getItem("companyName") || "",
    fYear:            localStorage.getItem("fYear") || "",
    dbType:           localStorage.getItem("dbType") || "MSSQL",
    basicAuth,
    productionUnits:  JSON.parse(localStorage.getItem("productionUnits") || "[]"),
    productionUnitID: localStorage.getItem("productionUnitID") || "",
  };
}

export function clearAuth(): void {
  ["basicAuth", "userID", "userName", "companyID", "companyName",
   "fYear", "dbType", "productionUnits"].forEach(k => localStorage.removeItem(k));
}

export function isLoggedIn(): boolean {
  return !!(localStorage.getItem("basicAuth") && localStorage.getItem("userID"));
}

// ── Auth headers for ALL API calls ───────────────────────────────────────────
// The [Validate] filter on every controller (including ItemMasterController)
// reads this Basic Auth header and validates ApiCompanyUserName:ApiCompanyPassword.

export function authHeaders(): Record<string, string> {
  return {
    "Content-Type":   "application/json",
    Authorization:    `Basic ${localStorage.getItem("basicAuth") || ""}`,
    CompanyID:        localStorage.getItem("companyID") || "",
    UserID:           localStorage.getItem("userID") || "",
    FYear:            localStorage.getItem("fYear") || "",
    DBType:           localStorage.getItem("dbType") || "MSSQL",
    ProductionUnitID: localStorage.getItem("productionUnitID") || "",
  };
}

// ── Legacy compat (kept so existing imports don't break) ─────────────────────
export function getAuth() { return getSession(); }
export function saveAuth(u: any) { /* replaced by saveSession */ }
export function authenticateCompany(a: string, b: string) { return loginCompany(a, b); }
