import Image from "next/image";

const logos = [
  ["citysprint_logo.fc677050.webp", "CitySprint"],
  ["logo-300x98.360b4ffe.webp", "Little Bike"],
  ["a500px-ResidentAdvisor_logo.6aa1e962.png", "Resident Advisor"],
  ["MVF_Logo_Navy.e88bd6be.webp", "MVF"],
  ["Consil_logo.9bd817ec.png", "Consil"],
  ["IFG_logo.ad521484.svg", "IFG"],
  ["Lotus_Labs_logo.20c05ef2.png", "Lotus Labs"],
  ["session-climbing_logo.9d498ccf.png", "Session Climbing"],
  ["Vertex_logo.0dafa0fc.svg", "Vertex"],
  ["VIEVE_logo.9f5d14b8.svg", "VIEVE"],
  ["Woom_logo.2a837afb.svg", "Woom"],
  ["netlify.9aa56503.svg", "Netlify"],
  ["hackerone.4665cb1d.svg", "HackerOne"],
  ["gitlub.c106fef9.svg", "GitLab"],
  ["zapier.d94b3175.svg", "Zapier"],
  ["remote.f0209dc0.svg", "Remote"],
] as const;

export function LogoMarquee() {
  return (
    <section className="meltano-logos-section">
      <p>Loved by data teams</p>
      <div className="marquee-mask overflow-hidden">
        <div className="meltano-logo-track">
          {[...logos, ...logos].map(([src, alt], index) => (
            <div className="meltano-logo-item" key={`${src}-${index}`}>
              <Image src={`/meltano/${src}`} alt={alt} width={260} height={60} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
