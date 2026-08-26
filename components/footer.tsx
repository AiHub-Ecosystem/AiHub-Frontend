"use client";

import { useState } from "react";
import Link from "next/link";
import { AiHubLogo } from "@/components/svg/brand";
import {
  GithubIcon,
  LinkedinIcon,
  SlackIcon,
  TwitterIcon,
  YoutubeIcon,
  ArrowRightIcon,
} from "@/components/svg/icons";
import { navCompany, navProduct, navResources } from "@/data/site";

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; description?: string }[];
}) {
  return (
    <div>
      <div className="mb-4 text-xs font-bold uppercase tracking-widest text-soft">{title}</div>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.label + link.href}>
            <Link
              href={link.href}
              className="text-sm text-ink/80 transition-colors hover:text-brand-blue"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSubscribed(true);
  };

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-16 text-line">
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="h-full w-full">
          <path
            d="M0 32 H1440"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="2 18"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <div className="flex items-center gap-2 text-ink">
              <AiHubLogo />
            </div>
            <p className="mt-5 max-w-sm text-soft">
              Stay current with all things AiHub. AI trends, tutorials, and product
              updates — straight to your inbox.
            </p>

            {subscribed ? (
              <div className="mt-6 rounded-2xl border border-brand-green/50 bg-brand-green/10 px-5 py-4 text-sm font-semibold text-brand-green">
                You&apos;re in! Welcome to AiHub.
              </div>
            ) : (
              <form
                onSubmit={submit}
                className="newsletter-mini-box mt-6 flex max-w-md items-center gap-2 rounded-full border border-line bg-card p-1.5"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="w-full bg-transparent px-4 py-2 text-sm text-ink outline-none placeholder:text-soft"
                />
                <button
                  type="submit"
                  className="btn-gradient shrink-0 rounded-full px-5 py-2.5 text-sm font-bold text-white"
                >
                  Subscribe
                </button>
              </form>
            )}

            <div className="mt-8 flex items-center gap-3">
              {[
                { href: "https://github.com", icon: GithubIcon, label: "GitHub" },
                { href: "https://slack.com", icon: SlackIcon, label: "Slack" },
                { href: "https://twitter.com", icon: TwitterIcon, label: "Twitter" },
                { href: "https://linkedin.com", icon: LinkedinIcon, label: "LinkedIn" },
                { href: "https://youtube.com", icon: YoutubeIcon, label: "YouTube" },
              ].map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink/70 transition-colors hover:border-brand-blue hover:text-brand-blue"
                >
                  <Icon className="h-4.5 w-4.5" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol title="Product" links={navProduct.links} />
            <FooterCol title="Resources" links={navResources.links} />
            <FooterCol
              title="Company"
              links={[
                ...navCompany.links,
                { label: "Pricing", href: "/pricing" },
                { label: "Pricing calculator", href: "/pricingcalculator" },
              ]}
            />
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-line pt-8 sm:flex-row sm:items-center">
          <div className="text-sm text-soft">© AiHub 2026 · AI API Ecosystem Platform</div>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/terms-of-service" className="text-sm text-soft transition-colors hover:text-brand-blue">
              Terms of Service
            </Link>
            <Link href="/privacy-policy" className="text-sm text-soft transition-colors hover:text-brand-blue">
              Privacy Policy
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:gap-2 transition-all">
              Contact us <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
