/** Environment used for validation and grading; the backend remains authoritative. */
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

const DEMO_INTERFACE_ENVIRONMENT_LABELS: Record<DemoEnvironment, string> = {
  sandbox: "Dùng thử miễn phí",
  production: "Môi trường thật · Có thể tính phí",
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

export function demoInterfaceEnvironmentLabel(environment: DemoEnvironment) {
  return DEMO_INTERFACE_ENVIRONMENT_LABELS[environment];
}

/** Routes newly issued key prefixes to validation; only the backend authorizes them. */
export function demoEnvironmentHintFromApiKey(
  apiKey: string
): DemoEnvironment | null {
  if (apiKey.startsWith("aihub_sandbox_")) return "sandbox";
  if (apiKey.startsWith("aihub_prod_")) return "production";
  return null;
}

export function demoEnvironmentRequiresSelection(apiKey: string) {
  return apiKey.startsWith("aihub_sk_");
}
