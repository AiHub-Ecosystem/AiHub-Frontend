import { DashBreak } from "@/components/svg/hero-art";
import { Button } from "@/components/ui";
import { CheckIcon } from "@/components/svg/icons";

export type WordPlaySectionProps = {
  wordplay: { before: string; em: string; after: string };
  gradientClass?: string;
  title: string;
  description: string;
  bullets: string[];
  cta: { label: string; href: string };
  terminal: React.ReactNode;
  breakFlip?: boolean;
};

export function WordPlaySection({
  wordplay,
  gradientClass = "accent-gradient",
  title,
  description,
  bullets,
  cta,
  terminal,
  breakFlip = false,
}: WordPlaySectionProps) {
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24 lg:px-8">
        <div>
          <div className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            {wordplay.before}
            <em className={gradientClass}>{wordplay.em}</em>
            {wordplay.after}
          </div>

          <h3 className="mt-4 text-2xl font-bold sm:text-3xl">{title}</h3>
          <p className="mt-4 text-lg leading-relaxed text-soft">{description}</p>

          <ul className="mt-6 space-y-3">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-soft">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue/15 text-brand-blue">
                  <CheckIcon className="h-3 w-3" />
                </span>
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Button href={cta.href} variant="outline" withArrow>
              {cta.label}
            </Button>
          </div>
        </div>

        <div>{terminal}</div>
      </div>

      <div className="text-line">
        <DashBreak className="mx-auto h-12 w-full max-w-5xl" flip={breakFlip} />
      </div>
    </section>
  );
}
