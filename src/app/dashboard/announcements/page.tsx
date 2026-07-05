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

const GUILD_ID = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID;

function roleColorHex(color: number) {
  if (!color) return "#9CA3AF";
  return `#${color.toString(16).padStart(6, "0")}`;
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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8 relative">
      <h1 className="text-2xl font-semibold">Announcements</h1>

      {toast && (
        <div className="fixed top-6 right-6 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-neutral-800 bg-neutral-950/50 p-5"
      >
        {/* Channel searchable combobox */}
        <div ref={channelBoxRef} className="relative">
          <label className="block text-sm mb-1 text-neutral-300">Channel</label>
          <button
            type="button"
            onClick={() => setChannelDropdownOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-left hover:border-neutral-600 transition-colors"
          >
            <span
              className={selectedChannel ? "text-white" : "text-neutral-500"}
            >
              {selectedChannel
                ? `#${selectedChannel.name}`
                : "Select a channel..."}
            </span>
            <span className="text-neutral-500 text-xs">▾</span>
          </button>

          {channelDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl overflow-hidden">
              <input
                autoFocus
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                placeholder="Search channels..."
                className="w-full px-3 py-2 bg-neutral-800 border-b border-neutral-700 text-sm outline-none"
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
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-800 transition-colors ${
                        c.id === channelId
                          ? "bg-indigo-600/20 text-indigo-300"
                          : "text-neutral-200"
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
          <label className="block text-sm mb-1 text-neutral-300">Title</label>
          <input
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Raid Announcement"
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-neutral-300">Message</label>
          <textarea
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 min-h-28 outline-none focus:border-indigo-500 transition-colors"
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
            <label className="block text-sm mb-1 text-neutral-300">
              Mention
            </label>
            <button
              type="button"
              onClick={() => setMentionDropdownOpen((v) => !v)}
              className="w-full flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-left hover:border-neutral-600 transition-colors"
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
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl overflow-hidden">
                <input
                  autoFocus
                  value={mentionSearch}
                  onChange={(e) => setMentionSearch(e.target.value)}
                  placeholder="Search roles or members..."
                  className="w-full px-3 py-2 bg-neutral-800 border-b border-neutral-700 text-sm outline-none"
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
                        className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-neutral-800 transition-colors ${
                          opt.value === mention
                            ? "bg-indigo-600/20 text-indigo-300"
                            : "text-neutral-200"
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
            <label className="block text-sm mb-1 text-neutral-300">
              Announced at
            </label>
            <input
              type="datetime-local"
              style={{ colorScheme: "dark" }}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1 text-neutral-300">Images</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            onChange={handleFileChange}
            className="w-full text-sm text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-2 file:text-neutral-200 file:cursor-pointer"
          />
          {files.length > 0 && (
            <p className="text-xs text-neutral-400 mt-1">
              {files.length} file(s) selected
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || uploading}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 font-medium transition-colors"
        >
          {uploading
            ? "Uploading images..."
            : submitting
              ? "Scheduling..."
              : "Schedule Announcement"}
        </button>
      </form>
    </div>
  );
}
