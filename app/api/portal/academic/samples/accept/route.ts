import { NextResponse } from "next/server";
import { requireWebSession } from "@/lib/auth-session";

const BACKEND_URL =
  process.env.API_BASE_URL ||
  process.env.BACKEND_URL ||
  "http://localhost:3020";

export async function POST(request: Request) {
  const authFailure = await requireWebSession(request);
  if (authFailure) return authFailure;

  try {
    const body = await request.json().catch(() => ({}));
    const backendRes = await fetch(
      `${BACKEND_URL}/portal/academic/samples/accept`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BACKEND_UNREACHABLE",
          message: err.message || "Failed to reach backend service",
        },
      },
      { status: 502 }
    );
  }
}
