import type { DemoEnvironment, DemoScope } from "@/lib/demo-environments";
import { DEFAULT_DEMO_ENVIRONMENT } from "@/lib/demo-environments";
import type { DemoIdentityMode } from "@/lib/demo-identity";

export type { DemoScope };

/**
 * One Demo visit's whole mutable state. Held in the page and nowhere else: no
 * cookie, web storage, URL, logs, or analytics. A validated key may appear in
 * copied commands by design (ADR-0020). The Demo identity lives beside this in
 * the provider and goes when this does.
 */
export type DemoVisitState = {
  apiKey: string;
  environment: DemoEnvironment;
  /** Scopes this key validated for, in the environment now selected. */
  validatedScopes: readonly DemoScope[];
  productionAcknowledged: boolean;
  userIdentityMode: DemoIdentityMode | null;
  /** Bumps on every real change of key or environment, so A to B to A is not A. */
  generation: number;
};

export function createDemoVisitState(): DemoVisitState {
  return {
    apiKey: "",
    environment: DEFAULT_DEMO_ENVIRONMENT,
    validatedScopes: [],
    productionAcknowledged: false,
    userIdentityMode: null,
    generation: 0,
  };
}

/** Key, environment and the request bound together; see isSelectionCurrent. */
export function setApiKey(state: DemoVisitState, apiKey: string) {
  if (state.apiKey === apiKey) return state;
  return {
    ...state,
    apiKey,
    validatedScopes: [],
    productionAcknowledged: false,
    userIdentityMode: null,
    generation: state.generation + 1,
  };
}

export function setEnvironment(
  state: DemoVisitState,
  environment: DemoEnvironment
) {
  if (state.environment === environment) return state;
  return {
    ...state,
    environment,
    validatedScopes: [],
    productionAcknowledged: false,
    userIdentityMode: null,
    generation: state.generation + 1,
  };
}

/**
 * Whether a validation response still belongs to the key and environment on
 * screen. A visitor who edits the key or switches environment while a check is
 * in flight must not have the late answer unlock the new selection. The
 * generation also catches a return to an earlier selection (A, B, A again).
 */
export function isSelectionCurrent(
  state: DemoVisitState,
  apiKey: string,
  environment: DemoEnvironment,
  generation: number
) {
  return (
    state.generation === generation &&
    state.apiKey.trim() === apiKey.trim() &&
    state.environment === environment
  );
}

export function markScopeValidated(state: DemoVisitState, scope: DemoScope) {
  return state.validatedScopes.includes(scope)
    ? state
    : { ...state, validatedScopes: [...state.validatedScopes, scope] };
}

export function setUserIdentityMode(
  state: DemoVisitState,
  userIdentityMode: DemoIdentityMode | null
) {
  return state.userIdentityMode === userIdentityMode
    ? state
    : { ...state, userIdentityMode };
}

export function isScopeValidated(state: DemoVisitState, scope: DemoScope) {
  return state.validatedScopes.includes(scope);
}

export function clearScopeValidation(state: DemoVisitState) {
  return state.validatedScopes.length === 0
    ? state
    : { ...state, validatedScopes: [] };
}

/** True when the visit may not send a Production grade until it is acknowledged. */
export function requiresProductionAcknowledgement(state: DemoVisitState) {
  return state.environment === "production" && !state.productionAcknowledged;
}

export function acknowledgeProduction(state: DemoVisitState) {
  return state.productionAcknowledged
    ? state
    : { ...state, productionAcknowledged: true };
}

/** Leaving the demo, logging out in any tab, or a bfcache restore. */
export function clearDemoVisit(state: DemoVisitState): DemoVisitState {
  return { ...createDemoVisitState(), generation: state.generation + 1 };
}

/**
 * The Sandbox allowance the validation response reported. Advisory, and kept
 * apart from key validity: a key can be valid while the Organization is out of
 * allowance, and null means the backend could not read the policy at all.
 */
export type SandboxAllowanceSnapshot = {
  monthlyLimit: number;
  reserved: number;
  sharedMonthlyLimit: number;
  sharedReserved: number;
};

/**
 * Reads the allowance out of a validation payload, or null when there is none to
 * report. A malformed snapshot is treated as no snapshot rather than a number
 * the demo would display as if it were trustworthy.
 */
export function sandboxAllowanceFrom(
  payload: unknown
): SandboxAllowanceSnapshot | null {
  if (typeof payload !== "object" || payload === null || !("data" in payload))
    return null;
  const data = (payload as { data: unknown }).data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("valid" in data) ||
    data.valid !== true ||
    !("environment" in data) ||
    data.environment !== "sandbox" ||
    !("allowance" in data)
  )
    return null;
  const allowance = (data as { allowance: unknown }).allowance;
  if (
    typeof allowance !== "object" ||
    allowance === null ||
    typeof (allowance as { monthly_limit?: unknown }).monthly_limit !==
      "number" ||
    typeof (allowance as { reserved?: unknown }).reserved !== "number" ||
    typeof (allowance as { shared_monthly_limit?: unknown })
      .shared_monthly_limit !== "number" ||
    typeof (allowance as { shared_reserved?: unknown }).shared_reserved !==
      "number"
  )
    return null;
  const counts = allowance as {
    monthly_limit: number;
    reserved: number;
    shared_monthly_limit: number;
    shared_reserved: number;
  };
  if (
    !Object.values(counts).every(
      (value) => Number.isSafeInteger(value) && value >= 0
    )
  )
    return null;
  return {
    monthlyLimit: counts.monthly_limit,
    reserved: counts.reserved,
    sharedMonthlyLimit: counts.shared_monthly_limit,
    sharedReserved: counts.shared_reserved,
  };
}

/** Dispatches left under both the Organization and shared Sandbox caps. */
export function remainingAllowance(snapshot: SandboxAllowanceSnapshot) {
  return Math.min(
    remainingOrganizationAllowance(snapshot),
    remainingSharedAllowance(snapshot)
  );
}

export function remainingOrganizationAllowance(
  snapshot: SandboxAllowanceSnapshot
) {
  return Math.max(0, snapshot.monthlyLimit - snapshot.reserved);
}

export function remainingSharedAllowance(snapshot: SandboxAllowanceSnapshot) {
  return Math.max(0, snapshot.sharedMonthlyLimit - snapshot.sharedReserved);
}

/**
 * Whether the snapshot leaves room for one more dispatch. `null` means the
 * backend could not read the policy, and the demo must not then claim the
 * allowance is available.
 */
export function allowanceAdmitsOneMore(
  snapshot: SandboxAllowanceSnapshot | null
): boolean | null {
  return snapshot === null ? null : remainingAllowance(snapshot) > 0;
}
