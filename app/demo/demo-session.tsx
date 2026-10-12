"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type DemoScope = "writing.grade" | "speaking.grade";

type DemoSession = {
  apiKey: string;
  setApiKey: (value: string) => void;
  isScopeValidated: (scope: DemoScope) => boolean;
  markScopeValidated: (scope: DemoScope) => void;
  clearScopeValidation: (scope: DemoScope) => void;
  getUserIdentity: () => string;
};

const DemoSessionContext = createContext<DemoSession | null>(null);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const [validScopes, setValidScopes] = useState<ReadonlySet<DemoScope>>(
    () => new Set(),
  );
  const apiKeyRef = useRef("");
  const identity = useRef<string | null>(null);

  const setApiKey = useCallback((value: string) => {
    if (apiKeyRef.current !== value) {
      apiKeyRef.current = value;
      setValidScopes(new Set());
    }
    setApiKeyState(value);
  }, []);
  const isScopeValidated = useCallback(
    (scope: DemoScope) => validScopes.has(scope),
    [validScopes],
  );
  const markScopeValidated = useCallback((scope: DemoScope) => {
    setValidScopes((current) => new Set(current).add(scope));
  }, []);
  const clearScopeValidation = useCallback((scope: DemoScope) => {
    setValidScopes((current) => {
      const next = new Set(current);
      next.delete(scope);
      return next;
    });
  }, []);
  const getUserIdentity = useCallback(() => {
    identity.current ??= globalThis.crypto.randomUUID();
    return identity.current;
  }, []);

  const value = useMemo(
    () => ({
      apiKey,
      setApiKey,
      isScopeValidated,
      markScopeValidated,
      clearScopeValidation,
      getUserIdentity,
    }),
    [
      apiKey,
      setApiKey,
      isScopeValidated,
      markScopeValidated,
      clearScopeValidation,
      getUserIdentity,
    ],
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
