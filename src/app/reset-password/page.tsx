"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/Client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [ready, setReady] = useState(false);

 useEffect(() => {
  let active = true;

  async function handleSessionFromUrl() {
    const urlSearch = new URLSearchParams(window.location.search);
    const hashSearch = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = urlSearch.get("code");

    try {
      if (urlSearch.has("access_token") && urlSearch.has("refresh_token")) {
        const { data, error } = await supabase.auth.setSession({
          access_token: urlSearch.get("access_token")!,
          refresh_token: urlSearch.get("refresh_token")!,
        });
        if (error) setError(error.message);
        else if (data.session) setCanReset(true);
      } else if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) setError(error.message);
        else if (data.session) setCanReset(true);
      } else if (hashSearch.has("access_token") && hashSearch.has("refresh_token")) {
        const { data, error } = await supabase.auth.setSession({
          access_token: hashSearch.get("access_token")!,
          refresh_token: hashSearch.get("refresh_token")!,
        });
        if (error) setError(error.message);
        else if (data.session) setCanReset(true);
      } else {
      
        const { data } = await supabase.auth.getSession();
        if (data.session) setCanReset(true);
      }
    } catch (err) {
      setError((err as Error)?.message ?? "Unable to load reset session.");
    } finally {
      if (active) setReady(true);
    }
  }

  // Supabase fires this once it parses a recovery link from the URL hash
  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      setCanReset(true);
      setReady(true);
    }
  });

  void handleSessionFromUrl();

  return () => {
    active = false;
    listener.subscription.unsubscribe();
  };
}, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!password) {
      setError("Please enter a new password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Your password has been updated. You can now sign in with your new password.");

    setTimeout(() => {
      router.push("/login");
    }, 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Reset password
        </h1>

        {!ready ? (
          <p className="text-sm text-gray-600">Preparing reset form...</p>
        ) : !canReset ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              To reset your password, open the password reset link sent to your email.
            </p>
            <p className="text-sm text-gray-600">
              If you are already on the reset page, make sure the email link was opened from your inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                New password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-black"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-black"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Updating password..." : "Update password"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-gray-600">
          Remembered your password?{" "}
          <a href="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
