"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { DemoEnvironment } from "@/lib/demo-environments";
import { isLogoutSignal } from "@/lib/logout-signal";
import {
  acknowledgeProduction as acknowledgeProductionIn,
  clearDemoVisit,
  clearScopeValidation as clearScopeValidationIn,
  createDemoVisitState,
  isScopeValidated as isScopeValidatedIn,
  isSelectionCurrent as isSelectionCurrentIn,
  markScopeValidated as markScopeValidatedIn,
  requiresProductionAcknowledgement as requiresAcknowledgementIn,
  setApiKey as setApiKeyIn,
  setEnvironment as setEnvironmentIn,
  type DemoScope,
  type DemoVisitState,
} from "./demo-session-state";

export type { DemoScope };

type DemoSession = {
  state: DemoVisitState;
  setApiKey: (value: string) => void;
  setEnvironment: (value: DemoEnvironment) => void;
  isSelectionCurrent: (apiKey: string, environment: DemoEnvironment) => boolean;
  isScopeValidated: (scope: DemoScope) => boolean;
  markScopeValidated: (scope: DemoScope) => void;
  clearScopeValidation: () => void;
  requiresProductionAcknowledgement: () => boolean;
  acknowledgeProduction: () => void;
  getUserIdentity: () => string;
};

const DemoSessionContext = createContext<DemoSession | null>(null);

/**
 * One Demo visit, shared by the Writing and Speaking pages. Everything here
 * lives in the page: the key, the selected environment, the validation results
 * and the Production acknowledgement (ADR-0018). Leaving the demo, a logout in
 * any tab, or a bfcache restore drops all of it.
 */
export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(createDemoVisitState);
  const stateRef = useRef(state);
  const identity = useRef<string | null>(null);

  const update = useCallback((next: DemoVisitState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const forget = () => {
      identity.current = null;
      update(clearDemoVisit());
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) forget();
    };
    const onStorage = (event: StorageEvent) => {
      if (isLogoutSignal(event)) forget();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
    };
  }, [update]);

  const setApiKey = useCallback(
    (value: string) => update(setApiKeyIn(stateRef.current, value)),
    [update]
  );
  const setEnvironment = useCallback(
    (value: DemoEnvironment) =>
      update(setEnvironmentIn(stateRef.current, value)),
    [update]
  );
  const isSelectionCurrent = useCallback(
    (apiKey: string, environment: DemoEnvironment) =>
      isSelectionCurrentIn(stateRef.current, apiKey, environment),
    []
  );
  const isScopeValidated = useCallback(
    (scope: DemoScope) => isScopeValidatedIn(stateRef.current, scope),
    []
  );
  const markScopeValidated = useCallback(
    (scope: DemoScope) => update(markScopeValidatedIn(stateRef.current, scope)),
    [update]
  );
  const clearScopeValidation = useCallback(
    () => update(clearScopeValidationIn(stateRef.current)),
    [update]
  );
  const requiresProductionAcknowledgement = useCallback(
    () => requiresAcknowledgementIn(stateRef.current),
    []
  );
  const acknowledgeProduction = useCallback(
    () => update(acknowledgeProductionIn(stateRef.current)),
    [update]
  );
  const getUserIdentity = useCallback(() => {
    identity.current ??= globalThis.crypto.randomUUID();
    return identity.current;
  }, []);

  const value = useMemo(
    () => ({
      state,
      setApiKey,
      setEnvironment,
      isSelectionCurrent,
      isScopeValidated,
      markScopeValidated,
      clearScopeValidation,
      requiresProductionAcknowledgement,
      acknowledgeProduction,
      getUserIdentity,
    }),
    [
      state,
      setApiKey,
      setEnvironment,
      isSelectionCurrent,
      isScopeValidated,
      markScopeValidated,
      clearScopeValidation,
      requiresProductionAcknowledgement,
      acknowledgeProduction,
      getUserIdentity,
    ]
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSession() {
  const session = useContext(DemoSessionContext);
  if (!session) throw new Error("DemoSessionProvider is missing");
  return session;
}
