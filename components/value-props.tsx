import Link from "next/link";

const props = [
  ["Reduce", "cost", "Pay for the workloads you actually run. Costs stay predictable as usage grows, whether you self-manage or use managed AiHub APIs.", "/product"],
  ["Increase", "efficiency", "Build, adjust, and evaluate AI prompts directly. You are not blocked by ticket queues, with dedicated support when needed.", "/product"],
  ["Centralize", "intelligence", "Run all educational AI services in one place, across writing evaluation, exercise generation, and learning roadmaps.", "/product"],
  ["Remove", "constraints", "Integrate standardized OpenAPI endpoints seamlessly into your LMS, web app, or mobile client with zero lock-in.", "/product"],
] as const;

export function ValueProps() {
  return (
    <section className="meltano-value-props">
      <div className="meltano-value-grid">
        {props.map(([title, emphasis, text, href]) => (
          <article key={title}>
            <div>
              <h3>{title}<br /><em>{emphasis}</em></h3>
              <p>{text}</p>
            </div>
            <Link href={href} className="meltano-color-button"><span />Learn more</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
