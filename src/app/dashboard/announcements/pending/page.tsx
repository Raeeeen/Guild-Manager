// src/app/dashboard/announcements/pending/page.tsx
"use client";

import { useEffect, useState } from "react";

type Announcement = {
  id: string;
  channelId: string;
  title: string;
  message: string;
  images: string[];
  sendAt: number;
};

type Channel = { id: string; name: string };

const GUILD_ID = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID;

export default function PendingAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [aRes, cRes] = await Promise.all([
        fetch(`/api/discord/announcements?guildId=${GUILD_ID}`),
        fetch("/api/discord/channels"),
      ]);
      const [aData, cData] = await Promise.all([aRes.json(), cRes.json()]);
      setItems(
        Array.isArray(aData) ? aData.filter((a) => a.sendAt > Date.now()) : [],
      );
      if (Array.isArray(cData)) setChannels(cData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function handleCancel(id: string) {
    if (!confirm("Cancel this announcement?")) return;
    const res = await fetch(`/api/discord/announcements/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to cancel announcement");
      return;
    }
    await load();
  }
  
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Pending Announcements</h1>

      {loading ? (
        <p className="text-neutral-400 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-neutral-400 text-sm">No pending announcements.</p>
      ) : (
        <ul className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          {items.map((a) => {
            const channel = channels.find((c) => c.id === a.channelId);
            return (
              <li
                key={a.id}
                className="rounded border border-neutral-800 px-4 py-3 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-neutral-400">
                      #{channel?.name ?? a.channelId} •{" "}
                      {new Date(a.sendAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancel(a.id)}
                    className="shrink-0 text-red-400 hover:text-red-300 text-sm"
                  >
                    Cancel
                  </button>
                </div>

                {a.message && (
                  <p className="whitespace-pre-wrap break-words text-sm text-neutral-200">
                    {a.message}
                  </p>
                )}

                {a.images && a.images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {a.images.map((url, i) => {
                      const AnchorTag = "a";
                      return (
                        <AnchorTag
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <img
                            src={url}
                            alt={`attachment ${i + 1}`}
                            className="h-24 w-24 rounded object-cover border border-neutral-700"
                          />
                        </AnchorTag>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
