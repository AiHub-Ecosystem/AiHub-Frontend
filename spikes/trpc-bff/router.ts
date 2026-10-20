// Issue #100 spike: the tRPC half of the browser-to-Customer Web BFF seam.
//
// The prototype reuses the current route's BFF building blocks on purpose, so
// the comparison in `tests/integration/trpc-bff-seam.test.ts` measures the
// transport rather than a second implementation of the rules. Nothing under
// `spikes/` is mounted in `app/`, so no production caller can reach it.

import { initTRPC, TRPCError, type TRPC_ERROR_CODE_KEY } from "@trpc/server";
import {
  authenticatedAihubFetch,
  rejectedWebSessionCookie,
  requireWebSession,
  webSessionIdFromRequest,
} from "@/lib/auth-session";
import {
  validatedOrganizationName,
  UUID_V4_PATTERN,
} from "@/lib/organizations";

/**
 * The BFF's own error code and the status it answers with, carried beside
 * tRPC's error key so the browser keeps reading the codes the Console handles.
 */
class BffError extends Error {
  constructor(
    readonly bffCode: string,
    readonly httpStatus: number
  ) {
    super(bffCode);
    this.name = "BffError";
  }
}

/**
 * tRPC labels an error with one of its own keys. This map translates the
 * statuses the seam can answer; a status outside it keeps the answer but
 * loses the label.
 */
const TRPC_KEY_BY_STATUS: Record<number, TRPC_ERROR_CODE_KEY> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  412: "PRECONDITION_FAILED",
  422: "UNPROCESSABLE_CONTENT",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

export type SpikeContext = {
  req: Request;
  resHeaders: Headers;
};

const t = initTRPC.context<SpikeContext>().create({
  errorFormatter({ error, shape }) {
    const bff = error.cause instanceof BffError ? error.cause : null;
    return {
      ...shape,
      data: {
        ...shape.data,
        // tRPC reads the answer's status from the error shape, so the BFF's own
        // status survives even where tRPC has no key for it.
        ...(bff ? { httpStatus: bff.httpStatus } : {}),
        ...(bff ? { bffCode: bff.bffCode } : {}),
      },
    };
  },
});

function upstreamError(
  ctx: SpikeContext,
  upstream: Response,
  code: string
): TRPCError {
  const clearCookie = rejectedWebSessionCookie(upstream);
  if (clearCookie) ctx.resHeaders.set("set-cookie", clearCookie);
  return new TRPCError({
    code: TRPC_KEY_BY_STATUS[upstream.status] ?? "INTERNAL_SERVER_ERROR",
    message: code,
    cause: new BffError(code, upstream.status),
  });
}

async function createOrganization(
  ctx: SpikeContext,
  sessionId: string,
  name: string,
  idempotencyKey: string
) {
  let upstream: Response;
  let text: string;
  try {
    upstream = await authenticatedAihubFetch(
      ctx.req,
      sessionId,
      "/v1/organizations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ name }),
      }
    );
    text = await upstream.text();
  } catch {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "AIHUB is unavailable",
      cause: new BffError("ORGANIZATION_CREATE_UNAVAILABLE", 503),
    });
  }

  if (upstream.ok) {
    try {
      return JSON.parse(text);
    } catch {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "AIHUB answered with an unreadable body",
        cause: new BffError("ORGANIZATION_CREATE_FAILED", 502),
      });
    }
  }

  let code = "ORGANIZATION_CREATE_FAILED";
  try {
    const parsed = JSON.parse(text) as { error?: { code?: unknown } };
    if (typeof parsed.error?.code === "string") code = parsed.error.code;
  } catch {}
  throw upstreamError(ctx, upstream, code);
}

export const spikeRouter = t.router({
  organizations: t.router({
    create: t.procedure
      // tRPC types an input only through a validator; this one keeps the raw
      // body, so the prototype validates exactly like the current route.
      .input((raw: unknown) => raw as { name?: unknown })
      .mutation(async ({ ctx, input }) => {
        const denied = await requireWebSession(ctx.req);
        if (denied) {
          const cookie = denied.headers.get("set-cookie");
          if (cookie) ctx.resHeaders.set("set-cookie", cookie);
          const unauthorized = denied.status === 401;
          const bffCode = unauthorized ? "AUTH_REQUIRED" : "AUTH_UNAVAILABLE";
          throw new TRPCError({
            code: unauthorized ? "UNAUTHORIZED" : "SERVICE_UNAVAILABLE",
            message: bffCode,
            cause: new BffError(bffCode, denied.status),
          });
        }

        const sessionId = webSessionIdFromRequest(ctx.req)!;
        const name = validatedOrganizationName(input?.name);
        if (!name)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid Organization name",
            cause: new BffError("INVALID_NAME", 400),
          });

        const idempotencyKey = ctx.req.headers.get("idempotency-key");
        if (!idempotencyKey || !UUID_V4_PATTERN.test(idempotencyKey))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid idempotency key",
            cause: new BffError("IDEMPOTENCY_KEY_REQUIRED", 400),
          });

        return await createOrganization(ctx, sessionId, name, idempotencyKey);
      }),
  }),
});

export type SpikeRouter = typeof spikeRouter;
