"use client";
import React, { useState } from "react";
import { PlayCircle, X, Clock } from "lucide-react";

type Props = {
  videoId?: string;
  title?: string;
};

export default function TutorialButton({ videoId, title = "Tutorial Video" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors"
      >
        <PlayCircle size={15} />
        Tutorial
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <PlayCircle size={20} className="text-red-500" />
                <h3 className="text-base font-bold text-gray-800">{title}</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            {videoId ? (
              <div className="p-4">
                <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                    title={title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div className="px-6 py-10 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center">
                  <Clock size={32} className="text-yellow-500" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-800">Video is Coming Soon!</p>
                  <p className="text-sm text-gray-400 mt-1">
                    We are working on a tutorial video for this page.<br />
                    It will be available shortly.
                  </p>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
