import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 3101;
const requests = [];
const authRequests = [];
const organizationRequests = [];
const speakingRequests = [];
const speakingAssertions = [];
let assertionSequence = 0;
let organizationConfig = {
  roster: [],
  apiKeys: [],
  unavailable: false,
  creationLimit: false,
  renameDenied: false,
  createUncertainOnce: false,
  createKeyUncertainOnce: false,
  rotateKeyUncertainOnce: false,
  apiKeyLimitReached: false,
  apiKeyEntitlementDenied: false,
  identityConfigs: {},
};
const createdOrganizations = new Map();
let uncertainCreationUsed = false;
let uncertainApiKeyCreationUsed = false;
let uncertainApiKeyRotationUsed = false;
let apiKeySequence = 0;
const knownForeignOrganizationIds = new Set(["foreign-org-known"]);
let authMode = {
  refreshUnauthorized: false,
  logoutDown: false,
  registerDown: false,
  resendDown: false,
  verifyDown: false,
  forgotDown: false,
  resetDown: false,
};

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(body));
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

  if (request.method === "POST" && pathname === "/__test__/auth/reset") {
    authRequests.length = 0;
    authMode = {
      refreshUnauthorized: false,
      logoutDown: false,
      registerDown: false,
      resendDown: false,
      verifyDown: false,
      forgotDown: false,
      resetDown: false,
    };
    organizationRequests.length = 0;
    createdOrganizations.clear();
    organizationConfig = {
      roster: [],
      apiKeys: [],
      unavailable: false,
      creationLimit: false,
      renameDenied: false,
      createUncertainOnce: false,
      createKeyUncertainOnce: false,
      rotateKeyUncertainOnce: false,
      apiKeyLimitReached: false,
      apiKeyEntitlementDenied: false,
      identityConfigs: {},
    };
    uncertainCreationUsed = false;
    uncertainApiKeyCreationUsed = false;
    uncertainApiKeyRotationUsed = false;
    apiKeySequence = 0;
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
          ...(item.identity_configured === undefined
            ? {}
            : { identity_configured: item.identity_configured }),
        })),
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
    organizationRequests.push({
      method: request.method,
      path: "identity-config",
      organizationId,
    });
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
      });
      return;
    }
    const input = await readJson(request);
    if (organizationConfig.identityErrorCode) {
      const code = organizationConfig.identityErrorCode;
      sendJson(
        response,
        code === "ORGANIZATION_IDENTITY_ISSUER_CONFLICT" ? 409 : 400,
        { error: { code } }
      );
      return;
    }
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
    sendJson(response, 200, { data: config });
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
    if (organizationConfig.apiKeyLimitReached) {
      sendJson(response, 403, { error: { code: "API_KEY_LIMIT_REACHED" } });
      return;
    }
    if (organizationConfig.apiKeyEntitlementDenied) {
      sendJson(response, 403, {
        error: { code: "API_KEY_SCOPE_NOT_ENTITLED" },
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
      sendJson(response, 503, {
        error: { code: "LOCAL_MOCK_UNCERTAIN_RESULT" },
      });
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
      sendJson(response, 503, {
        error: { code: "LOCAL_MOCK_UNCERTAIN_RESULT" },
      });
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
    });
    if (organizationConfig.creationLimit) {
      sendJson(response, 409, {
        error: { code: "ORGANIZATION_CREATION_LIMIT_REACHED" },
      });
      return;
    }
    const key = request.headers["idempotency-key"];
    let organization = createdOrganizations.get(key);
    if (!organization) {
      organization = {
        organization_id: "org-created-12345678",
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
      sendJson(response, 503, {
        error: { code: "LOCAL_MOCK_UNCERTAIN_RESULT" },
      });
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
        error: { code: "ORGANIZATION_ACCESS_DENIED" },
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

  if (request.method === "POST" && pathname === "/v1/auth/login") {
    const body = await readJson(request);
    authRequests.push({
      path: "login",
      email: body.email,
      hasPassword: typeof body.password === "string",
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
    const loginNumber = authRequests.filter(
      (entry) => entry.path === "login"
    ).length;
    const expiresIn = body.email === "expiring@example.test" ? 2 : 900;
    sendJson(
      response,
      200,
      {
        data: {
          access_token: `access-token-${loginNumber}`,
          token_type: "Bearer",
          expires_in: expiresIn,
        },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      },
      {
        "Cache-Control": "no-store",
        "Set-Cookie": `__Host-aihub_refresh=refresh-token-${loginNumber}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Strict`,
      }
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
    sendJson(response, 201, {
      data: {
        email: body.email,
        username: body.username,
        status: "pending_verification",
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
    });
    if (authMode.resendDown) {
      sendJson(response, 503, { error: { code: "INTERNAL_ERROR" } });
      return;
    }
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
      sendJson(response, 503, { error: { code: "INTERNAL_ERROR" } });
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
    response.writeHead(202, { "Cache-Control": "no-store" }).end();
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/verify-email") {
    const body = await readJson(request);
    authRequests.push({
      path: "verify",
      hasToken: typeof body.token === "string",
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
      sendJson(response, 503, { error: { code: "INTERNAL_ERROR" } });
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

  if (request.method === "POST" && pathname === "/v1/auth/refresh") {
    const hasRefreshCookie = (request.headers.cookie ?? "").includes(
      "__Host-aihub_refresh="
    );
    authRequests.push({ path: "refresh", hasRefreshCookie });
    if (authMode.refreshUnauthorized || !hasRefreshCookie) {
      sendJson(response, 401, {
        error: { code: "AUTH_REFRESH_TOKEN_INVALID" },
      });
      return;
    }
    const refreshNumber = authRequests.filter(
      (entry) => entry.path === "refresh"
    ).length;
    await new Promise((resolve) => setTimeout(resolve, 120));
    sendJson(
      response,
      200,
      {
        data: {
          access_token: `access-token-refreshed-${refreshNumber}`,
          token_type: "Bearer",
          expires_in: 900,
        },
        meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
      },
      {
        "Cache-Control": "no-store",
        "Set-Cookie": `__Host-aihub_refresh=refresh-token-rotated-${refreshNumber}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Strict`,
      }
    );
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/logout") {
    authRequests.push({
      path: "logout",
      hasRefreshCookie: (request.headers.cookie ?? "").includes(
        "__Host-aihub_refresh="
      ),
    });
    if (authMode.logoutDown) {
      sendJson(response, 503, { error: { code: "LOCAL_MOCK_OUTAGE" } });
      return;
    }
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
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
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
      meta: { request_id: "req_01M3B7FRTFBA7ZEN6YJP8KCBEY" },
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, host);
