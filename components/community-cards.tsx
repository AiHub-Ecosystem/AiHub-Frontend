import Image from "next/image";

const cards = [
  {
    href: "https://slack.com",
    icon: "community-sl.svg",
    image: "meltano-crew.png",
    alt: "AiHub community",
    title: <><em>Join</em> 5,500+ <br />on Slack</>,
    caption: "Chat and learn from other users",
  },
  {
    href: "https://github.com",
    icon: "community-gh.svg",
    image: "browser.png",
    alt: "AiHub on GitHub",
    title: <><em>Contribute</em> <br />on GitHub</>,
    caption: "View code and issue tracker",
  },
];

export function CommunityCards() {
  return (
    <section className="meltano-community">
      <div className="meltano-community-grid">
        {cards.map((card) => (
          <a key={card.href} href={card.href} target="_blank" rel="noopener noreferrer" className="meltano-community-card">
            <span className="meltano-community-icon">
              <Image src={`/meltano/${card.icon}`} alt="" width={32} height={32} />
            </span>
            <Image className="meltano-community-image" src={`/meltano/${card.image}`} alt={card.alt} width={280} height={198} />
            <h3>{card.title}</h3>
            <span className="meltano-arrow-link">{card.caption}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
