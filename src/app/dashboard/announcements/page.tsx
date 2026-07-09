"use client";

import { useEffect, useRef, useState } from "react";

type Channel = {
  id: string;
  name: string;
  type: number;
};

type Role = {
  id: string;
  name: string;
  color: number;
  position: number;
};

type Member = {
  id: string;
  name: string;
  avatarUrl: string;
  role: string;
  roleColor: number;
};

type MentionOption = {
  value: string;
  label: string;
  type: "special" | "role" | "member";
  color?: string;
  avatarUrl?: string;
};

type CachedAnnouncement = {
  id: string;
  title: string;
  message: string;
  channelId: string;
  channelName: string;
  mention: string;
  sendAt: number;
  createdAt: number;
  images: string[];
};

const GUILD_ID = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID;
const CACHE_KEY = "announcements_recent_cache_v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function roleColorHex(color: number) {
  if (!color) return "#9CA3AF";
  return `#${color.toString(16).padStart(6, "0")}`;
}

// Converts a timestamp into the "YYYY-MM-DDTHH:mm" format expected by
// <input type="datetime-local">, using local time (not UTC).
function toDatetimeLocalValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function loadCache(): CachedAnnouncement[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedAnnouncement[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((a) => now - a.createdAt < CACHE_TTL_MS);
  } catch {
    return [];
  }
}

function saveCache(items: CachedAnnouncement[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / private-mode errors
  }
}

export default function AnnouncementsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [channelId, setChannelId] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);

  const [mention, setMention] = useState("");
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [datetime, setDatetime] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [previous, setPrevious] = useState<CachedAnnouncement[]>([]);

  const channelBoxRef = useRef<HTMLDivElement>(null);
  const mentionBoxRef = useRef<HTMLDivElement>(null);

  async function loadChannels() {
    try {
      const res = await fetch("/api/discord/channels");
      const data = await res.json();
      if (Array.isArray(data)) setChannels(data);
    } catch {
      setError((prev) => prev ?? "Failed to load channels");
    }
  }

  async function loadRoles() {
    try {
      const res = await fetch("/api/discord/roles");
      const data = await res.json();
      if (Array.isArray(data)) setRoles(data);
    } catch {
      setError((prev) => prev ?? "Failed to load roles");
    }
  }

  async function loadMembers() {
    try {
      const res = await fetch("/api/discord/members");
      const data = await res.json();
      if (Array.isArray(data.members)) setMembers(data.members);
    } catch {
      setError((prev) => prev ?? "Failed to load members");
    }
  }

  useEffect(() => {
    loadChannels();
    loadRoles();
    loadMembers();
  }, []);

  // Load cached "previous announcements" on mount, and prune expired
  // entries every minute so they disappear ~1 day after being scheduled
  // without needing a page refresh.
  useEffect(() => {
    setPrevious(loadCache());
    const interval = setInterval(() => {
      setPrevious((prev) => {
        const now = Date.now();
        const fresh = prev.filter((a) => now - a.createdAt < CACHE_TTL_MS);
        if (fresh.length !== prev.length) saveCache(fresh);
        return fresh;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        channelBoxRef.current &&
        !channelBoxRef.current.contains(e.target as Node)
      ) {
        setChannelDropdownOpen(false);
      }
      if (
        mentionBoxRef.current &&
        !mentionBoxRef.current.contains(e.target as Node)
      ) {
        setMentionDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedChannel = channels.find((c) => c.id === channelId);
  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(channelSearch.toLowerCase()),
  );

  const mentionOptions: MentionOption[] = [
    { value: "", label: "No mention", type: "special", color: "#9CA3AF" },
    {
      value: "@everyone",
      label: "@everyone",
      type: "special",
      color: "#9CA3AF",
    },
    { value: "@here", label: "@here", type: "special", color: "#9CA3AF" },
    ...roles
      .filter((r) => r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        value: `<@&${r.id}>`,
        label: `@${r.name}`,
        type: "role" as const,
        color: roleColorHex(r.color),
      })),
    ...members.map((m) => ({
      value: `<@${m.id}>`,
      label: m.name,
      type: "member" as const,
      avatarUrl: m.avatarUrl,
    })),
  ];

  const filteredMentionOptions = mentionOptions.filter((opt) =>
    opt.label.toLowerCase().includes(mentionSearch.toLowerCase()),
  );

  const selectedMention =
    mentionOptions.find((m) => m.value === mention) ?? mentionOptions[0];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    setFiles(selected);
  }

  // Manual typing: "-" + space at start of a line becomes a bullet.
  function handleMessageKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== " ") return;
    const textarea = e.currentTarget;
    const cursor = textarea.selectionStart;
    const textBefore = message.slice(0, cursor);
    const lineStart = textBefore.lastIndexOf("\n") + 1;
    const currentLine = textBefore.slice(lineStart);

    if (currentLine === "-") {
      e.preventDefault();
      const newText =
        message.slice(0, lineStart) + "• " + message.slice(cursor);
      setMessage(newText);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = lineStart + 2;
      });
    }
  }

  // Converts pasted HTML (rich formatting from a rendered Discord message)
  // into Discord markdown so bold/underline/etc. survive the round trip.
  function htmlToDiscordMarkdown(html: string): string {
    const container = document.createElement("div");
    container.innerHTML = html;

    function walk(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || "";
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const el = node as HTMLElement;
      const inner = Array.from(el.childNodes).map(walk).join("");
      const tag = el.tagName.toLowerCase();

      switch (tag) {
        case "strong":
        case "b":
          return `**${inner}**`;
        case "em":
        case "i":
          return `*${inner}*`;
        case "u":
          return `__${inner}__`;
        case "s":
        case "del":
        case "strike":
          return `~~${inner}~~`;
        case "code":
          return `\`${inner}\``;
        case "li":
          return `- ${inner}\n`;
        case "br":
          return "\n";
        case "p":
        case "div":
          return `${inner}\n`;
        default:
          return inner;
      }
    }

    return walk(container)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Paste: prefer HTML clipboard data (preserves bold/underline/etc. via
  // markdown conversion above); fall back to plain text otherwise. Discord's
  // "- item" bullet markdown is converted to "• " per line either way.
  function handleMessagePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    if (!plain && !html) return;

    e.preventDefault();

    const source = html ? htmlToDiscordMarkdown(html) : plain;

    const transformed = source
      .split("\n")
      .map((line) => line.replace(/^(\s*)-\s/, "$1• "))
      .join("\n");

    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = message.slice(0, start) + transformed + message.slice(end);
    setMessage(newValue);

    requestAnimationFrame(() => {
      const cursorPos = start + transformed.length;
      textarea.selectionStart = textarea.selectionEnd = cursorPos;
    });
  }

  async function uploadFiles(): Promise<{ urls: string[]; paths: string[] }> {
    if (files.length === 0) return { urls: [], paths: [] };

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/discord/announcements/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return { urls: data.urls, paths: data.paths };
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const sendAt = new Date(datetime).getTime();
    if (!channelId || !title || !sendAt || sendAt <= Date.now()) {
      setError(
        "Please select a channel, add a title, and pick a future date/time.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const { urls: imageUrls, paths: imagePaths } = await uploadFiles();

      const res = await fetch("/api/discord/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId: GUILD_ID,
          channelId,
          title,
          message,
          mention: mention || null,
          sendAt,
          images: imageUrls,
          imagePaths,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to schedule announcement");
      }

      // Add to the local "previous announcements" cache. This is purely
      // client-side (localStorage) and self-prunes after 24h — nothing is
      // written to the database for this.
      const entry: CachedAnnouncement = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        message,
        channelId,
        channelName: selectedChannel?.name ?? "unknown",
        mention: mention || "",
        sendAt,
        createdAt: Date.now(),
        images: imageUrls,
      };
      setPrevious((prev) => {
        const next = [entry, ...prev];
        saveCache(next);
        return next;
      });

      setTitle("");
      setMessage("");
      setMention("");
      setMentionSearch("");
      setDatetime("");
      setFiles([]);
      setChannelId("");
      setChannelSearch("");
      setToast("✅ Announcement scheduled!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // "Use" button on a previously scheduled announcement: refills the form
  // with its exact title, message, mention, and channel. The original
  // date/time is prefilled too, but since it's likely in the past by the
  // time this is reused, the person should double check it before sending.
  // Images can't be restored (only their uploaded URLs are cached, not the
  // original File objects), so the file input is left empty.
  function handleUsePrevious(a: CachedAnnouncement) {
    setChannelId(a.channelId);
    setChannelSearch("");
    setTitle(a.title);
    setMessage(a.message);
    setMention(a.mention);
    setMentionSearch("");
    setDatetime(toDatetimeLocalValue(a.sendAt));
    setFiles([]);
    setError(null);
    setToast("📋 Loaded — update the date/time before sending");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="relative mx-auto max-w-6xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
        Announcements
      </h1>

      {toast && (
        <div className="fixed top-6 right-6 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/50 dark:shadow-none"
        >
          {/* Channel searchable combobox */}
          <div ref={channelBoxRef} className="relative">
            <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
              Channel
            </label>
            <button
              type="button"
              onClick={() => setChannelDropdownOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-neutral-900 transition-colors hover:border-indigo-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:border-neutral-600"
            >
              <span
                className={
                  selectedChannel
                    ? "text-neutral-900 dark:text-white"
                    : "text-neutral-500"
                }
              >
                {selectedChannel
                  ? `#${selectedChannel.name}`
                  : "Select a channel..."}
              </span>
              <span className="text-neutral-500 text-xs">▾</span>
            </button>

            {channelDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                <input
                  autoFocus
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Search channels..."
                  className="w-full border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500"
                />
                <div className="max-h-56 overflow-y-auto">
                  {filteredChannels.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-neutral-500">
                      No channels found.
                    </p>
                  ) : (
                    filteredChannels.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setChannelId(c.id);
                          setChannelDropdownOpen(false);
                          setChannelSearch("");
                        }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                          c.id === channelId
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-600/20 dark:text-indigo-300"
                            : "text-neutral-700 dark:text-neutral-200"
                        }`}
                      >
                        #{c.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
              Title
            </label>
            <input
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Raid Announcement"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
              Message
            </label>
            <textarea
              className="min-h-28 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleMessageKeyDown}
              onPaste={handleMessagePaste}
              placeholder={
                'Type your message...\nUse "- " to start a bullet list'
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Mention searchable combobox: special / roles / members */}
            <div ref={mentionBoxRef} className="relative">
              <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
                Mention
              </label>
              <button
                type="button"
                onClick={() => setMentionDropdownOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-neutral-900 transition-colors hover:border-indigo-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:border-neutral-600"
              >
                {selectedMention.type === "member" ? (
                  <img
                    src={selectedMention.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full shrink-0"
                  />
                ) : (
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedMention.color }}
                  />
                )}
                <span className="truncate">{selectedMention.label}</span>
              </button>

              {mentionDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                  <input
                    autoFocus
                    value={mentionSearch}
                    onChange={(e) => setMentionSearch(e.target.value)}
                    placeholder="Search roles or members..."
                    className="w-full border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500"
                  />
                  <div className="max-h-64 overflow-y-auto">
                    {filteredMentionOptions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-neutral-500">
                        No matches found.
                      </p>
                    ) : (
                      filteredMentionOptions.map((opt) => (
                        <button
                          type="button"
                          key={opt.value || "none"}
                          onClick={() => {
                            setMention(opt.value);
                            setMentionDropdownOpen(false);
                            setMentionSearch("");
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                            opt.value === mention
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-600/20 dark:text-indigo-300"
                              : "text-neutral-700 dark:text-neutral-200"
                          }`}
                        >
                          {opt.type === "member" ? (
                            <img
                              src={opt.avatarUrl}
                              alt=""
                              className="h-5 w-5 rounded-full shrink-0"
                            />
                          ) : (
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: opt.color }}
                            />
                          )}
                          <span className="truncate">{opt.label}</span>
                          {opt.type === "member" && (
                            <span className="ml-auto text-xs text-neutral-500 shrink-0">
                              member
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
                Announced at
              </label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none transition-colors focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">
              Images
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              onChange={handleFileChange}
              className="w-full text-sm text-neutral-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-neutral-700 hover:file:bg-neutral-200 dark:text-neutral-300 dark:file:bg-neutral-800 dark:file:text-neutral-200 dark:hover:file:bg-neutral-700"
            />
            {files.length > 0 && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {files.length} file(s) selected
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || uploading}
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {uploading
              ? "Uploading images..."
              : submitting
                ? "Scheduling..."
                : "Schedule Announcement"}
          </button>
        </form>

        {/* Previous announcements — cached client-side, auto-expires after 1 day.
            The panel itself is height-capped and sticky so the list scrolls
            internally instead of pushing the page height around. */}
        <div className="flex max-h-[calc(100vh-3rem)] flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/50 dark:shadow-none lg:sticky lg:top-6">
          <h2 className="mb-3 shrink-0 text-sm font-semibold text-neutral-900 dark:text-white">
            Previously scheduled
          </h2>
          {previous.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Nothing scheduled recently.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {previous.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                      {a.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleUsePrevious(a)}
                      className="shrink-0 rounded-md border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                    >
                      Use
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    #{a.channelName} • {new Date(a.sendAt).toLocaleString()}
                  </p>
                  {a.message && (
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">
                      {a.message}
                    </p>
                  )}
                  {a.images.length > 0 && (
                    <div className="mt-2 flex gap-1.5 overflow-x-auto">
                      {a.images.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`attachment ${i + 1}`}
                          className="h-12 w-12 shrink-0 rounded object-cover border border-neutral-200 dark:border-neutral-700"
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}