export function AiHubLogo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#3a64fa] to-[#18c3fa] text-white font-black text-lg shadow-md shadow-brand-blue/20">
        AI
      </span>
      <span className="text-xl font-extrabold tracking-tight text-ink">
        Ai<span className="text-brand-blue">Hub</span>
      </span>
    </span>
  );
}

/** Alias for backward compatibility */
export const MeltanoLogo = AiHubLogo;

