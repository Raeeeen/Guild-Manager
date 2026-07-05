'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'

export type Member = {
  id: string
  name: string
  avatarUrl: string
  role: string
  roleColor: number
}

function intToHex(color: number) {
  if (!color) return '#99a1af'
  return `#${color.toString(16).padStart(6, '0')}`
}

export default function MembersPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy] = useState<'role' | 'name'>('role')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/discord/members')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setMembers(data.members)
        }
      })
      .catch(() => setError('Failed to load members'))
      .finally(() => setLoading(false))
  }, [])

  const allRoles = useMemo(() => {
    const seen = new Set<string>()
    const order: string[] = []
    members.forEach((m) => {
      if (!seen.has(m.role)) {
        seen.add(m.role)
        order.push(m.role)
      }
    })
    return order
  }, [members])

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return members.filter((m) => {
      const matchesSearch = query === '' || m.name.toLowerCase().includes(query)
      const matchesRole = roleFilter === 'all' || m.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [members, search, roleFilter])

  const roleOrder = useMemo(() => {
    const seen = new Set<string>()
    const order: string[] = []
    filteredMembers.forEach((m) => {
      if (!seen.has(m.role)) {
        seen.add(m.role)
        order.push(m.role)
      }
    })
    return order
  }, [filteredMembers])

  const groupedByRole = useMemo(() => {
    const groups: Record<string, Member[]> = {}
    roleOrder.forEach((role) => {
      groups[role] = filteredMembers
        .filter((m) => m.role === role)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    })
    return groups
  }, [filteredMembers, roleOrder])

  const sortedByName = useMemo(
    () =>
      [...filteredMembers].sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
      ),
    [filteredMembers]
  )

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading members...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {filteredMembers.length} / {members.length} members
        </span>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-48 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
          >
            <option value="all">All roles</option>
            {allRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          No members match your search.
        </p>
      ) : sortBy === 'role' ? (
        <div className="space-y-5">
          {roleOrder.map((role) => {
            const roleMembers = groupedByRole[role]
            if (!roleMembers || roleMembers.length === 0) return null

            return (
              <div key={role}>
                <h3
                  className="mb-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: intToHex(roleMembers[0].roleColor) }}
                >
                  {role} — {roleMembers.length}
                </h3>
                <div className="space-y-1">
                  {roleMembers.map((member) => (
                    <MemberRow key={member.id} member={member} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {sortedByName.map((member) => (
            <MemberRow key={member.id} member={member} showRole />
          ))}
        </div>
      )}
    </div>
  )
}

function MemberRow({
  member,
  showRole = false,
}: {
  member: Member
  showRole?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800">
      <Image
        src={member.avatarUrl}
        alt={member.name}
        width={32}
        height={32}
        className="rounded-full"
      />
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
        {member.name}
      </span>
      {showRole && (
        <span
          className="ml-auto text-xs font-medium"
          style={{ color: intToHex(member.roleColor) }}
        >
          {member.role}
        </span>
      )}
    </div>
  )
}