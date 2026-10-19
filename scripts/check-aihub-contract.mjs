import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pinnedPath = path.join(root, "data/aihub-contract/openapi.json");
const limitsPath = path.join(root, "data/aihub-contract/limits.json");
const sourcePath = path.join(root, "data/aihub-contract/source.json");
const policy = JSON.parse(
  readFileSync(
    path.join(root, "data/aihub-contract/error-code-policy.json"),
    "utf8"
  )
);
const candidatePath = process.env.AIHUB_OPENAPI_CANDIDATE;

export function collectErrorCodes(document) {
  const codes = new Set();
  const visitSchema = (schema) => {
    if (!schema || typeof schema !== "object") return;
    if (typeof schema.const === "string") codes.add(schema.const);
    if (Array.isArray(schema.enum))
      for (const code of schema.enum)
        if (typeof code === "string") codes.add(code);
    for (const value of Object.values(schema)) {
      if (Array.isArray(value)) value.forEach(visitSchema);
      else if (value && typeof value === "object") visitSchema(value);
    }
  };
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.properties?.error?.properties?.code)
      visitSchema(value.properties.error.properties.code);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  };
  visit(document.components?.responses ?? {});
  return codes;
}

export function unhandledErrorCodes(document, handledCodes) {
  return [...collectErrorCodes(document)]
    .filter((code) => !handledCodes.has(code))
    .sort();
}

export function unhandledNewErrorCodes(previous, candidate, handledCodes) {
  const previousCodes = collectErrorCodes(previous);
  return unhandledErrorCodes(candidate, handledCodes).filter(
    (code) => !previousCodes.has(code)
  );
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function operation(document, operationId) {
  for (const pathItem of Object.values(document.paths ?? {}))
    for (const item of Object.values(pathItem ?? {}))
      if (item?.operationId === operationId) return item;
  throw new Error(`OpenAPI operation not found: ${operationId}`);
}

export function contractLimits(document) {
  const expiresIn = operation(document, "auth.web_sessions.exchange")
    .responses?.["200"]?.content?.["application/json"]?.schema?.properties?.data
    ?.properties?.expires_in?.const;
  const audioMaxBytes = operation(document, "speaking.grading").requestBody
    ?.content?.["multipart/form-data"]?.schema?.properties?.audio?.[
    "x-max-bytes"
  ];

  if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0)
    throw new Error(
      "AIHUB contract must publish a positive integer expires_in"
    );
  if (!Number.isSafeInteger(audioMaxBytes) || audioMaxBytes <= 0)
    throw new Error(
      "AIHUB contract must publish a positive integer Speaking upload limit"
    );
  return {
    webSessionAccessTokenMaxSeconds: expiresIn,
    speakingAudioMaxBytes: audioMaxBytes,
  };
}

export function assertCandidateLimits(pinned, candidate) {
  const pinnedLimits = contractLimits(pinned);
  const candidateLimits = contractLimits(candidate);
  if (
    pinnedLimits.webSessionAccessTokenMaxSeconds !==
      candidateLimits.webSessionAccessTokenMaxSeconds ||
    pinnedLimits.speakingAudioMaxBytes !== candidateLimits.speakingAudioMaxBytes
  )
    throw new Error(
      "Candidate AIHUB limits differ from the pinned Customer Web contract; update the pin and linked consumer changes"
    );
}

function assertPinnedLimits(document, limits) {
  const contract = contractLimits(document);
  if (
    limits.webSessionAccessTokenMaxSeconds !==
    contract.webSessionAccessTokenMaxSeconds
  )
    throw new Error(
      "Generated Customer Web session limit is stale; run npm run generate:aihub-contract"
    );
  if (limits.speakingAudioMaxBytes !== contract.speakingAudioMaxBytes)
    throw new Error(
      "Generated Speaking upload limit is stale; run npm run generate:aihub-contract"
    );
}

function main() {
  const pinned = loadJson(pinnedPath);
  const source = loadJson(sourcePath);
  if (
    source.repository !== "AiHub-Ecosystem/aihub-be" ||
    !/^[a-f0-9]{40}$/.test(source.commit)
  )
    throw new Error(
      "AIHUB contract source must name an exact AIHUB commit SHA"
    );

  if (process.argv.includes("--write-limits")) {
    const limits = contractLimits(pinned);
    writeFileSync(limitsPath, `${JSON.stringify(limits, null, 2)}\n`);
    return;
  }

  const limits = loadJson(limitsPath);
  assertPinnedLimits(pinned, limits);
  const handled = new Set([
    ...Object.keys(policy.messages),
    ...policy.safeGenericCodes,
  ]);
  const unhandledPinned = unhandledErrorCodes(pinned, handled);
  if (unhandledPinned.length)
    throw new Error(
      `Pinned AIHUB error codes need localized copy or explicit safe fallback: ${unhandledPinned.join(", ")}`
    );

  if (candidatePath) {
    const candidate = loadJson(candidatePath);
    assertCandidateLimits(pinned, candidate);
    const unhandled = unhandledNewErrorCodes(pinned, candidate, handled);
    if (unhandled.length)
      throw new Error(
        `New AIHUB error codes need localized copy or explicit safe fallback: ${unhandled.join(", ")}`
      );
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    main();
    console.log(
      "AIHUB OpenAPI pin and Customer Web error handling are compatible."
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
