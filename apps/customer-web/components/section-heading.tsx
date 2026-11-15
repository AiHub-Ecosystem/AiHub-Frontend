export function SectionHeading({
  eyebrow,
  before,
  em,
  after = "",
  gradientClass = "accent-gradient",
  className = "",
}: {
  eyebrow?: string;
  before?: string;
  em?: string;
  after?: string;
  gradientClass?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow && (
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-soft">{eyebrow}</div>
      )}
      <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
        {before}
        {em && (
          <>
            {" "}
            <em className={`${gradientClass}`}>{em}</em>
          </>
        )}
        {after && <span> {after}</span>}
      </h2>
    </div>
  );
}
