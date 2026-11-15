"use client";

import { useState } from "react";

export function TerminalWindow({
  title = "bash",
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`terminal-shadow overflow-hidden rounded-2xl border border-line bg-[#0d0819] ${className}`}>
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#15111f] px-4 py-3">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="font-mono text-xs text-white/60">{title}</div>
      </div>
      <div className="overflow-x-auto p-5 font-mono text-sm leading-relaxed text-white/90">
        {children}
      </div>
    </div>
  );
}

export function UiCli({
  ui,
  cli,
  className = "",
}: {
  ui: React.ReactNode;
  cli: React.ReactNode;
  className?: string;
}) {
  const [tab, setTab] = useState<"ui" | "cli">("cli");

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-2 gap-3 sm:w-72">
        <button
          onClick={() => setTab("ui")}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-colors ${
            tab === "ui"
              ? "border-brand-blue bg-brand-blue text-white"
              : "border-line-strong text-soft hover:text-ink"
          }`}
        >
          UI
          <span
            className={`h-2 w-2 rounded-full ${tab === "ui" ? "bg-white" : "bg-line-strong"}`}
          />
        </button>
        <button
          onClick={() => setTab("cli")}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-colors ${
            tab === "cli"
              ? "border-brand-blue bg-brand-blue text-white"
              : "border-line-strong text-soft hover:text-ink"
          }`}
        >
          CLI
          <span
            className={`h-2 w-2 rounded-full ${tab === "cli" ? "bg-white" : "bg-line-strong"}`}
          />
        </button>
      </div>

      {tab === "cli" ? (
        <TerminalWindow title="melty · zsh">{cli}</TerminalWindow>
      ) : (
        <div className="terminal-shadow overflow-hidden rounded-2xl border border-line bg-[#15111f] p-6">
          {ui}
        </div>
      )}
    </div>
  );
}

export function YamlLine({
  indent = 0,
  children,
}: {
  indent?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="whitespace-pre" style={{ paddingLeft: `${indent * 16}px` }}>
      {children}
    </div>
  );
}
