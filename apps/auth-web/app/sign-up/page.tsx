import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthScreen } from "@/components/auth-screen";
import { resolveDestination } from "@/lib/destination";
import { crossLink, readRedirectTo } from "@/lib/search-params";
import { isSignedIn } from "@/lib/session";

export const metadata = { title: "Create account" };

export default async function SignUp({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  const requested = readRedirectTo(params);
  const destination = resolveDestination(requested);

  // Already signed in, so there is nothing to create. Sending them on beats
  // letting them make a second account by accident.
  if (await isSignedIn(await headers())) {
    redirect(destination.url);
  }

  return (
    <AuthScreen
      title="Create account"
      destination={destination}
      alternate={{
        prompt: "Already have an account?",
        action: "Sign in",
        href: crossLink("/sign-in", destination),
      }}
    >
      <AuthForm mode="sign-up" destinationUrl={destination.url} />
    </AuthScreen>
  );
}
