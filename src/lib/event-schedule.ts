export type Member = {
  id: string;
  name: string;
  role: string;
  roles: string[];
  avatarUrl?: string;
};

export type EventRow = {
  id: string;
  name: string;
  date: string;
};

export type Sheet = {
  id: string;
  name: string;
  createdAt: string;
  members: Member[];
  events: EventRow[];
  attendance: Record<string, Record<string, boolean>>;
  roleFilter?: string | null;
};

const STORAGE_KEY = "guild-manager:event-schedule:sheets";

export const initialMembers: Member[] = [
  { id: "1", name: "Aiden Storm", role: "Tank", roles: ["Tank"] },
  { id: "2", name: "Kira Night", role: "Dps", roles: ["Dps"] },
  { id: "3", name: "Luna Frost", role: "Support", roles: ["Support"] },
  { id: "4", name: "Riven Blaze", role: "Hybrid", roles: ["Hybrid"] },
  { id: "5", name: "Talon Swift", role: "Dps", roles: ["Dps"] },
];

const legacyMemberNames = new Set(initialMembers.map((member) => member.name));
const legacyMemberIds = new Set(initialMembers.map((member) => member.id));

function normalizeRoleValue(role: unknown): string | null {
  if (typeof role === "string") {
    return role;
  }

  if (role && typeof role === "object" && "name" in role && typeof (role as { name?: unknown }).name === "string") {
    return (role as { name: string }).name;
  }

  return null;
}

export function normalizeMember(member: Partial<Member> & { id: string; name: string }): Member {
  const roleValues = Array.isArray(member.roles) ? member.roles : [];
  const normalizedRoles = roleValues
    .map((role) => normalizeRoleValue(role))
    .filter((role): role is string => Boolean(role));

  const fallbackRole = normalizeRoleValue(member.role) ?? normalizedRoles[0] ?? "Member";

  return {
    id: member.id,
    name: member.name,
    role: fallbackRole,
    roles: normalizedRoles.length > 0 ? normalizedRoles : [fallbackRole],
    avatarUrl: typeof member.avatarUrl === "string" ? member.avatarUrl : undefined,
  };
}

export function isLegacyPlaceholderMembers(members: Member[]) {
  return (
    members.length > 0 &&
    members.every(
      (member) =>
        legacyMemberNames.has(member.name) ||
        legacyMemberIds.has(member.id) ||
        (member.roles.length === 1 && legacyMemberNames.has(member.role)),
    )
  );
}

export async function loadSheets(): Promise<Sheet[]> {
  if (typeof window === "undefined") return [];

  try {
    const response = await fetch("/api/event-attendance");
    if (response.ok) {
      const payload = await response.json();
      const sheets = Array.isArray(payload?.sheets) ? (payload.sheets as Sheet[]) : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets));
      return sheets;
    }
  } catch {
    // Fall back to the last locally cached sheets when the API is unavailable.
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    return JSON.parse(saved) as Sheet[];
  } catch {
    return [];
  }
}

export async function saveSheets(sheets: Sheet[]): Promise<Sheet[]> {
  if (typeof window === "undefined") return sheets;

  try {
    await fetch("/api/event-attendance", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sheets }),
    });
  } catch {
    // Keep the browser cache in sync even if the API call fails.
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets));
  return sheets;
}

export async function getSheetById(sheetId: string): Promise<Sheet | undefined> {
  const sheets = await loadSheets();
  return sheets.find((sheet) => sheet.id === sheetId);
}

export async function updateSheet(updatedSheet: Sheet): Promise<Sheet[]> {
  const sheets = await loadSheets();
  const nextSheets = sheets.filter((sheet) => sheet.id !== updatedSheet.id);
  const merged = [...nextSheets, updatedSheet];
  await saveSheets(merged);
  return merged;
}

export function getMemberRoleNames(member: Partial<Member> & { role?: unknown; roles?: unknown }): string[] {
  const roles = Array.isArray(member.roles) ? member.roles : [];

  const extracted = roles
    .map((role) => normalizeRoleValue(role))
    .filter((role): role is string => Boolean(role));

  if (extracted.length > 0) return extracted;

  const fallback = normalizeRoleValue(member.role);
  return fallback ? [fallback] : [];
}

export function createSheet(name: string, members: Member[] = initialMembers, roleFilter?: string | null): Sheet {
  const sourceMembers = members.length > 0 ? members : [...initialMembers];

  const scopedMembers = roleFilter
    ? sourceMembers.filter((member) =>
        getMemberRoleNames(member).some(
          (role) => role.toLowerCase() === roleFilter.toLowerCase(),
        ),
      )
    : sourceMembers;

  return {
    id: `sheet-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    members: scopedMembers.map(normalizeMember),
    events: [],
    attendance: {},
    roleFilter: roleFilter ?? null,
  };
}
