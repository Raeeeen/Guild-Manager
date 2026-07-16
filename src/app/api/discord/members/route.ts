import { NextResponse } from "next/server";
import {
  getGuildMembers,
  getGuildRoles,
  getAvatarUrl,
} from "@/lib/discord/api";

export async function GET() {
  try {
    const [members, roles] = await Promise.all([
      getGuildMembers(),
      getGuildRoles(),
    ]);

    const sortedRoles = [...roles].sort((a, b) => b.position - a.position);

    const formattedMembers = members
      .filter((m) => !m.user.bot)
      .map((m) => {
        const memberRoles = sortedRoles.filter(
          (r) => m.roles.includes(r.id) && r.name !== "@everyone",
        );

        return {
          id: m.user.id,
          name: m.nick || m.user.global_name || m.user.username,
          avatarUrl: getAvatarUrl(m.user.id, m.user.avatar),
          roles:
            memberRoles.length > 0
              ? memberRoles.map((r) => ({ name: r.name, color: r.color }))
              : [{ name: "Member", color: 0 }],
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({ members: formattedMembers });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 },
    );
  }
}