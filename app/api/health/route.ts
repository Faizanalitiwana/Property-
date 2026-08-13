import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "ToolNest Website Intelligence",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
}
