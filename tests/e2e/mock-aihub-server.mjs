import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 3101;
const requests = [];
const authRequests = [];
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
    response.writeHead(204).end();
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
        meta: { request_id: "local-mock" },
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
      meta: { request_id: "local-mock" },
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
        meta: { request_id: "local-mock" },
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

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, host);
