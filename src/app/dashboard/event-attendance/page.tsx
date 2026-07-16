"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createSheet,
  initialMembers,
  loadSheets,
  saveSheets,
  Sheet,
  Member,
  getMemberRoleNames,
} from "@/lib/event-schedule";

const emptyName = "";

function countMembersForRole(sheet: Sheet) {
  if (!sheet.roleFilter) return sheet.members.length;

  const normalizedRole = sheet.roleFilter.toLowerCase();
  return sheet.members.filter((member) =>
    getMemberRoleNames(member).some(
      (role) => role.toLowerCase() === normalizedRole,
    ),
  ).length;
}

export default function EventAttendancePage() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [name, setName] = useState(emptyName);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const loadedSheets = await loadSheets();
        if (active) {
          setSheets(loadedSheets);
        }
      } catch (error) {
        console.error(error);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    async function loadDiscordMembers() {
      try {
        const response = await fetch("/api/discord/members");
        if (!response.ok) {
          throw new Error(`Failed to load members: ${response.status}`);
        }
        const data = await response.json();
        setMembers(data.members ?? []);
      } catch (error: unknown) {
        console.error(error);
        setFetchError("Unable to load Discord members. Using local defaults.");
        setMembers(initialMembers);
      }
    }

    void loadDiscordMembers();
  }, []);

  const roleOptions = useMemo(() => {
    const availableRoles = members.flatMap((member) =>
      getMemberRoleNames(member),
    );
    return Array.from(new Set(availableRoles)).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [members]);

  const activeRole = selectedRole || roleOptions[0] || "";

  const handleCreateSheet = async () => {
    const trimmed = name.trim();
    const roleToUse = selectedRole || roleOptions[0] || "";
    if (!trimmed || !roleToUse) return;

    const nextSheets = [...sheets, createSheet(trimmed, members, roleToUse)];

    setSheets(nextSheets);
    try {
      await saveSheets(nextSheets);
    } catch (error) {
      console.error(error);
      setFetchError("Unable to save the sheet right now.");
    }

    setName(emptyName);
    setSelectedRole("");
  };

  const handleDeleteSheet = async (sheetId: string) => {
    const nextSheets = sheets.filter((sheet) => sheet.id !== sheetId);
    setSheets(nextSheets);
    try {
      await saveSheets(nextSheets);
    } catch (error) {
      console.error(error);
      setFetchError("Unable to delete the sheet right now.");
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Event Attendance
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Create a sheet, choose the role to show first, and keep that role
            locked for future edits.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New sheet name"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white sm:w-64"
          />
          <select
            value={activeRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white sm:w-44"
          >
            <option value="">Select a role</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateSheet}
            disabled={!name.trim() || !activeRole}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            Add sheet
          </button>
        </div>
      </div>
      {fetchError ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {fetchError}
        </div>
      ) : null}

      {sheets.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            No sheets yet. Add a new sheet to begin tracking members and
            attendance.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((sheet) => (
            <div
              key={sheet.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <Link
                  href={`/dashboard/event-attendance/${sheet.id}`}
                  className="flex-1"
                >
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    {sheet.name}
                  </h2>
                </Link>
                <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
                  {countMembersForRole(sheet)} members
                </span>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Created {new Date(sheet.createdAt).toLocaleDateString()}
              </p>
              {sheet.roleFilter ? (
                <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">
                  Locked role: {sheet.roleFilter}
                </p>
              ) : null}
              <div className="mt-4 flex items-center justify-between gap-2">
                <Link
                  href={`/dashboard/event-attendance/${sheet.id}`}
                  className="text-sm font-medium text-indigo-600"
                >
                  Open sheet →
                </Link>
                <button
                  type="button"
                  onClick={() => handleDeleteSheet(sheet.id)}
                  className="text-sm font-medium text-red-600 hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Sheets automatically include members and attendance tracking. Add new
          sheets to create separate event logs.
        </p>
      </div>
    </div>
  );
}
