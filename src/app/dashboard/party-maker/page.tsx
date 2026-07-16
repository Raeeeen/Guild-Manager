/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useRef, useState } from "react";

type DiscordRole = {
  id: string;
  name: string;
  color: number;
};

type DiscordMember = {
  id: string;
  name: string;
  avatarUrl: string;
  roles: { name: string; color: number }[];
};

type PartyRole = "Tank" | "Dps" | "Support" | "Hybrid";

type PartyMember = DiscordMember & {
  assignmentRole: PartyRole;
};

type Party = {
  id: string;
  name: string;
  members: PartyMember[];
};

function roleColorHex(color: number) {
  if (!color) return "#9CA3AF";
  return `#${color.toString(16).padStart(6, "0")}`;
}

function getRoleCategory(role: string) {
  const normalized = role.toLowerCase();
  if (normalized.includes("tank")) return "Tank";
  if (normalized.includes("dps") || normalized.includes("damage")) return "Dps";
  if (
    normalized.includes("support") ||
    normalized.includes("heal") ||
    normalized.includes("medic")
  )
    return "Support";
  if (normalized.includes("hybrid") || normalized.includes("flex"))
    return "Hybrid";
  return "Other";
}

function getRoleCategoryEmoji(role: string) {
  switch (getRoleCategory(role)) {
    case "Tank":
      return "🛡️";
    case "Dps":
      return "⚔️";
    case "Support":
      return "💊";
    case "Hybrid":
      return "🔄";
    default:
      return "❓";
  }
}

function createParty(id: string, index: number): Party {
  return {
    id,
    name: `Party ${index}`,
    members: [],
  };
}

function serializeParties(parties: Party[]) {
  return parties.map((p) => ({
    id: p.id,
    name: p.name,
    members: p.members.map((m) => ({
      id: m.id,
      assignmentRole: m.assignmentRole,
    })),
  }));
}

function deserializeParties(
  saved: {
    id: string;
    name: string;
    members: { id: string; assignmentRole: PartyRole }[];
  }[],
  members: DiscordMember[],
) {
  return saved.map((p) => ({
    id: p.id,
    name: p.name,
    members: p.members
      .map((savedMember) => {
        const member = members.find((m) => m.id === savedMember.id);
        return member
          ? ({
              ...member,
              assignmentRole: savedMember.assignmentRole,
            } as PartyMember)
          : null;
      })
      .filter((m): m is PartyMember => Boolean(m)),
  }));
}

export default function PartyMakerPage() {
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [members, setMembers] = useState<DiscordMember[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [partyTitle, setPartyTitle] = useState("");
  const [partyDate, setPartyDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [partyTime, setPartyTime] = useState<string>(
    new Date().toISOString().slice(11, 16),
  );
  const [partySize, setPartySize] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedAssignmentRole, setSelectedAssignmentRole] =
    useState<PartyRole>("Tank");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [roleSearch, setRoleSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [draggedMember, setDraggedMember] = useState<PartyMember | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    partyId: string;
    memberId?: string;
    position?: "before" | "after";
  } | null>(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [rolesRes, membersRes, boardRes] = await Promise.all([
          fetch("/api/discord/roles"),
          fetch("/api/discord/members"),
          fetch("/api/party-maker"),
        ]);
        const [rolesData, membersData, boardData] = await Promise.all([
          rolesRes.json(),
          membersRes.json(),
          boardRes.json(),
        ]);

        if (Array.isArray(rolesData)) setRoles(rolesData);

        const loadedMembers: DiscordMember[] =
          membersData?.members && Array.isArray(membersData.members)
            ? membersData.members
            : [];
        setMembers(loadedMembers);

        if (boardData?.parties?.length) {
          setPartySize(boardData.partySize ?? 5);
          setPartyTitle(boardData.title ?? "");
          setPartyDate(boardData.date ?? new Date().toISOString().slice(0, 10));
          setPartyTime(
            boardData.time ?? new Date().toISOString().slice(11, 16),
          );
          const restored = deserializeParties(boardData.parties, loadedMembers);
          setParties(restored);
          setSelectedPartyId(restored[0]?.id ?? "");
        } else {
          const firstParty = createParty(crypto.randomUUID(), 1);
          setParties([firstParty]);
          setSelectedPartyId(firstParty.id);
        }
      } catch {
        setError("Failed to load Discord roles and members.");
      } finally {
        setLoading(false);
        hasLoaded.current = true;
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) return;
    const timeout = setTimeout(() => {
      fetch("/api/party-maker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: partyTitle,
          date: partyDate,
          time: partyTime,
          partySize,
          parties: serializeParties(parties),
        }),
      }).catch(() =>
        setError("Failed to save — other users may not see this change."),
      );
    }, 600);
    return () => clearTimeout(timeout);
  }, [parties, partySize, partyTitle, partyDate, partyTime]);

  function addParty() {
    const nextParty = createParty(crypto.randomUUID(), parties.length + 1);
    setParties((current) => [...current, nextParty]);
    setSelectedPartyId(nextParty.id);
    setError(null);
  }

  function removeParty(partyId: string) {
    setParties((current) => {
      const nextParties = current.filter((party) => party.id !== partyId);
      if (selectedPartyId === partyId) {
        setSelectedPartyId(nextParties[0]?.id ?? "");
      }
      return nextParties;
    });
  }

  function updatePartyName(partyId: string, name: string) {
    setParties((current) =>
      current.map((party) =>
        party.id === partyId ? { ...party, name } : party,
      ),
    );
  }

  function handleAddMember() {
    if (!selectedMemberId) {
      setError("Select a member first.");
      return;
    }

    if (!selectedPartyId) {
      setError("Select a party first.");
      return;
    }

    const memberToAdd = members.find(
      (member) => member.id === selectedMemberId,
    );
    if (!memberToAdd) return;

    const partyMember: PartyMember = {
      ...memberToAdd,
      assignmentRole: selectedAssignmentRole,
    };

    const targetParty = parties.find((party) => party.id === selectedPartyId);
    if (!targetParty) return;

    if (targetParty.members.length >= partySize) {
      setError(`Party ${targetParty.name} is already full.`);
      return;
    }

    setParties((current) =>
      current.map((party) => {
        if (party.id === selectedPartyId) {
          return {
            ...party,
            members: [
              ...party.members.filter((item) => item.id !== partyMember.id),
              partyMember,
            ],
          };
        }

        return {
          ...party,
          members: party.members.filter((item) => item.id !== partyMember.id),
        };
      }),
    );

    setSelectedMemberId("");
    setMemberSearch("");
    setError(null);
  }

  function removeMember(partyId: string, memberId: string) {
    setParties((current) =>
      current.map((party) =>
        party.id === partyId
          ? {
              ...party,
              members: party.members.filter((member) => member.id !== memberId),
            }
          : party,
      ),
    );
  }

  function updateMemberAssignmentRole(
    partyId: string,
    memberId: string,
    assignmentRole: PartyRole,
  ) {
    setParties((current) =>
      current.map((party) =>
        party.id === partyId
          ? {
              ...party,
              members: party.members.map((member) =>
                member.id === memberId ? { ...member, assignmentRole } : member,
              ),
            }
          : party,
      ),
    );
  }

  function handleDrop(
    partyId: string,
    targetMemberId?: string,
    position: "before" | "after" = "before",
  ) {
    if (!draggedMember) return;

    const targetParty = parties.find((party) => party.id === partyId);
    if (!targetParty) return;

    const isSameParty = targetParty.members.some(
      (member) => member.id === draggedMember.id,
    );

    if (!isSameParty && targetParty.members.length >= partySize) {
      setError(`Party ${targetParty.name} is already full.`);
      setDraggedMember(null);
      setDropTarget(null);
      return;
    }

    if (targetMemberId === draggedMember.id) {
      setDraggedMember(null);
      setDropTarget(null);
      return;
    }

    const existingMembers = targetParty.members.filter(
      (member) => member.id !== draggedMember.id,
    );

    let insertIndex = targetMemberId
      ? existingMembers.findIndex((member) => member.id === targetMemberId)
      : -1;

    if (insertIndex >= 0 && position === "after") {
      insertIndex += 1;
    }

    const newMembers =
      insertIndex >= 0
        ? [
            ...existingMembers.slice(0, insertIndex),
            draggedMember,
            ...existingMembers.slice(insertIndex),
          ]
        : [...existingMembers, draggedMember];

    setParties((current) =>
      current.map((party) => {
        if (party.id === partyId) {
          return { ...party, members: newMembers };
        }
        return {
          ...party,
          members: party.members.filter(
            (member) => member.id !== draggedMember.id,
          ),
        };
      }),
    );

    setDraggedMember(null);
    setDropTarget(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
          Party Maker
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Create parties, set a player limit for each one, and assign members by
          Discord role.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Party title
            </label>
            <input
              value={partyTitle}
              onChange={(event) => setPartyTitle(event.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
              placeholder="Enter a title for this party event"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Date
            </label>
            <input
              type="date"
              value={partyDate}
              onChange={(event) => setPartyDate(event.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Time
            </label>
            <input
              type="time"
              value={partyTime}
              onChange={(event) => setPartyTime(event.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Players per party
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={partySize}
              onChange={(event) =>
                setPartySize(Number(event.target.value) || 1)
              }
              className="w-32 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={addParty}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            + Add party
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Loading Discord members...
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
            <div className="grid gap-4 xl:grid-cols-[220px_220px_1fr]">
              <div>
                <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
                  Assign to party
                </label>
                <select
                  value={selectedPartyId}
                  onChange={(event) => setSelectedPartyId(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                >
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
                  Filter by Discord role
                </label>
                <div className="relative">
                  <input
                    value={roleSearch}
                    onChange={(event) => {
                      setRoleSearch(event.target.value);
                      setRoleDropdownOpen(true);
                    }}
                    onFocus={() => setRoleDropdownOpen(true)}
                    placeholder="Search roles"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                  />
                  {roleDropdownOpen && (
                    <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRoleFilter("all");
                          setRoleSearch("");
                          setRoleDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        <span className="h-2.5 w-2.5 rounded-full bg-neutral-400" />
                        All roles
                      </button>
                      {roles
                        .filter((role) =>
                          role.name
                            .toLowerCase()
                            .includes(roleSearch.toLowerCase()),
                        )
                        .map((role) => (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => {
                              setSelectedRoleFilter(role.name);
                              setRoleSearch(role.name);
                              setRoleDropdownOpen(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: roleColorHex(role.color),
                              }}
                            />
                            <span>{role.name}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
                  Add member
                </label>
                <div className="relative">
                  <input
                    value={memberSearch}
                    onChange={(event) => {
                      setMemberSearch(event.target.value);
                      setMemberDropdownOpen(true);
                    }}
                    onFocus={() => setMemberDropdownOpen(true)}
                    placeholder="Search members"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                  />
                  {memberDropdownOpen && (
                    <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                      {members
                        .filter((member) => {
                          const matchesRole =
                            selectedRoleFilter === "all" ||
                            member.roles.some(
                              (r) => r.name === selectedRoleFilter,
                            );
                          const matchesSearch = `${member.name} ${member.roles
                            .map((r) => r.name)
                            .join(" ")}`
                            .toLowerCase()
                            .includes(memberSearch.toLowerCase());
                          return matchesRole && matchesSearch;
                        })
                        .map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              setSelectedMemberId(member.id);
                              setMemberSearch(member.name);
                              setMemberDropdownOpen(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                          >
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="h-7 w-7 rounded-full"
                            />
                            <span className="flex-1 truncate">
                              {member.name}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              {getRoleCategoryEmoji(selectedAssignmentRole)}{" "}
                              {selectedAssignmentRole}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
                    Roles (Tank / Dps / Support / Hybrid)
                  </label>
                  <select
                    value={selectedAssignmentRole}
                    onChange={(event) =>
                      setSelectedAssignmentRole(event.target.value as PartyRole)
                    }
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                  >
                    <option value="Tank">🛡️ Tank</option>
                    <option value="Dps">⚔️ Dps</option>
                    <option value="Support">💊 Support</option>
                    <option value="Hybrid">🔄 Hybrid</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="mt-3 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300"
                >
                  Add member to selected party
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {parties.map((party) => (
              <div
                key={party.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropTarget({ partyId: party.id });
                }}
                onDragLeave={() =>
                  setDropTarget((current) =>
                    current?.partyId === party.id && !current.memberId
                      ? null
                      : current,
                  )
                }
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(party.id);
                }}
                className={`rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md dark:bg-neutral-950/60 ${
                  dropTarget?.partyId === party.id && !dropTarget.memberId
                    ? "border-indigo-400 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-500/10"
                    : "border-neutral-200 bg-white dark:border-neutral-800"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <input
                      value={party.name}
                      onChange={(event) =>
                        updatePartyName(party.id, event.target.value)
                      }
                      className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-sm font-semibold text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                    />
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {party.members.length}-man party
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      {party.members.length}/{partySize}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeParty(party.id)}
                      className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="flex flex-col">
                  {party.members.length === 0 ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      No members yet.
                    </p>
                  ) : (
                    party.members.map((member) => (
                      <div
                        key={member.id}
                        draggable
                        onDragStart={() => setDraggedMember(member)}
                        onDragEnd={() => {
                          setDraggedMember(null);
                          setDropTarget(null);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          const position =
                            event.clientY - rect.top > rect.height / 2
                              ? "after"
                              : "before";
                          setDropTarget({
                            partyId: party.id,
                            memberId: member.id,
                            position,
                          });
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          const position =
                            event.clientY - rect.top > rect.height / 2
                              ? "after"
                              : "before";
                          handleDrop(party.id, member.id, position);
                        }}
                        onDragLeave={() =>
                          setDropTarget((current) =>
                            current?.partyId === party.id &&
                            current.memberId === member.id
                              ? null
                              : current,
                          )
                        }
                        className={`flex cursor-grab flex-col gap-3 rounded-lg border px-2.5 py-2 transition-colors dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:bg-neutral-800 ${
                          dropTarget?.partyId === party.id &&
                          dropTarget?.memberId === member.id
                            ? "border-indigo-400 bg-indigo-50/40 dark:bg-indigo-500/10"
                            : "border-neutral-200 bg-neutral-50 hover:bg-neutral-100"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="h-7 w-7 rounded-full"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">
                              {member.name}
                            </p>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              {getRoleCategoryEmoji(member.assignmentRole)}{" "}
                              {member.assignmentRole}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <select
                            value={member.assignmentRole}
                            onChange={(event) =>
                              updateMemberAssignmentRole(
                                party.id,
                                member.id,
                                event.target.value as PartyRole,
                              )
                            }
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white sm:w-auto"
                          >
                            <option value="Tank">🛡️ Tank</option>
                            <option value="Dps">⚔️ Dps</option>
                            <option value="Support">💊 Support</option>
                            <option value="Hybrid">🔄 Hybrid</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeMember(party.id, member.id)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
