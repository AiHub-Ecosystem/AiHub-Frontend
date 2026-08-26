export function CloudShape({
  className,
  fill = "#ffffff",
  opacity = 0.9,
}: {
  className?: string;
  fill?: string;
  opacity?: number;
}) {
  return (
    <svg viewBox="0 0 200 80" className={className} fill="none" aria-hidden>
      <g fill={fill} fillOpacity={opacity}>
        <ellipse cx="50" cy="52" rx="40" ry="22" />
        <ellipse cx="95" cy="38" rx="36" ry="26" />
        <ellipse cx="142" cy="48" rx="34" ry="20" />
        <rect x="40" y="48" width="118" height="22" rx="11" />
      </g>
    </svg>
  );
}

export function CastleArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 260" className={className} aria-hidden>
      <defs>
        <linearGradient id="castle-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b8bff" />
          <stop offset="100%" stopColor="#3a64fa" />
        </linearGradient>
        <linearGradient id="castle-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f963bc" />
          <stop offset="100%" stopColor="#d13a8f" />
        </linearGradient>
        <linearGradient id="waterfall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bde9ff" />
          <stop offset="100%" stopColor="#18c3fa" />
        </linearGradient>
      </defs>

      {/* waterfall pool */}
      <ellipse cx="130" cy="238" rx="86" ry="16" fill="#18c3fa" opacity="0.5" />
      <ellipse cx="130" cy="238" rx="56" ry="11" fill="#5ad6ff" opacity="0.8" />

      {/* waterfall */}
      <path
        d="M108 118 C104 150 100 180 96 236 L164 236 C160 180 156 150 152 118 Z"
        fill="url(#waterfall)"
        opacity="0.55"
      />
      <path
        d="M124 122 C121 150 118 180 115 234"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M136 120 C134 150 132 180 130 234"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      {/* left tower */}
      <rect x="38" y="78" width="52" height="120" rx="8" fill="url(#castle-body)" />
      <path d="M30 78 L64 42 L98 78 Z" fill="url(#castle-roof)" />
      <circle cx="64" cy="46" r="5" fill="#fbcc54" />
      <rect x="50" y="118" width="28" height="34" rx="6" fill="#0d0819" opacity="0.85" />
      <rect x="54" y="122" width="20" height="14" rx="4" fill="#5ad6ff" opacity="0.9" />

      {/* right tower */}
      <rect x="170" y="78" width="52" height="120" rx="8" fill="url(#castle-body)" />
      <path d="M162 78 L196 42 L230 78 Z" fill="url(#castle-roof)" />
      <circle cx="196" cy="46" r="5" fill="#fbcc54" />
      <rect x="182" y="118" width="28" height="34" rx="6" fill="#0d0819" opacity="0.85" />
      <rect x="186" y="122" width="20" height="14" rx="4" fill="#5ad6ff" opacity="0.9" />

      {/* center keep */}
      <rect x="78" y="100" width="104" height="98" rx="10" fill="url(#castle-body)" />
      <path d="M64 100 L130 52 L196 100 Z" fill="url(#castle-roof)" />
      <circle cx="130" cy="58" r="6" fill="#fbcc54" />
      <rect x="104" y="140" width="52" height="58" rx="8" fill="#0d0819" opacity="0.85" />
      <rect x="112" y="148" width="36" height="24" rx="5" fill="#5ad6ff" opacity="0.9" />

      {/* battlements on walls */}
      <rect x="64" y="178" width="132" height="12" rx="4" fill="#2f55d8" />
      {[76, 100, 124, 148, 172].map((x) => (
        <rect key={x} x={x} y="170" width="12" height="12" rx="3" fill="#2f55d8" />
      ))}

      {/* flags */}
      <path d="M64 30 L86 40 L64 50 Z" fill="#fbcc54" />
      <path d="M196 30 L218 40 L196 50 Z" fill="#fbcc54" />
      <path d="M130 40 L152 50 L130 60 Z" fill="#ff5894" />
    </svg>
  );
}

export function MountainsBack({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 240"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <path
        d="M0 240 L0 140 L150 70 L320 150 L470 60 L640 150 L820 90 L980 160 L1140 70 L1300 150 L1440 100 L1440 240 Z"
        fill="#1d152f"
      />
      <path
        d="M0 240 L0 160 L180 105 L330 175 L520 100 L700 175 L880 120 L1050 178 L1220 110 L1380 168 L1440 150 L1440 240 Z"
        fill="#221937"
        opacity="0.9"
      />
    </svg>
  );
}

export function MountainsFront({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 220"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <path
        d="M0 220 L0 150 L120 90 L260 165 L420 100 L560 175 L720 110 L880 180 L1040 115 L1200 175 L1360 120 L1440 160 L1440 220 Z"
        fill="#15111f"
      />
      <path
        d="M0 220 L0 175 L140 130 L300 185 L480 135 L640 190 L820 150 L1000 195 L1180 155 L1340 195 L1440 175 L1440 220 Z"
        fill="#0d0819"
        opacity="0.95"
      />
    </svg>
  );
}

export function DashBreak({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1200 60"
      preserveAspectRatio="none"
      className={className}
      style={flip ? { transform: "scaleY(-1)" } : undefined}
      aria-hidden
    >
      <path
        d="M-20 30 H1220"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="2 18"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
