import { connectorSavings } from "@/data/site";
import { Button } from "@/components/ui";

export function CostComparison() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-soft">
            Example connectors · Estd. savings
          </div>
          <h2 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            The same <em className="accent-gradient">connectors</em>
            <br />
            30 to 40% less cost.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-soft">
            All estimates are based on our standard plan and estimated with a company of 1-200
            employees. Average savings:{" "}
            <span className="font-bold text-brand-green">57%</span>.
          </p>
          <div className="mt-8">
            <Button href="/pricingcalculator" withArrow>
              Calculate savings
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-line bg-card">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <span className="text-sm font-bold">Connector</span>
            <span className="text-sm font-bold">Savings</span>
          </div>
          {connectorSavings.map((row, i) => (
            <div
              key={row.name}
              className={`flex items-center justify-between px-6 py-4 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold text-white"
                  style={{ backgroundColor: row.color }}
                >
                  {row.name[0]}
                </span>
                <span className="font-semibold">{row.name}</span>
              </span>
              <span className="font-mono text-sm font-bold text-brand-green">{row.range}</span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-brand-green/10 px-6 py-4">
            <span className="font-bold">Avg. savings</span>
            <span className="font-mono text-lg font-extrabold text-brand-green">57%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
