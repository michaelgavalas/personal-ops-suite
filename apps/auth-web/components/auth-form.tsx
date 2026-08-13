"use client";

import { signIn, signUp } from "@repo/auth/react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { type FormEvent, useId, useState } from "react";

type Props = {
  mode: "sign-in" | "sign-up";
  /** Already validated on the server — never the raw query parameter. */
  destinationUrl: string;
};

export function AuthForm({ mode, destinationUrl }: Props) {
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignIn = mode === "sign-in";
  const action = isSignIn ? "Sign in" : "Create account";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const result = isSignIn
      ? await signIn.email({ email, password })
      : await signUp.email({
          email,
          password,
          name: String(form.get("name")),
        });

    if (result.error) {
      setBusy(false);
      setError(result.error.message ?? "Check your details and try again.");
      return;
    }

    // A full navigation rather than the router: the destination is a sibling
    // subdomain, which Next cannot route to. Busy stays set so the button does
    // not flick back to idle during the hand-off.
    window.location.href = destinationUrl;
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        {!isSignIn && (
          <Field>
            <FieldLabel htmlFor={nameId}>Name</FieldLabel>
            <Input
              id={nameId}
              name="name"
              type="text"
              autoComplete="name"
              required
            />
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor={emailId}>Email</FieldLabel>
          <Input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
          <Input
            id={passwordId}
            name="password"
            type="password"
            // Tells password managers which of the two this is, so they offer
            // to save on sign-up instead of trying to fill.
            autoComplete={isSignIn ? "current-password" : "new-password"}
            required
          />
        </Field>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>
              {isSignIn
                ? "Couldn't sign you in"
                : "Couldn't create your account"}
            </AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={busy}>
          {busy && <Spinner />}
          {action}
        </Button>
      </FieldGroup>
    </form>
  );
}
