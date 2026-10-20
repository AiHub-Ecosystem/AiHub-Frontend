// Issue #100 spike: the harness the tRPC seam comparison runs on.
//
// One fake AIHUB upstream (the repository's E2E mock, so every upstream answer
// is validated against the pinned OpenAPI contract) and one HTTP server that
// answers both transports. The browser half of the seam is a real `fetch`.

import { spawn } from "node:child_process";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

export type RouteHandler = (request: Request) => Promise<Response>;

/** The browser half of the seam: one Organization creation over one transport. */
export type Transport = {
  create(body: unknown, headers: Record<string, string>): Promise<Response>;
  /** Posts a body as it stands, for the malformed-body case. */
  raw(body: string, headers: Record<string, string>): Promise<Response>;
  /** Where the BFF's own error code sits in this transport's body. */
  bffCode(body: unknown): string | undefined;
  organizationId(body: unknown): string | undefined;
};

export type Seam = {
  upstreamUrl: string;
  bffUrl: string;
  bffOrigin: string;
  rest: Transport;
  trpc: Transport;
  signIn(): Promise<string>;
  reset(): Promise<void>;
  configure(config: Record<string, unknown>): Promise<void>;
  createRequests(): Promise<{ name: string; idempotencyKey?: string }[]>;
  upstreamState(): Promise<{ organizations: { organization_id: string }[] }>;
  close(): Promise<void>;
};

async function startFakeUpstream() {
  const child = spawn(
    process.execPath,
    [path.join(repoRoot, "tests/e2e/mock-aihub-server.mjs")],
    {
      cwd: repoRoot,
      env: { ...process.env, AIHUB_MOCK_PORT: "0" },
      stdio: ["ignore", "pipe", "inherit"],
    }
  );
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The fake AIHUB upstream never reported a port")),
      15_000
    );
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
      const match = /AIHUB_MOCK_LISTENING (\d+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(
        new Error(`The fake AIHUB upstream exited with code ${code ?? "null"}`)
      );
    });
  });
  return { child, url: `http://127.0.0.1:${port}` };
}

async function toRequest(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value))
      for (const item of value) headers.append(key, item);
    else headers.set(key, value);
  }
  return new Request(
    `http://${request.headers.host ?? "127.0.0.1"}${request.url}`,
    {
      method: request.method,
      headers,
      body: body.length ? body : undefined,
    }
  );
}

async function writeResponse(response: ServerResponse, outgoing: Response) {
  const headers: Record<string, string | string[]> = {};
  for (const [key, value] of outgoing.headers.entries()) {
    if (key === "set-cookie") continue;
    headers[key] = value;
  }
  const cookies = outgoing.headers.getSetCookie();
  if (cookies.length) headers["set-cookie"] = cookies;
  response.writeHead(outgoing.status, headers);
  response.end(Buffer.from(await outgoing.arrayBuffer()));
}

async function startBff(handlers: { rest: RouteHandler; trpc: RouteHandler }) {
  const server: Server = createServer(async (request, response) => {
    const incoming = await toRequest(request);
    const handler = new URL(incoming.url).pathname.startsWith("/trpc")
      ? handlers.trpc
      : handlers.rest;
    await writeResponse(response, await handler(incoming));
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve())
  );
  const { port } = server.address() as AddressInfo;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    origin: `http://127.0.0.1:${port}`,
  };
}

function transport(
  url: string,
  bffCode: (body: unknown) => string | undefined,
  organizationId: (body: unknown) => string | undefined
): Transport {
  return {
    create: (body, headers) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
    raw: (body, headers) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body,
      }),
    bffCode,
    organizationId,
  };
}

export async function startSeam(handlers: {
  rest: RouteHandler;
  trpc: RouteHandler;
}): Promise<Seam> {
  const upstream = await startFakeUpstream();
  const bff = await startBff(handlers);
  process.env.AIHUB_BASE_URL = upstream.url;
  process.env.CUSTOMER_WEB_ORIGIN = bff.origin;

  const upstreamRequest = (pathname: string, init?: RequestInit) =>
    fetch(`${upstream.url}${pathname}`, init);

  return {
    upstreamUrl: upstream.url,
    bffUrl: bff.url,
    bffOrigin: bff.origin,
    rest: transport(
      `${bff.url}/api/organizations`,
      (body) => (body as { error?: { code?: string } })?.error?.code,
      (body) =>
        (body as { data?: { organization?: { organization_id?: string } } })
          ?.data?.organization?.organization_id
    ),
    trpc: transport(
      `${bff.url}/trpc/organizations.create`,
      (body) =>
        (body as { error?: { data?: { bffCode?: string } } })?.error?.data
          ?.bffCode,
      (body) =>
        (
          body as {
            result?: {
              data?: { data?: { organization?: { organization_id?: string } } };
            };
          }
        )?.result?.data?.data?.organization?.organization_id
    ),
    async reset() {
      await upstreamRequest("/__test__/auth/reset", { method: "POST" });
    },
    async configure(config) {
      await upstreamRequest("/__test__/organizations/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    },
    async createRequests() {
      const response = await upstreamRequest(
        "/__test__/organizations/requests"
      );
      const { requests } = (await response.json()) as { requests: unknown[] };
      return requests.filter(
        (entry) => (entry as { path?: string }).path === "create"
      ) as { name: string; idempotencyKey?: string }[];
    },
    async upstreamState() {
      const response = await upstreamRequest("/__test__/organizations/state");
      return (await response.json()) as {
        organizations: { organization_id: string }[];
      };
    },
    async signIn() {
      const response = await upstreamRequest("/v1/auth/web-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "spike@example.test",
          password: "correct horse battery staple",
        }),
      });
      const body = (await response.json()) as {
        data?: { web_session_token?: string };
      };
      const token = body.data?.web_session_token;
      if (!token)
        throw new Error("The fake AIHUB upstream issued no Web Session");
      return token;
    },
    async close() {
      let contractErrors: unknown[] = [];
      try {
        const response = await upstreamRequest("/__test__/contract-errors");
        if (!response.ok)
          throw new Error(
            `AIHUB mock contract check failed to report: ${response.status}`
          );
        const body = (await response.json()) as { errors?: unknown[] };
        contractErrors = body.errors ?? [];
      } finally {
        upstream.child.kill();
        await new Promise<void>((resolve) => bff.server.close(() => resolve()));
      }
      if (contractErrors.length)
        throw new Error(
          `AIHUB mock responses violate the pinned contract:\n${JSON.stringify(contractErrors, null, 2)}`
        );
    },
  };
}
