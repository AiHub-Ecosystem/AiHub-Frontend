import {
  customerWebOrigin,
  originIsAllowed,
  postAihubWebSession,
  readCreatedWebSession,
  safeLocalPath,
  WEB_SESSION_TTL_SECONDS,
  webSessionCookie,
} from "@/lib/auth-session";

const noStore = { "Cache-Control": "no-store" };

function redirectToLogin(
  error: string,
  retry?: number,
  next?: string,
  returnTo = "/login"
) {
  const login = new URL(returnTo, customerWebOrigin());
  login.searchParams.set("error", error);
  if (retry !== undefined) login.searchParams.set("retry", String(retry));
  if (next) login.searchParams.set("next", next);
  return new Response(null, {
    status: 303,
    headers: { ...noStore, Location: login.toString() },
  });
}

function retryAfterSeconds(header: string | null) {
  const seconds =
    header && /^\d+$/.test(header)
      ? Number(header)
      : header
        ? Math.ceil((Date.parse(header) - Date.now()) / 1000)
        : 60;
  return Math.min(3600, Math.max(1, Number.isFinite(seconds) ? seconds : 60));
}

export async function POST(request: Request) {
  if (!originIsAllowed(request))
    return new Response(null, { status: 403, headers: noStore });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response(null, { status: 400, headers: noStore });
  }
  const email = form.get("email");
  const password = form.get("password");
  const next = safeLocalPath(
    typeof form.get("next") === "string" ? (form.get("next") as string) : null
  );
  const returnTo = safeLocalPath(
    typeof form.get("return_to") === "string"
      ? (form.get("return_to") as string)
      : null,
    "/login"
  );
  if (
    typeof email !== "string" ||
    email.length < 1 ||
    email.length > 320 ||
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 256
  ) {
    return new Response(null, { status: 400, headers: noStore });
  }

  let upstream: Response;
  try {
    upstream = await postAihubWebSession("/v1/auth/web-sessions", {
      email,
      password,
    });
  } catch {
    return redirectToLogin("unavailable", undefined, next, returnTo);
  }

  if (upstream.status === 401)
    return redirectToLogin("invalid", undefined, next, returnTo);
  if (upstream.status === 429) {
    return redirectToLogin(
      "rate-limited",
      retryAfterSeconds(upstream.headers.get("retry-after")),
      next,
      returnTo
    );
  }
  if (!upstream.ok)
    return redirectToLogin("unavailable", undefined, next, returnTo);

  try {
    const sessionToken = await readCreatedWebSession(upstream);
    return new Response(null, {
      status: 303,
      headers: {
        ...noStore,
        Location: new URL(next, customerWebOrigin()).toString(),
        "Set-Cookie": webSessionCookie(sessionToken, WEB_SESSION_TTL_SECONDS),
      },
    });
  } catch {
    return redirectToLogin("unavailable", undefined, next, returnTo);
  }
}
