import Image from "next/image";
import Link from "next/link";

const stories = [
  {
    title: "The Little Bike Company Boosts Monthly Productivity by 20% with AiHub’s Streamlined Solution",
    href: "/blog/the-little-bike-company-boosts-monthly-productivity-by-20-with-matatikas-streamlined-solution",
    image: "case-little-bike.png",
  },
  {
    title: "MVF Makes ETL 7x Cheaper While Migrating 1B+ Rows Across 60+ Sources",
    href: "/blog/mvf-makes-etl-7x-cheaper-while-migrating-1b-rows-across-60-sources",
    image: "case-mvf.png",
  },
  {
    title: "How Resident Advisor Escaped Year-Long ETL Firefighting",
    href: "/blog/how-resident-advisor-escaped-year-long-etl-firefighting",
    image: "case-resident-advisor.png",
  },
];

export function CaseStudies() {
  return (
    <section className="meltano-case-studies">
      <h2><em>Success Stories</em></h2>
      <div className="meltano-case-grid">
        {stories.map((story) => (
          <article key={story.href}>
            <Link href={story.href} className="meltano-case-image">
              <span>Case Study</span>
              <Image src={`/meltano/${story.image}`} alt={story.title} width={800} height={600} />
            </Link>
            <Link href={story.href}><h3>{story.title}</h3></Link>
          </article>
        ))}
      </div>
    </section>
  );
}
