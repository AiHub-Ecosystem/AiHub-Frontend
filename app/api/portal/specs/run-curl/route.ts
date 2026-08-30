import { NextResponse } from "next/server";

const BACKEND_URL = process.env.API_BASE_URL || process.env.BACKEND_URL || "http://localhost:3020";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const backendRes = await fetch(`${BACKEND_URL}/portal/specs/run-curl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PROXY_ERROR",
          message: error.message || "Failed to communicate with backend service",
        },
      },
      { status: 502 },
    );
  }
}
