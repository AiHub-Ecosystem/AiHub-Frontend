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
import type { DemoIdentityMode } from "@/lib/demo-identity";
import {
  DemoAssertionEndpointError,
  fetchDemoAssertion,
} from "@/lib/demo-assertion-endpoint";
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
  setUserIdentityMode as setUserIdentityModeIn,
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
  mockUserIdentity: string;
  prepareMockUserIdentity: () => void;
  userIdentity: string;
  userIdentityExpiresAt: number | null;
  setUserIdentity: (value: string) => void;
  isUserIdentityExpired: () => boolean;
  setUserIdentityMode: (mode: DemoIdentityMode | null) => void;
  assertionEndpointUrl: string;
  setAssertionEndpointUrl: (value: string) => void;
  assertionRequestStatus: "idle" | "loading" | "ready" | "error";
  assertionRequestMessage: string;
  fetchAssertion: () => Promise<void>;
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
  const [mockUserIdentity, setMockUserIdentity] = useState("");
  const [userIdentity, setUserIdentityState] = useState("");
  const [userIdentityExpiresAt, setUserIdentityExpiresAt] = useState<
    number | null
  >(null);
  const [assertionEndpointUrl, setAssertionEndpointUrlState] = useState("");
  const [assertionRequestStatus, setAssertionRequestStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [assertionRequestMessage, setAssertionRequestMessage] = useState("");
  const stateRef = useRef(state);
  const gradingRef = useRef(false);
  const mockUserIdentityRef = useRef("");
  const assertionEndpointUrlRef = useRef(assertionEndpointUrl);
  const assertionRequestRef = useRef<AbortController | null>(null);
  const userIdentityExpiresAtRef = useRef<number | null>(null);

  const update = useCallback((next: DemoVisitState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const prepareMockUserIdentity = useCallback(() => {
    if (mockUserIdentityRef.current) return;
    const identity = globalThis.crypto.randomUUID();
    mockUserIdentityRef.current = identity;
    setMockUserIdentity(identity);
  }, []);

  const cancelAssertionRequest = useCallback(() => {
    assertionRequestRef.current?.abort();
    assertionRequestRef.current = null;
  }, []);
  const clearAssertionState = useCallback(() => {
    cancelAssertionRequest();
    assertionEndpointUrlRef.current = "";
    setAssertionEndpointUrlState("");
    setUserIdentityState("");
    userIdentityExpiresAtRef.current = null;
    setUserIdentityExpiresAt(null);
    setAssertionRequestStatus("idle");
    setAssertionRequestMessage("");
  }, [cancelAssertionRequest]);

  const setUserIdentity = useCallback(
    (value: string) => {
      cancelAssertionRequest();
      setUserIdentityState(value);
      userIdentityExpiresAtRef.current = null;
      setUserIdentityExpiresAt(null);
      setAssertionRequestStatus("idle");
      setAssertionRequestMessage("");
    },
    [cancelAssertionRequest]
  );
  const isUserIdentityExpired = useCallback(() => {
    const expiresAt = userIdentityExpiresAtRef.current;
    return expiresAt !== null && Date.now() >= expiresAt;
  }, []);

  useEffect(() => {
    if (userIdentityExpiresAt === null) return;
    let timer: number;
    const expire = () => {
      if (userIdentityExpiresAtRef.current !== userIdentityExpiresAt) return;
      const remaining = userIdentityExpiresAt - Date.now();
      if (remaining <= 0) {
        setAssertionRequestStatus("error");
        setAssertionRequestMessage(
          "Assertion đã hết hạn. Hãy lấy assertion mới trước khi tiếp tục."
        );
      } else {
        timer = window.setTimeout(expire, Math.min(remaining, 2_147_483_647));
      }
    };
    timer = window.setTimeout(
      expire,
      Math.min(Math.max(0, userIdentityExpiresAt - Date.now()), 2_147_483_647)
    );
    return () => window.clearTimeout(timer);
  }, [userIdentityExpiresAt]);

  useEffect(() => {
    if (!grading) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [grading]);

  useEffect(() => {
    const forget = () => {
      clearAssertionState();
      mockUserIdentityRef.current = "";
      setMockUserIdentity("");
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
  }, [clearAssertionState, update]);
  useEffect(() => () => cancelAssertionRequest(), [cancelAssertionRequest]);

  const setApiKey = useCallback(
    (value: string) => {
      const next = setApiKeyIn(stateRef.current, value);
      if (next === stateRef.current) return;
      clearAssertionState();
      update(next);
    },
    [clearAssertionState, update]
  );
  const setEnvironment = useCallback(
    (value: DemoEnvironment) => {
      const next = setEnvironmentIn(stateRef.current, value);
      if (next === stateRef.current) return;
      clearAssertionState();
      update(next);
    },
    [clearAssertionState, update]
  );
  const setUserIdentityMode = useCallback(
    (mode: DemoIdentityMode | null) => {
      const current = stateRef.current;
      if (current.userIdentityMode === mode) return;
      clearAssertionState();
      setUserIdentityState(
        mode === "declared_id" ? globalThis.crypto.randomUUID() : ""
      );
      update(setUserIdentityModeIn(current, mode));
    },
    [clearAssertionState, update]
  );
  const setCustomerAssertionEndpointUrl = useCallback(
    (value: string) => {
      if (assertionEndpointUrlRef.current === value) return;
      cancelAssertionRequest();
      assertionEndpointUrlRef.current = value;
      setAssertionEndpointUrlState(value);
      setUserIdentityState("");
      userIdentityExpiresAtRef.current = null;
      setUserIdentityExpiresAt(null);
      setAssertionRequestStatus("idle");
      setAssertionRequestMessage("");
    },
    [cancelAssertionRequest]
  );
  const fetchAssertion = useCallback(async () => {
    const endpoint = assertionEndpointUrlRef.current;
    if (stateRef.current.userIdentityMode !== "signed_assertion") return;

    cancelAssertionRequest();
    const controller = new AbortController();
    assertionRequestRef.current = controller;
    const generation = stateRef.current.generation;
    setUserIdentityState("");
    userIdentityExpiresAtRef.current = null;
    setUserIdentityExpiresAt(null);
    setAssertionRequestStatus("loading");
    setAssertionRequestMessage("");
    try {
      const assertion = await fetchDemoAssertion(endpoint, controller.signal);
      if (
        controller.signal.aborted ||
        assertionRequestRef.current !== controller ||
        assertionEndpointUrlRef.current !== endpoint ||
        stateRef.current.userIdentityMode !== "signed_assertion" ||
        stateRef.current.generation !== generation
      )
        return;
      setUserIdentityState(assertion.assertion);
      userIdentityExpiresAtRef.current = assertion.expiresAt;
      setUserIdentityExpiresAt(assertion.expiresAt);
      setAssertionRequestStatus("ready");
      setAssertionRequestMessage(
        "Assertion đã sẵn sàng cho các thao tác Writing và Speaking trong phiên này."
      );
    } catch (error) {
      if (
        controller.signal.aborted ||
        assertionRequestRef.current !== controller
      )
        return;
      setUserIdentityState("");
      userIdentityExpiresAtRef.current = null;
      setUserIdentityExpiresAt(null);
      setAssertionRequestStatus("error");
      setAssertionRequestMessage(
        error instanceof DemoAssertionEndpointError
          ? error.message
          : "Không thể lấy assertion hợp lệ. Hãy kiểm tra endpoint rồi thử lại."
      );
    } finally {
      if (assertionRequestRef.current === controller)
        assertionRequestRef.current = null;
    }
  }, [cancelAssertionRequest]);
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
      mockUserIdentity,
      prepareMockUserIdentity,
      userIdentity,
      userIdentityExpiresAt,
      setUserIdentity,
      isUserIdentityExpired,
      setUserIdentityMode,
      assertionEndpointUrl,
      setAssertionEndpointUrl: setCustomerAssertionEndpointUrl,
      assertionRequestStatus,
      assertionRequestMessage,
      fetchAssertion,
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
      mockUserIdentity,
      prepareMockUserIdentity,
      userIdentity,
      userIdentityExpiresAt,
      setUserIdentity,
      isUserIdentityExpired,
      setUserIdentityMode,
      assertionEndpointUrl,
      setCustomerAssertionEndpointUrl,
      assertionRequestStatus,
      assertionRequestMessage,
      fetchAssertion,
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
