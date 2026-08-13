import { Separator } from "@repo/ui/components/separator";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Destination } from "@/lib/destination";

type Props = {
  title: string;
  destination: Destination;
  children: ReactNode;
  /** The other screen, so people can cross over without losing where they were headed. */
  alternate: { prompt: string; action: string; href: string };
};

/**
 * Shared frame for both screens.
 *
 * The suite is a set of apps on sibling subdomains, and this is the one door
 * into all of them — so the screen leads with which app you are on your way to
 * rather than with a logo. The host is set in the mono face used nowhere else
 * here, which keeps it legible as a machine address and lets someone check it
 * before they type a password.
 */
export function AuthScreen({ title, destination, children, alternate }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Personal ops
        </p>
        <h1 className="text-4xl font-medium tracking-tighter">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Continuing to{" "}
          <span className="font-mono text-foreground">{destination.label}</span>
        </p>
      </header>

      <Separator />

      {children}

      <Separator />

      <p className="text-sm text-muted-foreground">
        {alternate.prompt}{" "}
        <Link
          href={alternate.href}
          className="text-foreground underline underline-offset-4 hover:text-muted-foreground"
        >
          {alternate.action}
        </Link>
      </p>
    </main>
  );
}
