import { NextRequest, NextResponse } from "next/server";

const BOT_API_URL = process.env.BOT_API_URL!;
const BOT_API_SECRET = process.env.BOT_INTERNAL_API_SECRET!;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const res = await fetch(`${BOT_API_URL}/api/announcements/${id}`, {
    method: "DELETE",
    headers: { "x-api-key": BOT_API_SECRET },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}