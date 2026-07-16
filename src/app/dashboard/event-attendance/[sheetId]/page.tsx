"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Sheet,
  loadSheets,
  updateSheet,
  Member,
  isLegacyPlaceholderMembers,
  normalizeMember,
  getMemberRoleNames,
} from "@/lib/event-schedule";

function getColumnIds(eventCount: number) {
  return Array.from({ length: eventCount }, (_, index) =>
    String.fromCharCode(66 + index),
  );
}

function getMemberRoleValues(member: Member): string[] {
  if (Array.isArray(member.roles) && member.roles.length > 0) {
    return member.roles.map((role) => String(role));
  }

  if (typeof member.role === "string" && member.role.trim()) {
    return [member.role];
  }

  return ["Member"];
}

export default function SheetDetailPage() {
  const params = useParams();
  const sheetId = params?.sheetId ?? "";
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [search, setSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("All roles");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [discordMembers, setDiscordMembers] = useState<Member[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);

  useEffect(() => {
    let active = true;

    const loadSheet = async () => {
      const loadedSheets = await loadSheets();
      const saved = loadedSheets.find((item) => item.id === sheetId);

      if (!active) return;

      if (!saved) {
        setSheet(null);
        return;
      }

      const normalizedMembers = saved.members.map(normalizeMember);
      const normalizedSheet = { ...saved, members: normalizedMembers } as Sheet;
      setSheet(normalizedSheet);

      if (
        normalizedSheet.members.some((member) => !Array.isArray(member.roles))
      ) {
        await updateSheet(normalizedSheet);
      }
    };

    void loadSheet();
    return () => {
      active = false;
    };
  }, [sheetId]);

  useEffect(() => {
    async function loadDiscordMembers() {
      try {
        const response = await fetch("/api/discord/members");
        if (!response.ok) {
          throw new Error(`Failed to load members: ${response.status}`);
        }
        const data = await response.json();
        setDiscordMembers(data.members ?? []);
      } catch (error: unknown) {
        console.error(error);
        setFetchError(
          "Unable to load Discord members. Showing existing sheet members.",
        );
      }
    }

    void loadDiscordMembers();
  }, []);

  useEffect(() => {
    if (
      !sheet ||
      discordMembers.length === 0 ||
      !isLegacyPlaceholderMembers(sheet.members)
    )
      return;

    const syncMembers = async () => {
      const scopedMembers = sheet.roleFilter
        ? discordMembers.filter((member) =>
            getMemberRoleNames(member).some(
              (role) => role.toLowerCase() === sheet.roleFilter!.toLowerCase(),
            ),
          )
        : discordMembers;

      const updatedSheet = {
        ...sheet,
        members: scopedMembers.map(normalizeMember),
      };
      setSheet(updatedSheet);
      await updateSheet(updatedSheet);
    };

    void syncMembers();
  }, [sheet, discordMembers]);

  const roleOptions = useMemo(() => {
    if (!sheet) return ["All roles"];

    const roleValues = sheet.members.flatMap((member) =>
      getMemberRoleValues(member),
    );
    const uniqueRoles = Array.from(
      new Set(roleValues.map((role) => String(role))),
    );

    return ["All roles", ...uniqueRoles.sort((a, b) => a.localeCompare(b))];
  }, [sheet]);

  const effectiveRole = sheet?.roleFilter ?? selectedRole;

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    const normalizedSelectedRole = (effectiveRole ?? "All roles").toLowerCase();
    const roleFilterActive = Boolean(
      effectiveRole && effectiveRole !== "All roles" && effectiveRole !== null,
    );

    return (
      sheet?.members
        .filter((member) => {
          if (!roleFilterActive) return true;

          const roles = getMemberRoleValues(member);
          const hasRoleMatch = roles.some(
            (role) => String(role).toLowerCase() === normalizedSelectedRole,
          );

          if (hasRoleMatch) return true;

          const canShowAllWhenNoRoleMatches = sheet?.members.some(
            (candidate) => {
              const candidateRoles = getMemberRoleValues(candidate);
              return candidateRoles.some(
                (role) => String(role).toLowerCase() === normalizedSelectedRole,
              );
            },
          );

          return !canShowAllWhenNoRoleMatches;
        })
        .filter((member) => {
          const roles = getMemberRoleValues(member);
          return `${member.name} ${roles.join(" ")}`
            .toLowerCase()
            .includes(normalizedSearch);
        }) ?? []
    );
  }, [sheet, search, effectiveRole]);

  const filteredEvents = useMemo(() => {
    if (!sheet) return [];

    const normalizedEventSearch = eventSearch.toLowerCase();
    return sheet.events.filter((event) => {
      const haystack = `${event.name} ${event.date}`.toLowerCase();
      return haystack.includes(normalizedEventSearch);
    });
  }, [sheet, eventSearch]);

  const handleAddEvent = async () => {
    if (!sheet) return;
    const trimmed = eventName.trim();
    if (!trimmed) return;

    const newEvent = {
      id: `event-${sheet.events.length + 1}-${Date.now()}`,
      name: trimmed,
      date: eventDate,
    };

    const nextEvents = [...sheet.events, newEvent];
    const nextAttendance = { ...sheet.attendance };

    sheet.members.forEach((member) => {
      nextAttendance[member.id] = {
        ...nextAttendance[member.id],
        [newEvent.id]: false,
      };
    });

    const updatedSheet = {
      ...sheet,
      events: nextEvents,
      attendance: nextAttendance,
    };
    setSheet(updatedSheet);
    await updateSheet(updatedSheet);
    setEventName("");
  };

  const toggleAttendance = async (memberId: string, eventId: string) => {
    if (!sheet) return;

    const nextAttendance = {
      ...sheet.attendance,
      [memberId]: {
        ...sheet.attendance[memberId],
        [eventId]: !sheet.attendance[memberId]?.[eventId],
      },
    };
    const updatedSheet = { ...sheet, attendance: nextAttendance };
    setSheet(updatedSheet);
    await updateSheet(updatedSheet);
  };

  const toggleColumnAttendance = async (eventId: string) => {
    if (!sheet) return;

    const shouldMarkPresent = !filteredMembers.every((member) => {
      return Boolean(sheet.attendance[member.id]?.[eventId]);
    });

    const nextAttendance = { ...sheet.attendance };

    filteredMembers.forEach((member) => {
      nextAttendance[member.id] = {
        ...nextAttendance[member.id],
        [eventId]: shouldMarkPresent,
      };
    });

    const updatedSheet = { ...sheet, attendance: nextAttendance };
    setSheet(updatedSheet);
    await updateSheet(updatedSheet);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Don't hijack drags that start on interactive elements
    if ((event.target as HTMLElement).closest("button, input, a, select"))
      return;

    isDraggingRef.current = true;
    dragStartXRef.current = event.clientX;
    dragStartScrollLeftRef.current = container.scrollLeft;
    container.setPointerCapture(event.pointerId);
    container.style.cursor = "grabbing";
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container || !isDraggingRef.current) return;
    const delta = event.clientX - dragStartXRef.current;
    container.scrollLeft = Math.round(dragStartScrollLeftRef.current - delta);
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    isDraggingRef.current = false;
    container.style.cursor = "grab";
    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!sheet) return;

    const nextEvents = sheet.events.filter((event) => event.id !== eventId);
    const nextAttendance: Sheet["attendance"] = {};

    Object.entries(sheet.attendance).forEach(([memberId, eventMap]) => {
      const { [eventId]: _removed, ...rest } = eventMap;
      nextAttendance[memberId] = rest;
    });

    const updatedSheet = {
      ...sheet,
      events: nextEvents,
      attendance: nextAttendance,
    };
    setSheet(updatedSheet);
    await updateSheet(updatedSheet);
  };

  if (!sheet) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Sheet not found. Return to the sheet list to open a valid sheet.
        </p>
        <Link
          href="/dashboard/event-attendance"
          className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
        >
          ← Back to sheets
        </Link>
      </div>
    );
  }

  const columnIds = getColumnIds(filteredEvents.length + 1);
  const gridTemplateColumns = `72px minmax(240px,1fr) ${filteredEvents
    .map(() => "minmax(160px,1fr)")
    .join(" ")}`;
  const minGridWidth = 72 + 240 + filteredEvents.length * 160;
  const gridStyle = {
    gridTemplateColumns,
    minWidth: `${minGridWidth}px`,
  } as const;

  return (
    <div>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #attendance-print-area,
          #attendance-print-area * {
            visibility: visible;
          }
          #attendance-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
          @page {
            size: landscape;
            margin: 12mm;
          }
        }
      `}</style>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <Link
            href="/dashboard/event-attendance"
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Back to sheets
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {sheet.name}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Event attendance sheet with a Members column and one column per
            event.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2 print:hidden">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-white">
            Add event
          </h2>
          <div className="space-y-3">
            <input
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
              placeholder="Event name"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
            <input
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleAddEvent}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Add event
            </button>
          </div>
        </div>
      </div>

      {fetchError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 print:hidden">
          {fetchError}
        </div>
      ) : null}
      {sheet.roleFilter ? (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400 print:hidden">
          This role ({sheet.roleFilter}) is locked for this sheet and cannot be
          changed.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name"
          className="w-44 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
        />
        <input
          value={eventSearch}
          onChange={(event) => setEventSearch(event.target.value)}
          placeholder="Search event"
          className="w-44 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
        />
        <select
          value={effectiveRole}
          onChange={(event) => {
            if (sheet.roleFilter) return;
            setSelectedRole(event.target.value);
          }}
          disabled={Boolean(sheet.roleFilter)}
          className="w-40 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          Members: {filteredMembers.length}
        </span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          Events: {filteredEvents.length}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          🖨️ Print / Save as PDF
        </button>
      </div>
      <div
        id="attendance-print-area"
        ref={scrollContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
        className="cursor-grab overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm select-none dark:border-neutral-800 dark:bg-neutral-950 print:overflow-visible print:border-0 print:shadow-none"
      >
        <div
          className="grid min-w-full border-b border-neutral-200 bg-neutral-100 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
          style={gridStyle}
        >
          <div className="sticky left-0 z-10 will-change-transform border-r border-b border-neutral-200 bg-neutral-100 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"></div>
          <div className="sticky left-[72px] z-10 will-change-transform border-r border-b border-neutral-200 bg-neutral-100 px-3 py-2 text-left dark:border-neutral-800 dark:bg-neutral-900">
            Members
          </div>
          {filteredEvents.map((event, index) => (
            <button
              type="button"
              key={event.id}
              onClick={() => toggleColumnAttendance(event.id)}
              className="border-r border-neutral-200 px-3 py-2 text-left last:border-r-0 transition hover:bg-neutral-200/70 dark:border-neutral-800 dark:hover:bg-neutral-800"
            >
              {columnIds[index + 1]}
            </button>
          ))}
        </div>

        <div
          className="grid min-w-full border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400"
          style={gridStyle}
        >
          <div className="sticky left-0 z-10 border-r border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"></div>
          <div className="sticky left-[72px] z-10 border-r border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left dark:border-neutral-800 dark:bg-neutral-950">
            Name / Role
          </div>
          {filteredEvents.map((event) => (
            <div
              role="button"
              tabIndex={0}
              key={event.id}
              onClick={() => toggleColumnAttendance(event.id)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                  keyEvent.preventDefault();
                  toggleColumnAttendance(event.id);
                }
              }}
              className="group relative cursor-pointer border-r border-neutral-200 px-3 py-2 text-left last:border-r-0 transition hover:bg-neutral-200/70 dark:border-neutral-800 dark:hover:bg-neutral-800"
            >
              <button
                type="button"
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  handleDeleteEvent(event.id);
                }}
                title={`Delete ${event.name}`}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 opacity-0 transition hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/40 print:hidden"
              >
                ×
              </button>
              <div className="text-sm text-center font-semibold text-neutral-900 dark:text-white">
                {event.name}
              </div>
              <div className="text-xs text-center text-neutral-500 dark:text-neutral-400">
                {event.date}
              </div>
            </div>
          ))}
        </div>

        {filteredMembers.map((member, rowIndex) => (
          <div
            key={member.id}
            className={`grid min-w-full gap-0 border-b border-neutral-200 dark:border-neutral-800 ${
              rowIndex % 2 === 0
                ? "bg-white dark:bg-neutral-950"
                : "bg-neutral-50 dark:bg-neutral-900/30"
            }`}
            style={gridStyle}
          >
            <div className="sticky left-0 z-10 flex items-center justify-center border-r border-b border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
              {rowIndex + 1}
            </div>
            <div className="sticky left-[72px] z-10 border-r border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2">
                {member.avatarUrl ? (
                  <Image
                    src={member.avatarUrl}
                    alt={member.name}
                    width={32}
                    height={32}
                    loading="eager"
                    unoptimized
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : null}
                <div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {member.name}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {member.roles.join(", ")}
                  </div>
                </div>
              </div>
            </div>
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-center border-r border-neutral-200 px-3 py-2 last:border-r-0 dark:border-neutral-800"
              >
                <button
                  type="button"
                  onClick={() => toggleAttendance(member.id, event.id)}
                  className={`h-8 w-8 rounded border transition ${
                    sheet.attendance[member.id]?.[event.id]
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-neutral-300 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  }`}
                >
                  {sheet.attendance[member.id]?.[event.id] ? "✓" : ""}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
