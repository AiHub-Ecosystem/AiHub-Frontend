"use client";

const DB_NAME = "aihub-web-proof-key";
const STORE = "proof-keys";
const SCOPE_KEY = "aihub:web-session-account";
const ALGORITHM: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };

export type PublicProofKey = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
};

type StoredProofKey = {
  scope: string;
  publicJwk: PublicProofKey;
  privateKey: CryptoKey;
};

const pending = new Map<string, Promise<StoredProofKey>>();

function normalizeScope(scope: string) {
  const value = scope.trim().toLowerCase();
  if (!value) throw new Error("Proof key scope is required");
  return value;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "scope" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadOrCreate(scope: string): Promise<StoredProofKey> {
  const db = await openDatabase();
  try {
    const existing = await readRequest<StoredProofKey | undefined>(
      db.transaction(STORE, "readonly").objectStore(STORE).get(scope)
    );
    if (existing?.privateKey && existing.publicJwk) return existing;

    const pair = await crypto.subtle.generateKey(ALGORITHM, true, [
      "sign",
      "verify",
    ]);
    const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    if (
      jwk.kty !== "EC" ||
      jwk.crv !== "P-256" ||
      typeof jwk.x !== "string" ||
      typeof jwk.y !== "string"
    )
      throw new Error("Unexpected proof key shape");
    const publicJwk: PublicProofKey = {
      kty: "EC",
      crv: "P-256",
      x: jwk.x,
      y: jwk.y,
    };
    // Re-import the private key as non-extractable: the browser never needs to
    // see its raw bytes again, and the durable copy must not be exportable.
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      await crypto.subtle.exportKey("pkcs8", pair.privateKey),
      ALGORITHM,
      false,
      ["sign"]
    );
    const stored: StoredProofKey = { scope, publicJwk, privateKey };
    await readRequest(
      db.transaction(STORE, "readwrite").objectStore(STORE).put(stored)
    );
    return stored;
  } finally {
    db.close();
  }
}

/** Public JWK for one signed-in User Account, generated at most once. */
export function getPublicProofKey(scope: string) {
  const normalized = normalizeScope(scope);
  let key = pending.get(normalized);
  if (!key) {
    key = loadOrCreate(normalized).finally(() => pending.delete(normalized));
    pending.set(normalized, key);
  }
  return key.then((stored) => stored.publicJwk);
}

export function rememberProofKeyScope(scope: string) {
  sessionStorage.setItem(SCOPE_KEY, normalizeScope(scope));
}

export function currentProofKeyScope() {
  return sessionStorage.getItem(SCOPE_KEY);
}
