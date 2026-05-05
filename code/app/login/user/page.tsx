"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, ArrowLeft, Building2 } from "lucide-react";
import { apiLogin, setCredentials } from "@/lib/api";

export default function UserLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("ADMIN");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim()) { setError("Enter username."); return; }
    setError("");
    try {
      // apiLogin internally calls setToken + setCredentials
      await apiLogin(username.trim(), password);
      router.push("/dashboard");
    } catch {
      // Offline / demo mode: store credentials anyway so Basic Auth headers are sent
      setCredentials(username.trim(), password);
      if (username.trim().toUpperCase() === "ADMIN") {
        router.push("/dashboard");
      } else {
        setError("Login failed — check your credentials or API connection.");
      }
    }
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

          {/* Company badge */}
          <div className="flex items-center gap-2 mb-6 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <Building2 size={14} className="text-blue-600" />
            <span className="text-xs text-blue-700 font-semibold">AJSHRINK</span>
            <span className="text-xs text-blue-500 ml-auto">Company verified ✓</span>
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
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Password
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

          <button
            onClick={handleLogin}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm"
          >
            Login to Dashboard
          </button>

          <button
            onClick={() => router.push("/login")}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            <ArrowLeft size={12} /> Back to Company Login
          </button>

          <p className="text-center text-xs text-gray-400 mt-4 border-t border-gray-100 pt-4">
            Demo: Username &nbsp;
            <span className="font-mono font-semibold text-gray-600">ADMIN</span>
            &nbsp; (any password)
          </p>
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">
          v2.0 &copy; 2024 AJ Shrink ERP &mdash; Flexible Packaging
        </p>
      </div>
    </div>
  );
}
