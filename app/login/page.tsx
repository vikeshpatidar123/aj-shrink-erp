"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { loginCompany } from "@/lib/auth";

export default function CompanyLoginPage() {
  const router = useRouter();

  // Step 1 — Company Login
  // Backend: POST /api/Login/CompanyLogin
  // Header: Authorization: Basic base64(ApiCompanyUserName:ApiCompanyPassword)
  // Source: Indus_Company_Authentication_For_Web_Modules table
  const [companyUsername, setCompanyUsername] = useState("");
  const [companyPassword, setCompanyPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    if (!companyUsername.trim()) { setError("Please enter Company Username."); return; }
    if (!companyPassword.trim()) { setError("Please enter Company Password."); return; }

    setLoading(true);
    const result = await loginCompany(companyUsername, companyPassword);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    // basicAuth stored in localStorage — used in Step 2 and all API calls
    router.push("/login/user");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <span className="text-white text-2xl font-extrabold tracking-tight">AJ</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">AJ Shrink ERP</h1>
          <p className="text-slate-400 text-sm mt-1">Flexible Packaging Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800">Company Login</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step 1 of 2 — Enter your company API credentials</p>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">

            {/* API Client ID — maps to ApiClientID in CompanyMaster */}
            <div>
              {/* Company Username — ApiCompanyUserName from Indus_Company_Authentication_For_Web_Modules */}
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Company Username <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  value={companyUsername}
                  onChange={(e) => { setCompanyUsername(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter company username"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Provided by your system administrator</p>
            </div>

            {/* Company Password — ApiCompanyPassword from Indus_Company_Authentication_For_Web_Modules */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Company Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type={showPw ? "text" : "password"}
                  value={companyPassword}
                  onChange={(e) => { setCompanyPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter company password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

          </div>

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Verifying with server...
              </>
            ) : (
              "Continue →"
            )}
          </button>

          <div className="mt-5 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700 font-medium mb-0.5">Where do I find these credentials?</p>
            <p className="text-xs text-blue-500">
              Contact your system administrator for the company username and password.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">
          v2.0 &copy; 2024 AJ Shrink ERP &mdash; Flexible Packaging
        </p>
      </div>
    </div>
  );
}
