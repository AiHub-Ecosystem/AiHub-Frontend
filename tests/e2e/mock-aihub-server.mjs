import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createContractValidator } from "./aihub-contract.mjs";

const host = "127.0.0.1";
// The port is overridable so a test that needs this mock (the tRPC seam spike)
// can run beside an E2E run instead of fighting it for 3101.
const port = Number(process.env.AIHUB_MOCK_PORT ?? 3101);
const contractPath =
  process.env.AIHUB_OPENAPI_PATH ??
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../data/aihub-contract/openapi.json"
  );
const validateContract = createContractValidator(
  JSON.parse(readFileSync(contractPath, "utf8"))
);
const aihubLimits = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../data/aihub-contract/limits.json"
    ),
    "utf8"
  )
);
const contractErrors = [];
const requests = [];
const authRequests = [];
const avatarRequests = [];
const organizationRequests = [];
const speakingRequests = [];
const speakingAssertions = [];
const scoringRequests = [];
/**
 * The demo keys the E2E run holds. Authorization reads `environments`, not the
 * raw key's prefix, exactly as aihub-be does.
 */
const DEMO_KEYS = {
  ["aihub_sandbox_" + "A".repeat(43)]: {
    environments: ["sandbox"],
    scopes: ["writing.grade", "speaking.grade"],
  },
  aihub_sk_e2e_sandbox_key: {
    environments: ["sandbox"],
    scopes: ["writing.grade", "speaking.grade"],
  },
  aihub_sk_e2e_signed_sandbox_key: {
    environments: ["sandbox"],
    scopes: ["writing.grade", "speaking.grade"],
    userIdentityMode: "signed_assertion",
  },
  aihub_prod_e2e_production_key: {
    environments: ["production"],
    scopes: ["writing.grade", "speaking.grade"],
  },
  aihub_sk_e2e_legacy_production_key: {
    environments: ["production"],
    scopes: ["writing.grade", "speaking.grade"],
  },
};
// `noAnnotations` reproduces a grade whose essay carries nothing worth
// quoting, which is the state the empty-state wording exists for.
let scoringConfig = { noAnnotations: false };
let assertionSequence = 0;
const webSessions = new Set();
let webSessionSequence = 0;
let organizationConfig = {
  roster: [],
  apiKeys: [],
  unavailable: false,
  creationLimit: false,
  renameDenied: false,
  createUncertainOnce: false,
  createBodyReadFailureOnce: false,
  createConflictOnce: false,
  createKeyUncertainOnce: false,
  rotateKeyUncertainOnce: false,
  apiKeyLimitReached: false,
  apiKeyEntitlementDenied: false,
  apiKeyListUnavailable: false,
  identityConfigs: {},
};
const createdOrganizations = new Map();
let createdOrganizationSequence = 0;
let uncertainCreationUsed = false;
let bodyReadFailureUsed = false;
let conflictCreationUsed = false;
let uncertainApiKeyCreationUsed = false;
let uncertainApiKeyRotationUsed = false;
let apiKeySequence = 0;
const knownForeignOrganizationIds = new Set(["foreign-org-known"]);
let authMode = {
  sessionExchangeUnauthorized: false,
  logoutDown: false,
  registerDown: false,
  resendDown: false,
  verifyDown: false,
  verifySignIn: false,
  forgotDown: false,
  resetDown: false,
};
let avatarConfig = {
  username: "test-user",
  avatar: null,
  uploadStatus: 201,
  uploadErrorCode: "AVATAR_UPLOAD_DENIED",
  completeStatus: 201,
  completeErrorCode: "AVATAR_CONFIRMATION_FAILED",
  completeAvatar: null,
  deleteStatus: 204,
  deleteErrorCode: "AVATAR_REMOVE_FAILED",
};
let avatarUploadSequence = 0;
let latestBrowserBindingHash = null;

function browserBindingHash(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value))
    return null;
  return createHash("sha256").update(value).digest("hex");
}

function sendJson(response, status, body, headers = {}) {
  if (
    response.req?.url?.startsWith("/v1/") &&
    typeof body?.error?.code === "string"
  ) {
    const error = body.error;
    body = {
      ...body,
      error: {
        ...error,
        message:
          typeof error.message === "string"
            ? error.message
            : `Mock error: ${error.code}`,
        request_id: error.request_id ?? "req_01M3B7FRTFBA7ZEN6YJP8KCBEY",
        retryable:
          typeof error.retryable === "boolean"
            ? error.retryable
            : status === 429 || status >= 500,
      },
    };
  }
  response.writeHead(status, {
    "Content-Type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function hasTrustedDemoBffHeaders(request) {
  return (
    request.headers["x-aihub-client-secret"] === "e2e-web-session-secret" &&
    typeof request.headers["x-aihub-visitor-ip"] === "string" &&
    isIP(request.headers["x-aihub-visitor-ip"]) !== 0
  );
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// Reads one part's value out of a multipart body, so the mock can report the
// question it was asked to grade without depending on part ordering.
function multipartField(body, name) {
  const pattern = new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`, "i");
  return pattern.exec(body)?.[1] ?? null;
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", `http://${host}:${port}`)
    .pathname;

  const responseChunks = [];
  let responseContentType = "";
  const setHeader = response.setHeader;
  response.setHeader = function (name, value) {
    if (String(name).toLowerCase() === "content-type")
      responseContentType = String(value);
    return setHeader.call(this, name, value);
  };
  const writeHead = response.writeHead;
  response.writeHead = function (status, statusMessageOrHeaders, headers) {
    const responseHeaders =
      typeof statusMessageOrHeaders === "string"
        ? headers
        : statusMessageOrHeaders;
    if (responseHeaders && typeof responseHeaders === "object") {
      const contentTypeEntry = Object.entries(responseHeaders).find(
        ([name]) => name.toLowerCase() === "content-type"
      );
      if (contentTypeEntry) responseContentType = String(contentTypeEntry[1]);
    }
    return writeHead.call(this, status, statusMessageOrHeaders, headers);
  };
  const write = response.write;
  response.write = function (chunk, ...args) {
    if (chunk != null && typeof chunk !== "function")
      responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return write.call(this, chunk, ...args);
  };
  const end = response.end;
  response.end = function (chunk, ...args) {
    if (chunk != null && typeof chunk !== "function") {
      const encoding = typeof args[0] === "string" ? args[0] : "utf8";
      responseChunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
      );
    }
    const responseBody = Buffer.concat(responseChunks);
    const errors = validateContract({
      method: request.method ?? "GET",
      pathname,
      status: response.statusCode,
      body: responseBody,
      contentType:
        responseContentType || String(response.getHeader("content-type") ?? ""),
    });
    if (errors.length) {
      let errorCode;
      try {
        errorCode = JSON.parse(responseBody.toString("utf8"))?.error?.code;
      } catch {}
      contractErrors.push({
        method: request.method,
        pathname,
        status: response.statusCode,
        ...(typeof errorCode === "string" ? { errorCode } : {}),
        errors,
      });
    }
    return end.call(this, chunk, ...args);
  };

  if (request.method === "GET" && pathname === "/__test__/contract-errors") {
    sendJson(response, 200, { errors: contractErrors });
    return;
  }

  if (request.method === "GET" && pathname === "/health") {
    response.writeHead(204).end();
    return;
  }

  if (request.method === "GET" && pathname === "/__test__/requests") {
    sendJson(response, 200, { requests });
    return;
  }

  if (request.method === "GET" && pathname === "/__test__/auth/requests") {
    sendJson(response, 200, { requests: authRequests });
    return;
  }

  if (request.method === "GET" && pathname === "/__test__/avatar/requests") {
    sendJson(response, 200, { requests: avatarRequests });
    return;
  }

  if (request.method === "POST" && pathname === "/__test__/auth/reset") {
    authRequests.length = 0;
    avatarRequests.length = 0;
    avatarConfig = {
      username: "test-user",
      avatar: null,
      uploadStatus: 201,
      uploadErrorCode: "AVATAR_UPLOAD_DENIED",
      completeStatus: 201,
      completeErrorCode: "AVATAR_CONFIRMATION_FAILED",
      completeAvatar: null,
      deleteStatus: 204,
      deleteErrorCode: "AVATAR_REMOVE_FAILED",
    };
    avatarUploadSequence = 0;
    latestBrowserBindingHash = null;
    webSessions.clear();
    authMode = {
      sessionExchangeUnauthorized: false,
      logoutDown: false,
      registerDown: false,
      resendDown: false,
      verifyDown: false,
      verifySignIn: false,
      forgotDown: false,
      resetDown: false,
    };
    organizationRequests.length = 0;
    createdOrganizations.clear();
    createdOrganizationSequence = 0;
    organizationConfig = {
      roster: [],
      apiKeys: [],
      unavailable: false,
      creationLimit: false,
      renameDenied: false,
      createUncertainOnce: false,
      createBodyReadFailureOnce: false,
      createConflictOnce: false,
      createKeyUncertainOnce: false,
      rotateKeyUncertainOnce: false,
      apiKeyLimitReached: false,
      apiKeyEntitlementDenied: false,
      apiKeyListUnavailable: false,
      identityConfigs: {},
    };
    uncertainCreationUsed = false;
    bodyReadFailureUsed = false;
    conflictCreationUsed = false;
    uncertainApiKeyCreationUsed = false;
    uncertainApiKeyRotationUsed = false;
    apiKeySequence = 0;
    response.writeHead(204).end();
    return;
  }

  if (request.method === "POST" && pathname === "/__test__/avatar/config") {
    avatarConfig = { ...avatarConfig, ...(await readJson(request)) };
    response.writeHead(204).end();
    return;
  }

  if (
    request.method === "GET" &&
    pathname === "/__test__/organizations/requests"
  ) {
    sendJson(response, 200, { requests: organizationRequests });
    return;
  }

  if (request.method === "POST" && pathname === "/__test__/scoring/config") {
    scoringConfig = { ...scoringConfig, ...(await readJson(request)) };
    response.writeHead(204).end();
    return;
  }

  if (request.method === "GET" && pathname === "/__test__/scoring/requests") {
    sendJson(response, 200, { requests: scoringRequests });
    return;
  }

  if (request.method === "POST" && pathname === "/__test__/scoring/reset") {
    scoringRequests.length = 0;
    response.writeHead(204).end();
    return;
  }

  if (request.method === "GET" && pathname === "/__test__/speaking/requests") {
    sendJson(response, 200, {
      requests: speakingRequests,
      assertions: speakingAssertions,
    });
    return;
  }

  if (request.method === "POST" && pathname === "/__test__/speaking/reset") {
    speakingRequests.length = 0;
    speakingAssertions.length = 0;
    response.writeHead(204).end();
    return;
  }

  if (
    request.method === "GET" &&
    pathname === "/__test__/organizations/state"
  ) {
    sendJson(response, 200, { organizations: organizationConfig.roster });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/me") {
    avatarRequests.push({ method: "GET", path: "identity" });
    sendJson(
      response,
      200,
      {
        data: { username: avatarConfig.username },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      },
      { "Cache-Control": "no-store" }
    );
    return;
  }

  if (request.method === "GET" && pathname === "/v1/me/avatar") {
    avatarRequests.push({ method: "GET", path: "avatar" });
    sendJson(
      response,
      200,
      {
        data: { avatar: avatarConfig.avatar },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      },
      { "Cache-Control": "no-store" }
    );
    return;
  }

  if (request.method === "POST" && pathname === "/v1/me/avatar/uploads") {
    const body = await readJson(request);
    avatarRequests.push({
      method: "POST",
      path: "upload-grant",
      contentType: body.content_type,
      byteSize: body.byte_size,
      hasAuthorization: Boolean(request.headers.authorization),
    });
    if (avatarConfig.uploadStatus !== 201) {
      sendJson(response, avatarConfig.uploadStatus, {
        error: { code: avatarConfig.uploadErrorCode },
      });
      return;
    }
    const assetId = `ava_${String(++avatarUploadSequence).padStart(26, "0")}`;
    avatarConfig.pendingUpload = {
      assetId,
      contentType: body.content_type,
      byteSize: body.byte_size,
    };
    sendJson(response, 201, {
      data: {
        asset_id: assetId,
        upload_url:
          avatarConfig.uploadUrl ?? `https://s3.wispace.app/upload/${assetId}`,
        method: "PUT",
        headers: {
          "Content-Type": body.content_type,
          "Content-Length": String(body.byte_size),
          "Cache-Control": "public, max-age=3600",
        },
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      },
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  const avatarCompleteMatch = pathname.match(
    /^\/v1\/me\/avatar\/uploads\/([^/]+)\/complete$/
  );
  if (request.method === "POST" && avatarCompleteMatch) {
    const assetId = decodeURIComponent(avatarCompleteMatch[1]);
    avatarRequests.push({ method: "POST", path: "complete", assetId });
    if (avatarConfig.completeStatus !== 201) {
      sendJson(response, avatarConfig.completeStatus, {
        error: { code: avatarConfig.completeErrorCode },
      });
      return;
    }
    const pending = avatarConfig.pendingUpload;
    if (!pending || pending.assetId !== assetId) {
      sendJson(response, 404, { error: { code: "NOT_FOUND" } });
      return;
    }
    avatarConfig.avatar = avatarConfig.completeAvatar ?? {
      asset_id: assetId,
      content_type: pending.contentType,
      byte_size: pending.byteSize,
      accepted_at: new Date().toISOString(),
      url: `https://s3.wispace.app/${assetId}.webp`,
    };
    avatarConfig.pendingUpload = null;
    sendJson(response, 201, {
      data: avatarConfig.avatar,
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  if (request.method === "DELETE" && pathname === "/v1/me/avatar") {
    avatarRequests.push({ method: "DELETE", path: "avatar" });
    if (avatarConfig.deleteStatus !== 204) {
      sendJson(response, avatarConfig.deleteStatus, {
        error: { code: avatarConfig.deleteErrorCode },
      });
      return;
    }
    avatarConfig.avatar = null;
    response.writeHead(204, { "Cache-Control": "no-store" }).end();
    return;
  }

  if (
    request.method === "POST" &&
    pathname === "/__test__/organizations/config"
  ) {
    organizationConfig = {
      ...organizationConfig,
      ...(await readJson(request)),
    };
    response.writeHead(204).end();
    return;
  }

  if (request.method === "GET" && pathname === "/v1/organizations/me/members") {
    organizationRequests.push({ method: "GET", path: "roster" });
    if (organizationConfig.unavailable) {
      sendJson(response, 503, { error: { code: "LOCAL_MOCK_OUTAGE" } });
      return;
    }
    sendJson(response, 200, {
      data: {
        organizations: organizationConfig.roster.map((item) => ({
          ...item,
          identity_configured: item.identity_configured ?? false,
          member_count: item.member_count ?? item.members?.length ?? 0,
        })),
        next_cursor: null,
      },
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  const identityConfigMatch = pathname.match(
    /^\/v1\/organizations\/([^/]+)\/identity-config$/
  );
  if (identityConfigMatch && ["GET", "PUT"].includes(request.method)) {
    const organizationId = decodeURIComponent(identityConfigMatch[1]);
    const membership = organizationConfig.roster.find(
      (item) => item.organization_id === organizationId
    );
    const requestRecord = {
      method: request.method,
      path: "identity-config",
      organizationId,
    };
    organizationRequests.push(requestRecord);
    if (
      !membership ||
      membership.status !== "active" ||
      membership.membership?.role !== "owner" ||
      organizationConfig.identityForbiddenOnce
    ) {
      organizationConfig.identityForbiddenOnce = false;
      sendJson(response, 403, { error: { code: "FORBIDDEN" } });
      return;
    }
    if (request.method === "GET") {
      sendJson(response, 200, {
        data: organizationConfig.identityConfigs?.[organizationId] ?? {
          configured: false,
        },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      });
      return;
    }
    const input = await readJson(request);
    requestRecord.body = input;
    if (organizationConfig.identityErrorCode) {
      const code = organizationConfig.identityErrorCode;
      const status =
        code === "ORGANIZATION_IDENTITY_ISSUER_CONFLICT"
          ? 409
          : code === "IDENTITY_JWKS_SOURCE_UNAVAILABLE"
            ? 503
            : 400;
      sendJson(response, status, { error: { code } });
      return;
    }
    const delayMs = organizationConfig.identitySaveDelayMs;
    if (Number.isFinite(delayMs) && delayMs > 0)
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    const existing = organizationConfig.identityConfigs?.[organizationId];
    const config = {
      configured: true,
      issuer: input.issuer,
      jwks_url: input.jwks_url ?? null,
      public_keys_jwks: input.public_keys_jwks ?? null,
      allowed_algorithms: ["RS256", "ES256"],
      max_assertion_ttl_seconds: 300,
      status: existing?.status ?? "active",
      updated_at: new Date().toISOString(),
    };
    organizationConfig.identityConfigs ??= {};
    organizationConfig.identityConfigs[organizationId] = config;
    membership.identity_configured = config.status === "active";
    sendJson(response, 200, {
      data: config,
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  const apiKeyListMatch = pathname.match(
    /^\/v1\/organizations\/([^/]+)\/api-keys$/
  );
  if (
    (request.method === "GET" || request.method === "POST") &&
    apiKeyListMatch
  ) {
    const organizationId = decodeURIComponent(apiKeyListMatch[1]);
    const membership = organizationConfig.roster.find(
      (item) => item.organization_id === organizationId
    );
    const role = membership?.membership?.role;
    const status = membership?.status;
    if (
      !membership ||
      !["owner", "admin"].includes(role) ||
      status !== "active"
    ) {
      organizationRequests.push({
        method: request.method,
        path: request.method === "GET" ? "list-api-keys" : "create-api-key",
        organizationId,
      });
      sendJson(response, 403, {
        error: { code: "FORBIDDEN", message: "private detail" },
      });
      return;
    }

    if (request.method === "GET") {
      organizationRequests.push({ method: "GET", path: "list-api-keys" });
      if (organizationConfig.apiKeyListUnavailable) {
        sendJson(response, 503, {
          error: { code: "DATABASE_UNAVAILABLE", message: "private detail" },
        });
        return;
      }
      sendJson(response, 200, {
        data: {
          api_keys: (organizationConfig.apiKeys ?? []).filter(
            (key) => key.status !== "revoked"
          ),
        },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      });
      return;
    }

    const body = await readJson(request);
    organizationRequests.push({
      method: "POST",
      path: "create-api-key",
      organizationId,
      scopes: body.scopes,
      allowed_environments: body.allowed_environments,
    });
    // Mirrors the backend: a Sandbox key is bound to that Environment alone and
    // may carry only the demo grading pair, so an E2E run fails when the form
    // sends anything else.
    if (
      body.allowed_environments?.includes("sandbox") &&
      (body.allowed_environments.length !== 1 ||
        !body.scopes.every((scope) =>
          ["writing.grade", "speaking.grade"].includes(scope)
        ))
    ) {
      sendJson(response, 400, {
        error: {
          code: "INVALID_REQUEST",
          message: "Request failed validation",
        },
      });
      return;
    }
    if (organizationConfig.apiKeyLimitReached) {
      sendJson(response, 403, { error: { code: "FORBIDDEN" } });
      return;
    }
    if (organizationConfig.apiKeyEntitlementDenied) {
      sendJson(response, 403, {
        error: { code: "FORBIDDEN" },
      });
      return;
    }

    apiKeySequence += 1;
    const suffix = String(apiKeySequence).padStart(26, "0");
    const apiKey = {
      id: `ak_${suffix}`,
      name: body.name,
      key_prefix: "aihub_sk_ABC123",
      scopes: body.scopes,
      allowed_environments: body.allowed_environments,
      status: "active",
      expires_at: body.expires_at ?? null,
      last_used_at: null,
      created_at: new Date().toISOString(),
    };
    organizationConfig.apiKeys ??= [];
    organizationConfig.apiKeys.unshift(apiKey);
    if (
      organizationConfig.createKeyUncertainOnce &&
      !uncertainApiKeyCreationUsed
    ) {
      uncertainApiKeyCreationUsed = true;
      response.destroy();
      return;
    }
    sendJson(
      response,
      201,
      {
        data: {
          ...apiKey,
          api_key: `aihub_sk_${"A".repeat(43)}`,
        },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      },
      { "Cache-Control": "no-store" }
    );
    return;
  }

  const apiKeyRotateMatch = pathname.match(
    /^\/v1\/organizations\/([^/]+)\/api-keys\/([^/]+)\/rotate$/
  );
  if (request.method === "POST" && apiKeyRotateMatch) {
    const organizationId = decodeURIComponent(apiKeyRotateMatch[1]);
    const apiKeyId = decodeURIComponent(apiKeyRotateMatch[2]);
    const oldKey = (organizationConfig.apiKeys ?? []).find(
      (key) => key.id === apiKeyId && key.status === "active"
    );
    organizationRequests.push({
      method: "POST",
      path: "rotate-api-key",
      organizationId,
      apiKeyId,
      hasIdempotencyKey: Boolean(request.headers["idempotency-key"]),
    });
    if (!oldKey) {
      sendJson(response, 403, { error: { code: "FORBIDDEN" } });
      return;
    }
    apiKeySequence += 1;
    const suffix = String(apiKeySequence).padStart(26, "0");
    const replacement = {
      ...oldKey,
      id: `ak_${suffix}`,
      key_prefix: "aihub_sk_ROTATE",
      status: "active",
      last_used_at: null,
      created_at: new Date().toISOString(),
    };
    organizationConfig.apiKeys = [
      replacement,
      ...(organizationConfig.apiKeys ?? []).filter(
        (key) => key.id !== apiKeyId
      ),
    ];
    if (
      organizationConfig.rotateKeyUncertainOnce &&
      !uncertainApiKeyRotationUsed
    ) {
      uncertainApiKeyRotationUsed = true;
      response.destroy();
      return;
    }
    sendJson(
      response,
      200,
      {
        data: {
          ...replacement,
          api_key: `aihub_sk_${"B".repeat(43)}`,
        },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      },
      { "Cache-Control": "no-store" }
    );
    return;
  }

  const apiKeyRevokeMatch = pathname.match(
    /^\/v1\/organizations\/([^/]+)\/api-keys\/([^/]+)$/
  );
  if (request.method === "DELETE" && apiKeyRevokeMatch) {
    const apiKeyId = decodeURIComponent(apiKeyRevokeMatch[2]);
    const revoked = (organizationConfig.apiKeys ?? []).find(
      (key) => key.id === apiKeyId
    );
    organizationRequests.push({
      method: "DELETE",
      path: "revoke-api-key",
      apiKeyId,
    });
    if (!revoked) {
      sendJson(response, 404, { error: { code: "NOT_FOUND" } });
      return;
    }
    organizationConfig.apiKeys = (organizationConfig.apiKeys ?? []).filter(
      (key) => key.id !== apiKeyId
    );
    sendJson(response, 200, {
      data: { ...revoked, status: "revoked" },
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/organizations") {
    const body = await readJson(request);
    organizationRequests.push({
      method: "POST",
      path: "create",
      name: body.name,
      idempotencyKey: request.headers["idempotency-key"],
    });
    if (organizationConfig.creationLimit) {
      sendJson(response, 409, {
        error: { code: "ORGANIZATION_CREATION_LIMIT_REACHED" },
      });
      return;
    }
    if (organizationConfig.createUnavailable) {
      // The synthetic outage code the contract check excludes from validation.
      sendJson(response, 503, { error: { code: "LOCAL_MOCK_OUTAGE" } });
      return;
    }
    const key = request.headers["idempotency-key"];
    if (organizationConfig.createConflictOnce && !conflictCreationUsed) {
      conflictCreationUsed = true;
      sendJson(response, 409, {
        error: { code: "IDEMPOTENCY_CONFLICT" },
      });
      return;
    }
    let organization = createdOrganizations.get(key);
    if (organization && organization.name !== body.name) {
      sendJson(response, 409, {
        error: { code: "IDEMPOTENCY_CONFLICT" },
      });
      return;
    }
    if (!organization) {
      createdOrganizationSequence += 1;
      organization = {
        organization_id:
          createdOrganizationSequence === 1
            ? "org-created-12345678"
            : `org-created-${String(createdOrganizationSequence).padStart(8, "0")}`,
        name: body.name,
        status: "active",
        entitlements: ["writing"],
        identity_configured: false,
        membership: { role: "owner" },
        members: [{ username: "owner", role: "owner" }],
      };
      createdOrganizations.set(key, organization);
      organizationConfig.roster.push(organization);
    }
    if (organizationConfig.createUncertainOnce && !uncertainCreationUsed) {
      uncertainCreationUsed = true;
      response.destroy();
      return;
    }
    if (organizationConfig.createBodyReadFailureOnce && !bodyReadFailureUsed) {
      bodyReadFailureUsed = true;
      response.writeHead(201, { "Content-Type": "application/json" });
      response.write("{");
      // Let fetch receive the headers before the mock interrupts the body.
      setTimeout(() => response.destroy(), 50);
      return;
    }
    sendJson(response, 201, {
      data: {
        organization: {
          organization_id: organization.organization_id,
          name: organization.name,
          status: organization.status,
        },
        role: "owner",
      },
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  if (
    request.method === "PATCH" &&
    /^\/v1\/organizations\/[^/]+$/.test(pathname)
  ) {
    const body = await readJson(request);
    const id = pathname.split("/").at(-1);
    organizationRequests.push({
      method: "PATCH",
      path: "rename",
      id,
      name: body.name,
    });
    const membership = organizationConfig.roster.find(
      (item) => item.organization_id === id
    );
    if (
      organizationConfig.renameDenied ||
      knownForeignOrganizationIds.has(id) ||
      membership?.membership?.role !== "owner" ||
      membership?.status === "suspended"
    ) {
      sendJson(response, 403, {
        error: { code: "FORBIDDEN" },
      });
      return;
    }
    membership.name = body.name;
    sendJson(response, 200, {
      data: {
        organization: {
          organization_id: membership.organization_id,
          name: membership.name,
          status: membership.status,
        },
      },
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  if (request.method === "POST" && pathname === "/__test__/auth/mode") {
    authMode = { ...authMode, ...(await readJson(request)) };
    response.writeHead(204).end();
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/web-sessions") {
    const body = await readJson(request);
    authRequests.push({
      path: "login",
      email: body.email,
      hasPassword: typeof body.password === "string",
      clientSecretValid:
        request.headers["x-aihub-client-secret"] === "e2e-web-session-secret",
    });
    if (body.email === "rate-limit@example.test") {
      sendJson(
        response,
        429,
        { error: { code: "RATE_LIMITED" } },
        { "Retry-After": "17" }
      );
      return;
    }
    if (
      body.email === "wrong@example.test" ||
      body.email === "pending@example.test" ||
      body.email === "disabled@example.test" ||
      body.password !== "correct horse battery staple"
    ) {
      sendJson(response, 401, { error: { code: "AUTH_CREDENTIALS_INVALID" } });
      return;
    }
    const webSessionToken = createHash("sha256")
      .update(`web-session-${++webSessionSequence}`)
      .digest("base64url");
    webSessions.add(webSessionToken);
    sendJson(
      response,
      201,
      {
        data: {
          web_session_token: webSessionToken,
          expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
        },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      },
      { "Cache-Control": "no-store" }
    );
    return;
  }

  if (
    request.method === "POST" &&
    pathname === "/v1/auth/web-sessions/exchange"
  ) {
    const body = await readJson(request);
    const exchangeNumber =
      authRequests.filter((entry) => entry.path === "exchange").length + 1;
    const sessionKnown = webSessions.has(body.web_session_token);
    authRequests.push({
      path: "exchange",
      hasWebSessionToken: typeof body.web_session_token === "string",
      sessionKnown,
      clientSecretValid:
        request.headers["x-aihub-client-secret"] === "e2e-web-session-secret",
    });
    if (authMode.sessionExchangeUnauthorized || !sessionKnown) {
      sendJson(response, 401, { error: { code: "AUTH_WEB_SESSION_INVALID" } });
      return;
    }
    sendJson(
      response,
      200,
      {
        data: {
          access_token: `access-token-${exchangeNumber}`,
          token_type: "Bearer",
          expires_in: aihubLimits.webSessionAccessTokenMaxSeconds,
        },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      },
      { "Cache-Control": "no-store" }
    );
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/register") {
    const body = await readJson(request);
    authRequests.push({
      path: "register",
      hasEmail: typeof body.email === "string",
      hasUsername: typeof body.username === "string",
      hasPassword: typeof body.password === "string",
      browserBindingValid: browserBindingHash(body.browser_binding) !== null,
    });
    if (authMode.registerDown) {
      sendJson(response, 503, {
        error: { code: "IDENTITY_PROVIDER_UNAVAILABLE" },
      });
      return;
    }
    if (body.email === "taken@example.test" || body.username === "taken-user") {
      sendJson(response, 409, {
        error: { code: "AUTH_IDENTITY_UNAVAILABLE", message: "private detail" },
      });
      return;
    }
    latestBrowserBindingHash = browserBindingHash(body.browser_binding);
    sendJson(response, 201, {
      data: {
        email: body.email,
        username: body.username,
        status: "pending_verification",
        email_delivery_status: "queued",
      },
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  if (
    request.method === "POST" &&
    pathname === "/v1/auth/resend-verification"
  ) {
    const body = await readJson(request);
    authRequests.push({
      path: "resend",
      hasEmail: typeof body.email === "string",
      browserBindingValid: browserBindingHash(body.browser_binding) !== null,
    });
    if (authMode.resendDown) {
      sendJson(response, 500, { error: { code: "INTERNAL_ERROR" } });
      return;
    }
    latestBrowserBindingHash = browserBindingHash(body.browser_binding);
    response.writeHead(202, { "Cache-Control": "no-store" }).end();
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/forgot-password") {
    const body = await readJson(request);
    authRequests.push({
      path: "forgot",
      email: body.email,
    });
    if (authMode.forgotDown) {
      sendJson(response, 500, { error: { code: "INTERNAL_ERROR" } });
      return;
    }
    if (body.email === "rate-limit@example.test") {
      sendJson(
        response,
        429,
        { error: { code: "RATE_LIMITED" } },
        { "Retry-After": "17" }
      );
      return;
    }
    sendJson(
      response,
      202,
      {
        data: {
          message:
            "If the account exists and is eligible, AIHUB has accepted a request to send password reset instructions.",
        },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      },
      { "Cache-Control": "no-store" }
    );
    return;
  }

  if (
    request.method === "POST" &&
    pathname === "/v1/auth/web-sessions/verification"
  ) {
    const body = await readJson(request);
    const browserBinding = browserBindingHash(body.browser_binding);
    const browserBindingMatches =
      browserBinding !== null && browserBinding === latestBrowserBindingHash;
    authRequests.push({
      path: "verify",
      hasToken: typeof body.token === "string",
      browserBindingValid: browserBinding !== null,
      browserBindingMatches,
    });
    if (authMode.verifyDown) {
      sendJson(response, 500, { error: { code: "INTERNAL_ERROR" } });
      return;
    }
    if (typeof body.token !== "string" || body.token.startsWith("invalid")) {
      sendJson(response, 400, {
        error: { code: "AUTH_VERIFICATION_TOKEN_INVALID" },
      });
      return;
    }
    if (authMode.verifySignIn && browserBindingMatches) {
      latestBrowserBindingHash = null;
      const verificationNumber = authRequests.filter(
        (entry) => entry.path === "verify"
      ).length;
      const webSessionToken = createHash("sha256")
        .update(`verification-session-${++webSessionSequence}`)
        .digest("base64url");
      webSessions.add(webSessionToken);
      sendJson(
        response,
        201,
        {
          data: {
            web_session_token: webSessionToken,
            expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
          },
          meta: { request_id: `req-verify-${verificationNumber}` },
        },
        { "Cache-Control": "no-store" }
      );
      return;
    }
    response.writeHead(204, { "Cache-Control": "no-store" }).end();
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/reset-password") {
    const body = await readJson(request);
    authRequests.push({
      path: "reset",
      hasToken: typeof body.token === "string",
      hasPassword: typeof body.password === "string",
    });
    if (authMode.resetDown) {
      sendJson(response, 500, { error: { code: "INTERNAL_ERROR" } });
      return;
    }
    if (typeof body.token !== "string" || body.token.startsWith("invalid")) {
      sendJson(response, 400, {
        error: { code: "AUTH_PASSWORD_RESET_TOKEN_INVALID" },
      });
      return;
    }
    response.writeHead(204, { "Cache-Control": "no-store" }).end();
    return;
  }

  if (
    request.method === "POST" &&
    pathname === "/v1/auth/web-sessions/logout"
  ) {
    const body = await readJson(request);
    const sessionKnown = webSessions.has(body.web_session_token);
    authRequests.push({
      path: "logout",
      hasWebSessionToken: typeof body.web_session_token === "string",
      sessionKnown,
      clientSecretValid:
        request.headers["x-aihub-client-secret"] === "e2e-web-session-secret",
    });
    if (authMode.logoutDown) {
      sendJson(response, 503, { error: { code: "LOCAL_MOCK_OUTAGE" } });
      return;
    }
    webSessions.delete(body.web_session_token);
    response.writeHead(204, { "Cache-Control": "no-store" }).end();
    return;
  }

  if (
    request.method === "POST" &&
    pathname === "/external/micro-exercise/sample-references"
  ) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);

    try {
      requests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch {
      sendJson(response, 400, { error: "Invalid JSON" });
      return;
    }

    sendJson(response, 200, {
      data: [
        {
          prompt: "E2E_ONLY_REFERENCE_PROMPT",
          questionType: "agree_disagree",
          quote: "E2E_ONLY_REFERENCE_QUOTE",
          explanation: "E2E_ONLY_REFERENCE_EXPLANATION",
        },
      ],
    });
    return;
  }

  if (
    request.method === "POST" &&
    pathname === "/v1/sandbox/demo/api-keys/validate"
  ) {
    const { environment = "sandbox", scope } = await readJson(request);
    // Mirrors aihub-be: authorization reads the key's stored binding, never its
    // prefix, and the allowance is reported for Sandbox only.
    if (!hasTrustedDemoBffHeaders(request)) {
      sendJson(response, 401, { error: { code: "UNAUTHORIZED" } });
      return;
    }
    const demoKey = DEMO_KEYS[request.headers["x-api-key"]];
    if (!demoKey) {
      sendJson(response, 401, { error: { code: "UNAUTHORIZED" } });
      return;
    }
    if (!demoKey.environments.includes(environment)) {
      sendJson(response, 403, { error: { code: "FORBIDDEN" } });
      return;
    }
    if (!demoKey.scopes.includes(scope)) {
      sendJson(response, 403, { error: { code: "FORBIDDEN" } });
      return;
    }
    sendJson(response, 200, {
      data: {
        valid: true,
        environment,
        scope,
        user_identity_mode: demoKey.userIdentityMode ?? "declared_id",
        allowance:
          environment === "sandbox"
            ? {
                monthly_limit: 5,
                reserved: 0,
                shared_monthly_limit: 500,
                shared_reserved: 0,
              }
            : null,
      },
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/sandbox/assertions") {
    await readJson(request);
    assertionSequence += 1;
    const assertion = `e2e-sandbox-assertion-${assertionSequence}`;
    speakingAssertions.push(assertion);
    sendJson(response, 201, {
      data: {
        assertion,
        expires_in: 300,
      },
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/ielts/speaking/questions") {
    const part = Number(
      new URL(request.url, `http://${host}:${port}`).searchParams.get("part")
    );
    sendJson(response, 200, {
      data: {
        part,
        questions: [1, 2, 3].flatMap((item) =>
          item === part
            ? [
                {
                  question_id: `q_part${item}_1`,
                  part: item,
                  prompt_text: `E2E_ONLY_QUESTION_${item}`,
                  audio_url: `https://s3.wispace.app/e2e-only-${item}.mp3`,
                },
              ]
            : []
        ),
      },
      meta: {
        request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY",
        service: "speaking",
        operation: "speaking.questions",
      },
    });
    return;
  }

  const speakingGradingMatch = pathname.match(
    /^\/v1\/ielts\/speaking\/(grading|grading-json)$/
  );
  if (request.method === "POST" && speakingGradingMatch) {
    const operation = speakingGradingMatch[1];
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");

    if (!hasTrustedDemoBffHeaders(request)) {
      sendJson(response, 401, { error: { code: "UNAUTHORIZED" } });
      return;
    }
    if (!DEMO_KEYS[request.headers["x-api-key"]]) {
      sendJson(response, 401, { error: { code: "UNAUTHORIZED" } });
      return;
    }

    const userIdentity = request.headers["x-user-identity"];
    speakingRequests.push({
      operation,
      userIdentity: typeof userIdentity === "string" ? userIdentity : null,
      identityHeaderNames: Object.keys(request.headers).filter((key) =>
        key.startsWith("x-user-")
      ),
    });

    if (typeof userIdentity !== "string" || !userIdentity.trim()) {
      sendJson(response, 401, {
        error: { code: "USER_IDENTITY_REQUIRED" },
      });
      return;
    }
    if (
      DEMO_KEYS[request.headers["x-api-key"]].userIdentityMode ===
        "signed_assertion" &&
      userIdentity === "expired.e2e.assertion"
    ) {
      sendJson(response, 401, {
        error: { code: "INVALID_USER_IDENTITY" },
      });
      return;
    }

    const questionId =
      operation === "grading-json"
        ? JSON.parse(body).question_id
        : (multipartField(body, "question_id") ?? "q_part1_1");

    sendJson(response, 200, {
      data: {
        test_type: "Practice",
        question_id: questionId,
        scorability: {
          is_scorable: true,
          confidence: "high",
          display_band: true,
          message_vi: "Bài nói đủ thời lượng và rõ ràng.",
        },
        estimated_band: {
          overall: 6.5,
          fluency_coherence: 6,
          lexical_resource: 6.5,
          grammatical_range_accuracy: 6,
          pronunciation: 7,
        },
        transcript: {
          text: "E2E_ONLY_TRANSCRIPT",
          word_count: 3,
          duration_seconds: 5.75,
        },
        relevance: {
          on_topic: true,
          score: 0.92,
          feedback_vi: "Câu trả lời bám sát câu hỏi.",
        },
        fluency_metrics: {
          speech_rate_wpm: 118,
          pause_count: 2,
          mean_length_run_words: 9,
        },
        pronunciation_detail: {
          summary: { good_count: 1, fair_count: 0, poor_count: 0 },
          words: [
            {
              word: "E2E_ONLY_TRANSCRIPT",
              quality_score: 88,
              quality_class: "good",
              syllables: [],
              phonemes: [],
            },
          ],
        },
        language_analysis: {
          grammar_errors: [
            {
              sentence: "E2E_ONLY_TRANSCRIPT",
              error_segment: "E2E_ONLY_TRANSCRIPT",
              correction: "E2E_ONLY_TRANSCRIPT",
              error_type: "spelling",
              explanation_vi: "Dùng đúng chính tả.",
            },
          ],
          vocabulary_upgrades: [
            {
              original_word: "E2E_ONLY_TRANSCRIPT",
              suggested_word: "E2E_ONLY_TRANSCRIPT",
              cefr_level: "B2",
              reason_vi: "Từ này đã phù hợp ngữ cảnh.",
            },
          ],
        },
        feedback: {
          summary_vi: "E2E_ONLY_FEEDBACK_SUMMARY",
          strong_point_vi: "E2E_ONLY_FEEDBACK_STRONG",
          action_plan_vi: "E2E_ONLY_FEEDBACK_ACTION",
        },
      },
      meta: {
        request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY",
        service: "speaking",
        operation: `speaking.${operation}`,
        timing: { downstream_ms: 0, gateway_overhead_ms: 0, total_ms: 0 },
      },
    });
    return;
  }

  const scoringGradingMatch = pathname.match(
    /^\/v1\/ielts\/writing\/task(\d)\/grade$/
  );
  if (request.method === "POST" && scoringGradingMatch) {
    const task = scoringGradingMatch[1];
    const body = await readJson(request);

    if (!hasTrustedDemoBffHeaders(request)) {
      sendJson(response, 401, { error: { code: "UNAUTHORIZED" } });
      return;
    }
    if (!DEMO_KEYS[request.headers["x-api-key"]]) {
      sendJson(response, 401, { error: { code: "UNAUTHORIZED" } });
      return;
    }

    const idempotencyKey = request.headers["idempotency-key"];
    const userIdentity = request.headers["x-user-identity"];

    scoringRequests.push({
      task,
      idempotencyKey:
        typeof idempotencyKey === "string" ? idempotencyKey : null,
      userIdentity: typeof userIdentity === "string" ? userIdentity : null,
      // Writing must not mint: the assertions route must never be reached.
      body,
    });

    if (!userIdentity) {
      sendJson(response, 401, {
        error: { code: "USER_IDENTITY_REQUIRED" },
      });
      return;
    }
    if (
      DEMO_KEYS[request.headers["x-api-key"]].userIdentityMode ===
        "signed_assertion" &&
      userIdentity === "expired.e2e.assertion"
    ) {
      sendJson(response, 401, {
        error: { code: "INVALID_USER_IDENTITY" },
      });
      return;
    }
    if (!idempotencyKey) {
      sendJson(response, 400, {
        error: { code: "INVALID_REQUEST", message: "Idempotency-Key required" },
      });
      return;
    }
    // Mirrors the backend: the schemas are additionalProperties: false.
    if (body.chart_type === "E2E_LOWERCASE_CHART_TYPE") {
      sendJson(response, 400, {
        error: {
          code: "INVALID_REQUEST",
          message: "chart_type is case-sensitive",
        },
      });
      return;
    }

    const firstCriterion = task === "1" ? "task_achievement" : "task_response";
    const annotationQuote =
      body.essay?.split("\n")[0]?.slice(0, 24) ?? "E2E_ONLY_QUOTE";

    sendJson(response, 200, {
      data: {
        overall_band: 6.5,
        language: "vi",
        criteria: [
          {
            id: firstCriterion,
            name: task === "1" ? "Task Achievement" : "Task Response",
            band: 6.5,
            band_reason: "E2E_ONLY_BAND_REASON",
            strengths: ["E2E_ONLY_STRENGTH"],
            improvements: ["E2E_ONLY_IMPROVEMENT"],
          },
          {
            id: "coherence_cohesion",
            name: "Coherence and Cohesion",
            band: 6.5,
            band_reason: "E2E_ONLY_BAND_REASON",
            strengths: ["E2E_ONLY_STRENGTH"],
            improvements: ["E2E_ONLY_IMPROVEMENT"],
          },
          {
            id: "lexical_resource",
            name: "Lexical Resource",
            band: 6,
            band_reason: "E2E_ONLY_BAND_REASON",
            strengths: ["E2E_ONLY_STRENGTH"],
            improvements: ["E2E_ONLY_IMPROVEMENT"],
          },
          {
            id: "grammatical_range_accuracy",
            name: "Grammatical Range and Accuracy",
            band: 6.5,
            band_reason: "E2E_ONLY_BAND_REASON",
            strengths: ["E2E_ONLY_STRENGTH"],
            improvements: ["E2E_ONLY_IMPROVEMENT"],
          },
        ],
        summary: "E2E_ONLY_SUMMARY",
        suggestions: ["E2E_ONLY_SUGGESTION"],
        next_steps: ["E2E_ONLY_NEXT_STEP"],
        annotations: scoringConfig.noAnnotations
          ? []
          : [
              {
                criterion: "lexical_resource",
                issue: "imprecise_word_choice",
                quote: annotationQuote,
                explanation: "E2E_ONLY_EXPLANATION",
              },
              // Task 2's own first criterion carries an annotation so its colour
              // can be checked against the Task 1 slot it shares. Task 1 keeps a
              // single annotation: its indices are already asserted by name.
              ...(task === "2"
                ? [
                    {
                      criterion: "task_response",
                      issue: "E2E_ONLY_TASK_RESPONSE_ISSUE",
                      quote: body.essay?.slice(24, 48) ?? "E2E_ONLY_QUOTE_2",
                      explanation: "E2E_ONLY_TASK_RESPONSE_EXPLANATION",
                    },
                  ]
                : []),
            ],
      },
      meta: {
        request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY",
        service: "writing",
        operation: `writing.task${task}.grade`,
        timing: { downstream_ms: 0, gateway_overhead_ms: 0, total_ms: 0 },
      },
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, host, () => {
  // The port it bound, so a caller that asked for 0 can find it.
  console.log(`AIHUB_MOCK_LISTENING ${server.address().port}`);
});
