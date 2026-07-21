import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET() {
  try {
    const upstream = await fetch(`${BACKEND_URL}/health`);
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("Failed to proxy /health:", err);
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
