import { CloudShape } from "@/components/svg/hero-art";

export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="hero-bg relative overflow-hidden">
      <CloudShape
        className="animate-float-slow pointer-events-none absolute -left-6 top-8 z-0 w-40 text-white"
        fill="#ffffff"
        opacity={0.3}
      />
      <CloudShape
        className="animate-float pointer-events-none absolute -right-4 top-16 z-0 w-48 text-white"
        fill="#ffffff"
        opacity={0.24}
      />
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
        {eyebrow && (
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-soft">
            {eyebrow}
          </div>
        )}
        <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-soft">{subtitle}</p>
        )}
        {children}
      </div>
    </section>
  );
}
