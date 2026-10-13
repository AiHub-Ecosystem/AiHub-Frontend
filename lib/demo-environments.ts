/**
 * The Demo environment: the request tier a demo visit explicitly selects. The
 * selected tier must match the key's backend-authorized environment; the BFF
 * never silently switches a request to another host (ADR-0018).
 */
export const DEMO_ENVIRONMENTS = ["sandbox", "production"] as const;

export type DemoEnvironment = (typeof DEMO_ENVIRONMENTS)[number];

export const DEFAULT_DEMO_ENVIRONMENT: DemoEnvironment = "sandbox";

/** What a demo key is validated for, shared by the page and its BFF route. */
export type DemoScope = "writing.grade" | "speaking.grade";

const DEMO_ENVIRONMENT_HOSTS: Record<DemoEnvironment, string> = {
  sandbox: "https://sandbox.aihubproduction.com",
  production: "https://api.aihubproduction.com",
};

const DEMO_ENVIRONMENT_LABELS: Record<DemoEnvironment, string> = {
  sandbox: "Sandbox (miễn phí)",
  production: "Production (tính phí)",
};

/** The bare name, for a field label that reads "API key Sandbox". */
const DEMO_ENVIRONMENT_NAMES: Record<DemoEnvironment, string> = {
  sandbox: "Sandbox",
  production: "Production",
};

export function demoEnvironmentHost(environment: DemoEnvironment) {
  return DEMO_ENVIRONMENT_HOSTS[environment];
}

export function demoEnvironmentName(environment: DemoEnvironment) {
  return DEMO_ENVIRONMENT_NAMES[environment];
}

export function demoEnvironmentLabel(environment: DemoEnvironment) {
  return DEMO_ENVIRONMENT_LABELS[environment];
}
