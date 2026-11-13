import { Hanken_Grotesk } from "next/font/google";
import { PRODUCTION_HOST } from "@/data/docs-guide";
import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { BeforeAfter, EndpointStrip, Pipeline } from "./landing-flow";
import { LiveDemo } from "./landing-demo";
import { ProductTabs } from "./landing-products";
import { Integration } from "./landing-integration";
import { FinalCta, LandingFooter, Pricing } from "./landing-closing";
import { TrialKey } from "./landing-trial";
import {
  buildTrialCurl,
  buildTrialPrompt,
  readPublicTrialKey,
  TRIAL_DAILY_LIMIT,
  TRIAL_PER_IP_DAILY_LIMIT,
} from "@/lib/public-trial";

// Body face of the AiHub design system. Only the landing uses it, so it is
// loaded here rather than in the root layout next to Plus Jakarta and Plex Mono.
const hanken = Hanken_Grotesk({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-hanken",
});

/** Home page, built from the "Landing v2 (Future / motion)" design board. */
export function AihubLanding({ signedIn }: { signedIn: boolean }) {
  const trialKey = readPublicTrialKey();
  const origin = process.env.CUSTOMER_WEB_ORIGIN?.replace(/\/+$/, "");
  const registerUrl = origin
    ? `${origin}/register`
    : "trang Đăng ký trên website AiHub";
  return (
    <div className={`al-page ${hanken.variable}`}>
      <LandingNav signedIn={signedIn} />
      <div className="al-rail">
        <main>
          <LandingHero />
          <EndpointStrip />
          <TrialKey
            apiKey={trialKey}
            prompt={buildTrialPrompt(trialKey, registerUrl)}
            curl={buildTrialCurl(trialKey)}
            dailyLimit={TRIAL_DAILY_LIMIT}
            perIpLimit={TRIAL_PER_IP_DAILY_LIMIT}
          />
          <Pipeline />
          <BeforeAfter />
          <LiveDemo />
          <ProductTabs />
          <Integration host={PRODUCTION_HOST} />
          <Pricing />
          <FinalCta />
        </main>
        <LandingFooter host={PRODUCTION_HOST} />
      </div>
    </div>
  );
}
