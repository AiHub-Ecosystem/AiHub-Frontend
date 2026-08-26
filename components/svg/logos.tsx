const marks: Record<string, React.ReactNode> = {
  CitySprint: <circle r="6" fill="currentColor" />,
  "Little Bike Co": <path d="M0 8 L12 8 M3 12 L9 4 M12 8 a3.5 3.5 0 1 0 0.1 0" stroke="currentColor" strokeWidth="2" fill="none" />,
  "Resident Advisor": <rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" />,
  MVF: <path d="M1 13 V1 L8 8 L15 1 V13" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  Consil: <polygon points="8,1 15,15 1,15" fill="currentColor" />,
  IFG: <path d="M1 4 h14 M1 12 h14 M8 4 v8" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" />,
  "Lotus Labs": <path d="M8 1 C11 5 11 9 8 13 C5 9 5 5 8 1 Z" fill="currentColor" />,
  "Session Climbing": <path d="M1 13 L8 1 L15 13 Z" fill="currentColor" />,
  Vertex: <path d="M1 13 L8 1 L15 13 M8 1 V13" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  VIEVE: <path d="M1 1 v12 M1 7 h7 M8 1 v12 M14 1 l-4 6 4 6" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  Woom: <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2.4" fill="none" />,
  Netlify: <path d="M8 1 L1 8 L8 15 L15 8 Z" fill="currentColor" />,
  HackerOne: (
    <>
      <circle cx="8" cy="5" r="3" fill="currentColor" />
      <circle cx="5" cy="10" r="3" fill="currentColor" />
      <circle cx="11" cy="10" r="3" fill="currentColor" />
    </>
  ),
  GitLab: <path d="M1 7 l3.5-6 3.5 6 3.5-6 3.5 6-5 8-5-8Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />,
  Zapier: <path d="M8 1 v14 M1 8 h14 M2.6 2.6 l10.8 10.8 M13.4 2.6 2.6 13.4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />,
  Remote: <path d="M1 4 a7 7 0 0 1 14 0 M5 4 a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />,
};

export function Wordmark({
  name,
  className,
  fill = "currentColor",
}: {
  name: string;
  className?: string;
  fill?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg viewBox="0 0 16 16" className="h-6 w-6" fill={fill} aria-hidden>
        {marks[name] ?? <circle cx="8" cy="8" r="7" fill="currentColor" />}
      </svg>
      <span className="text-lg font-bold tracking-tight">{name}</span>
    </span>
  );
}
