"use client";

import { signOut, useSession } from "@repo/auth/react";
import { Button } from "@repo/ui/components/button";
import { useState } from "react";

export function SessionPanel() {
  const { data: session, isPending } = useSession();
  const [busy, setBusy] = useState(false);

  // proxy.ts only checks that a session cookie exists, so this can still
  // resolve to nothing — a stale or revoked cookie gets past the gate.
  if (isPending || !session) {
    return null;
  }

  async function leave() {
    setBusy(true);
    await signOut();
    // Full navigation rather than the router: the cookie is gone, so this
    // needs to reach proxy.ts and be sent on to the auth app.
    window.location.assign("/");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Signed in as{" "}
        <span className="font-mono text-foreground">{session.user.email}</span>
      </p>
      <Button
        variant="outline"
        className="w-fit"
        disabled={busy}
        onClick={leave}
      >
        Sign out
      </Button>
    </div>
  );
}
