import { NextResponse } from "next/server";
import { getGuildRoles } from "@/lib/discord/api";

export async function GET() {
  try {
    const roles = await getGuildRoles();
    return NextResponse.json(roles);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}