import { unstable_cache } from 'next/cache'

const DISCORD_API = 'https://discord.com/api/v10'

function discordHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export type DiscordRole = {
  id: string
  name: string
  color: number
  position: number
}

export type DiscordMember = {
  user: {
    id: string
    username: string
    avatar: string | null
    global_name: string | null
    bot?: boolean
  }
  nick: string | null
  roles: string[]
}

export type DiscordChannel = {
  id: string
  name: string
  type: number
  position: number
  parent_id: string | null
}

const ANNOUNCEABLE_CHANNEL_TYPES = [0, 5]

export const getGuildChannels = unstable_cache(
  async (): Promise<DiscordChannel[]> => {
    const res = await fetch(
      `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/channels`,
      { headers: discordHeaders() }
    )

    if (!res.ok) {
      throw new Error(`Failed to fetch channels: ${res.status} ${await res.text()}`)
    }

    const channels: DiscordChannel[] = await res.json()

    return channels
      .filter((c) => ANNOUNCEABLE_CHANNEL_TYPES.includes(c.type))
      .sort((a, b) => a.position - b.position)
  },
  ['guild-channels'],
  { revalidate: 30 }
)

export const getGuildRoles = unstable_cache(
  async (): Promise<DiscordRole[]> => {
    const res = await fetch(
      `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/roles`,
      { headers: discordHeaders() }
    )

    if (!res.ok) {
      throw new Error(`Failed to fetch roles: ${res.status} ${await res.text()}`)
    }

    return res.json()
  },
  ['guild-roles'],
  { revalidate: 30 }
)

export const getGuildMembers = unstable_cache(
  async (): Promise<DiscordMember[]> => {
    const res = await fetch(
      `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members?limit=1000`,
      { headers: discordHeaders() }
    )

    if (!res.ok) {
      throw new Error(`Failed to fetch members: ${res.status} ${await res.text()}`)
    }

    return res.json()
  },
  ['guild-members'],
  { revalidate: 30 }
)

export function getAvatarUrl(userId: string, avatarHash: string | null) {
  if (!avatarHash) {
    return `https://cdn.discordapp.com/embed/avatars/${Number(userId) % 5}.png`
  }
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`
}