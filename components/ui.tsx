import Link from "next/link";
import { ArrowRightIcon } from "@/components/svg/icons";

type BtnVariant = "primary" | "pink" | "outline" | "ghost";

const variants: Record<BtnVariant, string> = {
  primary: "btn-gradient text-white",
  pink: "btn-gradient-pink text-white",
  outline:
    "border-2 border-line-strong text-ink hover:border-brand-blue hover:text-brand-blue",
  ghost: "text-ink hover:text-brand-blue",
};

export function Button({
  href,
  variant = "primary",
  className = "",
  children,
  withArrow = false,
}: {
  href: string;
  variant?: BtnVariant;
  className?: string;
  children: React.ReactNode;
  withArrow?: boolean;
}) {
  const base = `inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all ${variants[variant]} ${className}`;
  const inner = (
    <>
      {children}
      {withArrow && <ArrowRightIcon className="h-4 w-4" />}
    </>
  );
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={base}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={base}>
      {inner}
    </Link>
  );
}

export function Badge({
  children,
  color = "blue",
}: {
  children: React.ReactNode;
  color?: "blue" | "pink" | "yellow" | "green" | "purple" | "orange";
}) {
  const colors: Record<string, string> = {
    blue: "bg-brand-blue/15 text-brand-blue",
    pink: "bg-brand-pink/15 text-brand-pink",
    yellow: "bg-brand-yellow/20 text-yellow-600 dark:text-brand-yellow",
    green: "bg-brand-green/20 text-green-700 dark:text-brand-green",
    purple: "bg-brand-purple/15 text-brand-purple dark:text-[#a98bff]",
    orange: "bg-brand-orange/15 text-brand-orange",
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${colors[color]}`}>
      {children}
    </span>
  );
}
