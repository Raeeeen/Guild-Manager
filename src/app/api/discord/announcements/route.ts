import { NextRequest, NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL!;
const BOT_API_SECRET = process.env.BOT_INTERNAL_API_SECRET!;

export async function GET(req: NextRequest) {
  const guildId = req.nextUrl.searchParams.get("guildId");
  const url = new URL(`${BOT_API_URL}/api/announcements`);
  if (guildId) url.searchParams.set("guildId", guildId);

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": BOT_API_SECRET },
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const res = await fetch(`${BOT_API_URL}/api/announcements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BOT_API_SECRET,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}