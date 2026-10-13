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
  grading: boolean;
  beginGrading: () => boolean;
  endGrading: () => void;
  setApiKey: (value: string) => void;
  setEnvironment: (value: DemoEnvironment) => void;
  /** The counter to capture at submit and pass back to isSelectionCurrent. */
  selectionGeneration: () => number;
  isSelectionCurrent: (
    apiKey: string,
    environment: DemoEnvironment,
    generation: number
  ) => boolean;
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
 * lives in the page: the key, the selected environment, the validation results,
 * the Production acknowledgement, and the in-flight grade lock (ADR-0018).
 * Leaving the demo, a logout in any tab, or a bfcache restore drops the visit.
 */
export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(createDemoVisitState);
  const [grading, setGrading] = useState(false);
  const stateRef = useRef(state);
  const identity = useRef<string | null>(null);
  const gradingRef = useRef(false);

  const update = useCallback((next: DemoVisitState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const forget = () => {
      identity.current = null;
      update(clearDemoVisit(stateRef.current));
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
  const beginGrading = useCallback(() => {
    if (gradingRef.current) return false;
    gradingRef.current = true;
    setGrading(true);
    return true;
  }, []);
  const endGrading = useCallback(() => {
    gradingRef.current = false;
    setGrading(false);
  }, []);
  const selectionGeneration = useCallback(
    () => stateRef.current.generation,
    []
  );
  const isSelectionCurrent = useCallback(
    (apiKey: string, environment: DemoEnvironment, generation: number) =>
      isSelectionCurrentIn(stateRef.current, apiKey, environment, generation),
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
      grading,
      beginGrading,
      endGrading,
      setApiKey,
      setEnvironment,
      selectionGeneration,
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
      grading,
      beginGrading,
      endGrading,
      setApiKey,
      setEnvironment,
      selectionGeneration,
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
