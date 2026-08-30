import { NextResponse } from "next/server";

const BACKEND_URL = process.env.API_BASE_URL || process.env.BACKEND_URL || "http://localhost:3020";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const backendRes = await fetch(`${BACKEND_URL}/portal/academic/samples?${searchParams.toString()}`, {
      cache: "no-store",
    });
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
      { status: 502 },
    );
  }
}
