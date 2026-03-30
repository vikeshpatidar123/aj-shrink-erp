"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { loginUser, clearAuth } from "@/lib/auth";

export default function UserLoginPage() {
  const router = useRouter();

  // Step 2 — User Login
  // Backend: POST /api/Login/UserLogin
  // Header: Authorization: Basic base64(ApiCompanyUserName:ApiCompanyPassword) ← from Step 1
  // Body: { UserName, Password } ← from UserMaster table (password encrypted server-side)
  // Returns: { UserID, UserName, CompanyID, FYear, DBType, ProductionUnits[] }

  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companyVerified, setCompanyVerified] = useState(false);

  useEffect(() => {
    // If company login (Step 1) was not completed → redirect back
    const basicAuth = localStorage.getItem("basicAuth");
    if (!basicAuth) {
      router.replace("/login");
      return;
    }
    setCompanyName(localStorage.getItem("companyName") || "Company");
    setCompanyVerified(true);
  }, [router]);

  const handleLogin = async () => {
    setError("");
    if (!userName.trim()) { setError("Please enter your username."); return; }
    if (!password.trim()) { setError("Please enter your password."); return; }

    setLoading(true);
    const result = await loginUser(userName, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    // Session saved (UserID, CompanyID, FYear, etc.) → go to dashboard
    router.push("/dashboard");
  };

  const handleBack = () => {
    clearAuth();
    router.push("/login");
  };

  if (!companyVerified) return null;

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

          {/* Company verified badge */}
          <div className="flex items-center gap-2 mb-6 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 size={14} className="text-green-600" />
            <div className="flex-1">
              <p className="text-xs text-green-700 font-semibold">{companyName}</p>
              <p className="text-xs text-green-500">Company verified ✓</p>
            </div>
          </div>

          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800">User Login</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step 2 of 2 — Enter your user credentials</p>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">

            {/* Username — UserMaster.UserName */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Username <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => { setUserName(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter your username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password — UserMaster.Password (encrypted server-side) */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Signing in...</>
            ) : (
              "Login to Dashboard →"
            )}
          </button>

          <button onClick={handleBack}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
            <ArrowLeft size={12} /> Back to Company Login
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">
          v2.0 &copy; 2024 AJ Shrink ERP &mdash; Flexible Packaging
        </p>
      </div>
    </div>
  );
}
