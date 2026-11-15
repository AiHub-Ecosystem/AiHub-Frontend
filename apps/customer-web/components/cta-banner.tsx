import { Button } from "@/components/ui";

export function CtaBanner() {
  return (
    <section id="book-demo" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="hero-bg relative overflow-hidden rounded-[2.5rem] border border-line bg-card px-6 py-20 text-center">
        <div className="pointer-events-none absolute left-8 top-8 h-16 w-16 rounded-full bg-brand-pink/20 blur-xl" />
        <div className="pointer-events-none absolute bottom-8 right-10 h-16 w-16 rounded-full bg-brand-cyan/20 blur-xl" />
        <h2 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          Intrigued?
          <br />
          <span className="text-soft">You haven&apos;t seen nothing yet!</span>
        </h2>
        <div className="mt-8">
          <Button href="#book-demo" variant="pink" withArrow className="px-8 py-4 text-base">
            Book a demo
          </Button>
        </div>
      </div>
    </section>
  );
}
