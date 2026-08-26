"use client";

import Link from "next/link";
import { AiHubLogo } from "../svg/brand";

interface LabHeaderProps {
  activeTab: "generate" | "manage";
  onTabChange: (tab: "generate" | "manage") => void;
  acceptedCount?: number;
}

export function LabHeader({ activeTab, onTabChange, acceptedCount = 0 }: LabHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        {/* Left: Brand + Navigation Tabs */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <AiHubLogo />
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Academic AI Lab
            </span>
          </Link>

          <nav className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => onTabChange("generate")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                activeTab === "generate"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
              }`}
            >
              Generate Sample
            </button>
            <button
              onClick={() => onTabChange("manage")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "manage"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
              }`}
            >
              Manage Sample
              {acceptedCount > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full ${
                    activeTab === "manage" ? "bg-blue-800 text-white" : "bg-gray-300 text-gray-700"
                  }`}
                >
                  {acceptedCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Right: Academic Specialist Profile Badge matching FRD */}
        <div className="flex items-center gap-4">
          <Link
            href="/demo"
            className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors"
          >
            ← Public Demo
          </Link>
          <div className="flex items-center gap-2 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            ★ Q.Đạt (Academic Specialist)
          </div>
        </div>
      </div>
    </header>
  );
}
