export type NavLink = {
  label: string;
  href: string;
  description?: string;
};

export type NavGroup = {
  title: string;
  links: NavLink[];
};

export const navProduct: NavGroup = {
  title: "Product",
  links: [
    {
      label: "Overview",
      description: "AI API ecosystem platform for education and beyond",
      href: "/product",
    },
    {
      label: "Exercise Generation",
      description: "Generate targeted writing exercises from authentic learner errors",
      href: "/product/exercise-generation",
    },
    {
      label: "Interactive Demo",
      description: "Experience AiHub APIs directly in your browser",
      href: "/demo/exercise-generation",
    },
    {
      label: "API Reference",
      description: "Complete OpenAPI contracts and schema definitions",
      href: "/product",
    },
  ],
};

export const navResources: NavGroup = {
  title: "Resources",
  links: [
    {
      label: "Documentation",
      description: "Learn how to use AiHub and where to get started",
      href: "/product",
    },
    {
      label: "Community",
      description: "Join developers and educators building with AiHub",
      href: "/community",
    },
    {
      label: "Blog",
      description: "Stay up to date on AiHub & AI engineering",
      href: "/blog",
    },
    {
      label: "Podcasts",
      description: "Conversations with AI engineers and practitioners",
      href: "/podcasts",
    },
    {
      label: "Case Studies",
      description: "See how partners use AiHub in production",
      href: "/case-studies",
    },
  ],
};

export const navCompany: NavGroup = {
  title: "Company",
  links: [
    {
      label: "About",
      description: "AiHub is an AI API ecosystem platform",
      href: "/about",
    },
    {
      label: "Contact",
      description: "The AiHub team is here to help. Ask us anything, or give us your feedback!",
      href: "/contact",
    },
  ],
};

export const pricingPlans = [
  {
    name: "Starter",
    tagline: "Get your first managed pipelines running in hours, not weeks.",
    price: "Free",
    period: "open source, self-managed",
    featured: false,
    features: [
      "200 compute hours / mo",
      "Managed infrastructure",
      "25 workspaces",
      "Unlimited users",
      "600+ connectors",
      "Reverse ETL included",
      "AI data engineer agent",
      "Community support",
    ],
  },
  {
    name: "Growth",
    tagline: "Scale pipelines with real engineering support baked in.",
    price: "From $600",
    period: "per month",
    featured: true,
    features: [
      "2,000 compute hours / mo",
      "10x more than Starter",
      "Everything in Starter",
      "100 workspaces",
      "8 hours of engineering on demand/mo",
      "Shared account management",
      "Add on: Cost monitoring workspace",
    ],
  },
  {
    name: "Scale",
    tagline: "Dedicated support. Full platform access. Nothing held back.",
    price: "From $1,800",
    period: "per month",
    featured: false,
    features: [
      "5,000 compute hours / mo",
      "25x more than Starter",
      "Everything in Growth",
      "Unlimited workspaces",
      "15 hours of engineering on demand/mo",
      "Dedicated account management",
      "Cost monitoring workspace included",
    ],
  },
  {
    name: "Enterprise",
    tagline: "Truly custom. For organisations with serious data at scale.",
    price: "Custom",
    period: "annual contract",
    featured: false,
    features: [
      "Unlimited compute hours / mo",
      "No limits",
      "Everything in Scale",
      "Custom connectors",
      "Custom hours of engineering on demand/mo",
      "Custom SLA",
      "Strategic advisory",
    ],
  },
];

export const connectors = [
  { name: "Airtable", variant: "Community" },
  { name: "Amazon S3", variant: "AiHub Cloud" },
  { name: "AppFigures", variant: "Community" },
  { name: "Asana", variant: "Community" },
  { name: "Auth0", variant: "AiHub Cloud" },
  { name: "AWS Cognito", variant: "Community" },
  { name: "AWS Cost Explorer", variant: "Community" },
  { name: "Azure Blob Storage", variant: "Community" },
  { name: "BambooHR", variant: "Community" },
  { name: "BigCommerce", variant: "Community" },
  { name: "BigQuery", variant: "AiHub Cloud" },
  { name: "Bing Ads", variant: "AiHub Cloud" },
  { name: "Braintree", variant: "Community" },
  { name: "CallMiner", variant: "AiHub Cloud" },
  { name: "Campaign Monitor", variant: "Community" },
  { name: "Cassandra", variant: "Community" },
  { name: "Chargebee", variant: "Community" },
  { name: "CircleCI", variant: "Community" },
  { name: "ClickUp", variant: "Community" },
  { name: "Close", variant: "Community" },
  { name: "Confluence", variant: "Community" },
  { name: "Contentful", variant: "Community" },
  { name: "Criteo", variant: "Community" },
  { name: "Dagster", variant: "Community" },
  { name: "dbt", variant: "AiHub Cloud" },
  { name: "Datadog", variant: "Community" },
  { name: "Dynamics 365", variant: "Community" },
  { name: "Elasticsearch", variant: "Community" },
  { name: "Facebook Ads", variant: "AiHub Cloud" },
  { name: "Facebook Pages", variant: "Community" },
  { name: "Freshdesk", variant: "Community" },
  { name: "GA4", variant: "AiHub Cloud" },
  { name: "GitHub", variant: "Community" },
  { name: "GitLab", variant: "Community" },
  { name: "Google Ads", variant: "AiHub Cloud" },
  { name: "Google Analytics", variant: "AiHub Cloud" },
  { name: "Google BigQuery", variant: "AiHub Cloud" },
  { name: "Google Drive", variant: "Community" },
  { name: "Google Sheets", variant: "Community" },
  { name: "Greenhouse", variant: "Community" },
  { name: "HubSpot", variant: "Community" },
  { name: "Intercom", variant: "Community" },
  { name: "Jira", variant: "Community" },
  { name: "Klaviyo", variant: "Community" },
  { name: "LinkedIn Ads", variant: "AiHub Cloud" },
  { name: "Mailchimp", variant: "Community" },
  { name: "Marketo", variant: "Community" },
  { name: "Microsoft SQL Server", variant: "AiHub Cloud" },
  { name: "Mixpanel", variant: "Community" },
  { name: "MongoDB", variant: "Community" },
  { name: "MySQL", variant: "AiHub Cloud" },
  { name: "NetSuite", variant: "Community" },
  { name: "Notion", variant: "Community" },
  { name: "OneDrive", variant: "Community" },
  { name: "Oracle", variant: "AiHub Cloud" },
  { name: "Pardot", variant: "Community" },
  { name: "PayPal", variant: "Community" },
  { name: "Pendo", variant: "Community" },
  { name: "Pipedrive", variant: "Community" },
  { name: "PostgreSQL", variant: "AiHub Cloud" },
  { name: "QuickBooks", variant: "Community" },
  { name: "Redshift", variant: "AiHub Cloud" },
  { name: "Salesforce", variant: "AiHub Cloud" },
  { name: "SAP HANA", variant: "Community" },
  { name: "Segment", variant: "Community" },
  { name: "SendGrid", variant: "Community" },
  { name: "Shopify", variant: "Community" },
  { name: "Slack", variant: "Community" },
  { name: "Snowflake", variant: "AiHub Cloud" },
  { name: "Square", variant: "Community" },
  { name: "Stripe", variant: "Community" },
  { name: "SurveyMonkey", variant: "Community" },
  { name: "Tableau", variant: "Community" },
  { name: "Trello", variant: "Community" },
  { name: "Twilio", variant: "Community" },
  { name: "Twitter / X", variant: "Community" },
  { name: "Typeform", variant: "Community" },
  { name: "WooCommerce", variant: "Community" },
  { name: "WordPress", variant: "Community" },
  { name: "Xero", variant: "Community" },
  { name: "Zendesk", variant: "Community" },
  { name: "Zoho CRM", variant: "Community" },
  { name: "Zuora", variant: "Community" },
];

export const blogPosts = [
  {
    title: "Guaranteed Recovery: How We Turned Performance Wins Into a Documented MTTR",
    date: "01 Jul 2026",
    excerpt:
      "Faster pipelines were just the warm-up. Here's how we turned that speed into a number you can build a recovery plan around.",
    tag: "Engineering",
    href: "/blog/guaranteed-recovery",
  },
  {
    title: "Building Custom AI Integrations: Create Your First Pipeline in Days, Not Months",
    date: "29 Jun 2026",
    excerpt:
      "Anyone can build a production-ready AI integration with AiHub's open framework and structured schemas.",
    tag: "Tutorial",
    href: "/blog/building-custom-data-connectors",
  },
  {
    title: "Optimizing AI Generation Latency: Making Exercise Generation Fast and Reliable",
    date: "24 Jun 2026",
    excerpt:
      "Learn how we overhauled prompt execution and reference sampling to deliver high-quality exercises in under a second.",
    tag: "Engineering",
    href: "/blog/optimizing-mysql-backfills",
  },
  {
    title: "Introducing AiHub v1 with Structured Output Validation and Fallback",
    date: "05 Jun 2026",
    excerpt:
      "Structured schema validation and automatic fallback come built in — ensuring 100% uptime for production consumers.",
    tag: "Product",
    href: "/blog/introducing-meltano-v4",
  },
  {
    title: "Bring Observability to Your AI Platform",
    date: "02 Jun 2026",
    excerpt:
      "AiHub metrics and trace IDs bring full pipeline observability into the monitoring platform your team trusts.",
    tag: "Integration",
    href: "/blog/datadog-observability",
  },
  {
    title: "Adaptive Exercise Generation That Truly Understands Learner Mistakes",
    date: "26 May 2026",
    excerpt:
      "Traditional rule-based drills miss subtle nuances. Here's how AiHub connects authentic mistakes to targeted practice.",
    tag: "How-to",
    href: "/blog/power-bi-refresh",
  },
  {
    title: "The Little Bike Company Boosts Monthly Productivity by 20%",
    date: "18 May 2026",
    excerpt:
      "How an education partner streamlined writing evaluation with AiHub and reclaimed valuable instructor time.",
    tag: "Case Study",
    href: "/blog/little-bike-company",
  },
  {
    title: "Scaling Writing Evaluation to 1M+ Exercises Across 28 Error Codes",
    date: "12 May 2026",
    excerpt:
      "How AiHub scaled IELTS Writing exercise generation across thousands of learners with zero downtime.",
    tag: "Case Study",
    href: "/blog/mvf-etl-7x-cheaper",
  },
  {
    title: "How EdTech Teams Accelerate Curriculum Development with AI",
    date: "04 May 2026",
    excerpt:
      "Academic teams build rich, error-focused practice material effortlessly with AiHub's specialized API suite.",
    tag: "Case Study",
    href: "/blog/resident-advisor",
  },
];

export const podcasts = [
  {
    title: "AI & EdTech: The Future of Personalized Learning",
    season: "Season 3",
    excerpt: "Conversations with the researchers and engineers building next-gen learning platforms.",
  },
  {
    title: "AI in Production: High-Reliability LLM Architectures",
    season: "Season 2",
    excerpt: "Teams share how they run structured AI generation at scale.",
  },
  {
    title: "Getting Started with the AiHub API Suite",
    season: "Season 1",
    excerpt: "A practical walkthrough of OpenAPI contracts and integrating AiWriting into your app.",
  },
];

export const heroLogos = [
  "CitySprint",
  "Little Bike Co",
  "Resident Advisor",
  "MVF",
  "Consil",
  "IFG",
  "Lotus Labs",
  "Session Climbing",
  "Vertex",
  "VIEVE",
  "Woom",
  "Netlify",
  "HackerOne",
  "GitLab",
  "Zapier",
  "Remote",
];

export const connectorSavings = [
  { name: "Facebook Ads", range: "45-65%", color: "#18c3fa" },
  { name: "Google Ads", range: "45-65%", color: "#f963bc" },
  { name: "MySQL", range: "55-75%", color: "#99ce55" },
  { name: "Bing Ads", range: "45-65%", color: "#ff5f3c" },
  { name: "GA4", range: "45-65%", color: "#fbcc54" },
];
