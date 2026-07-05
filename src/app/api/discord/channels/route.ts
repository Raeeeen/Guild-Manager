import { NextResponse } from "next/server";
import { getGuildChannels } from "@/lib/discord/api";

export async function GET() {
  try {
    const channels = await getGuildChannels();
    return NextResponse.json(channels);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}