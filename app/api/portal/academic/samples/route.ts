import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const BACKEND_URL = process.env.API_BASE_URL || "http://localhost:3020";
const LOCAL_DATA_PATH = path.resolve(process.cwd(), "..", "backend", "data", "academic_samples.json");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const criterion = searchParams.get("criterion");
  const errorCode = searchParams.get("error_code");
  const topic = searchParams.get("topic");

  // 1. Try fetching from Backend Express API
  try {
    const backendRes = await fetch(`${BACKEND_URL}/portal/academic/samples?${searchParams.toString()}`, {
      cache: "no-store",
    });
    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data);
    }
  } catch {
    // Backend not running, proceed to local disk fallback
  }

  // 2. Resilient local fallback from data file
  try {
    if (fs.existsSync(LOCAL_DATA_PATH)) {
      const raw = fs.readFileSync(LOCAL_DATA_PATH, "utf-8");
      let items = JSON.parse(raw);

      if (status) items = items.filter((i: any) => i.status === status.toUpperCase());
      if (criterion) items = items.filter((i: any) => i.criterion === criterion);
      if (errorCode) items = items.filter((i: any) => i.errorCode === errorCode);
      if (topic) items = items.filter((i: any) => i.topic === topic);

      return NextResponse.json({
        success: true,
        data: {
          items,
          total: items.length,
          page: 1,
          limit: items.length,
        },
      });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    },
  });
}
