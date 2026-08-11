"use client";

import { signIn, signOut, signUp, useSession } from "@repo/auth/react";
import { type FormEvent, useState } from "react";

type Mode = "sign-in" | "sign-up";

const FIELD_STYLES =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function AuthPanel() {
  const { data: session, isPending } = useSession();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The first render happens before the session request resolves. Showing the
  // form here would flash it at people who are already signed in.
  if (isPending) {
    return <p className="text-sm text-zinc-500">Checking your session…</p>;
  }

  if (session) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          Signed in as <span className="font-medium">{session.user.email}</span>
          .
        </p>
        <button
          type="button"
          className="w-fit rounded-md border border-black/15 px-4 py-2 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          onClick={() => signOut()}
        >
          Sign out
        </button>
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const result =
      mode === "sign-in"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name });

    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong. Try again.");
      return;
    }
    setPassword("");
  }

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
      {mode === "sign-up" && (
        <input
          className={FIELD_STYLES}
          type="text"
          name="name"
          placeholder="Name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      )}

      <input
        className={FIELD_STYLES}
        type="email"
        name="email"
        placeholder="Email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <input
        className={FIELD_STYLES}
        type="password"
        name="password"
        placeholder="Password"
        // Tells password managers which of the two this is, so they offer to
        // save on sign-up instead of trying to fill.
        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200"
        onClick={() => switchTo(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in"
          ? "No account yet? Create one"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
