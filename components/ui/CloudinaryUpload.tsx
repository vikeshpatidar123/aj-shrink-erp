"use client";
import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { authHeaders } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.indusanalytics.co.in";

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  resourceType: string;
  format: string;
  originalFilename: string;
  bytes: number;
}

interface Props {
  onUpload: (result: CloudinaryUploadResult) => void;
  onClear?: () => void;
  accept?: "image" | "pdf" | "both";
  label?: string;
  currentUrl?: string;
  disabled?: boolean;
  maxSizeMB?: number;
}

async function fetchSignature() {
  const res = await fetch(`${BASE_URL}/api/cloudinary/sign`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get upload signature");
  return res.json() as Promise<{
    signature: string;
    timestamp: number;
    cloudName: string;
    apiKey: string;
  }>;
}

export default function CloudinaryUpload({
  onUpload, onClear, accept = "both",
  label = "Upload File", currentUrl = "",
  disabled = false, maxSizeMB = 10,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState(currentUrl);
  const [fileName, setFileName]   = useState("");
  const [error, setError]         = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptAttr =
    accept === "image" ? "image/*" :
    accept === "pdf"   ? ".pdf,application/pdf" :
    "image/*,.pdf,application/pdf";

  const isPdfPreview = preview &&
    (preview.toLowerCase().includes(".pdf") || fileName.toLowerCase().endsWith(".pdf"));

  const handleFile = useCallback(async (file: File) => {
    setError("");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImg = file.type.startsWith("image/");
    if (!isPdf && !isImg) { setError("Only images and PDF files are allowed"); return; }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size must be under ${maxSizeMB} MB`);
      return;
    }

    setUploading(true);
    setFileName(file.name);

    try {
      const sig = await fetchSignature();

      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);

      // PDFs must use "raw" so Cloudinary preserves the original bytes and serves with correct Content-Type.
      // Images use "image" resource type.
      const resourceType = isPdf ? "raw" : "image";
      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`,
        { method: "POST", body: fd }
      );
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error((err as any)?.error?.message ?? "Cloudinary upload failed");
      }

      const data = await uploadRes.json();
      setPreview(data.secure_url);
      onUpload({
        secureUrl: data.secure_url,
        publicId:  data.public_id,
        resourceType: data.resource_type,
        format: data.format ?? "",
        originalFilename: file.name,
        bytes: data.bytes ?? file.size,
      });
    } catch (e: any) {
      setError(e?.message ?? "Upload failed. Please try again.");
      setFileName("");
    } finally {
      setUploading(false);
    }
  }, [onUpload, maxSizeMB]);

  const handleClear = () => {
    setPreview(""); setFileName(""); setError("");
    onClear?.();
  };

  return (
    <div className="space-y-2">
      {/* Upload button */}
      <button
        type="button"
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={disabled || uploading}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading
          ? <><Loader2 size={15} className="animate-spin" /> Uploading…</>
          : <><Upload size={15} /> {label}</>}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <X size={11} /> {error}
        </p>
      )}

      {/* Preview */}
      {preview && (
        <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          {isPdfPreview ? (
            <div className="flex items-center gap-3 px-3 py-2.5">
              <FileText size={20} className="text-red-500 flex-shrink-0" />
              <a
                href={preview}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline truncate flex-1"
              >
                {fileName || "View PDF"}
              </a>
            </div>
          ) : (
            <img
              src={preview}
              alt="preview"
              className="w-full max-h-48 object-contain"
            />
          )}

          {/* Clear button */}
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-1 right-1 p-1 rounded-full bg-white shadow text-gray-400 hover:text-red-500 transition-colors"
            title="Remove"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
