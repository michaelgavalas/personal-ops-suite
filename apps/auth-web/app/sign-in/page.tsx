import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthScreen } from "@/components/auth-screen";
import { resolveDestination } from "@/lib/destination";
import { crossLink, readRedirectTo } from "@/lib/search-params";
import { isSignedIn } from "@/lib/session";

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const requested = readRedirectTo(params);
  const destination = resolveDestination(requested);

  // Someone already signed in has no business being handed a sign-in form —
  // most often they got here with the back button, or from a bookmark.
  if (await isSignedIn(await headers())) {
    redirect(destination.url);
  }

  return (
    <AuthScreen
      title="Sign in"
      destination={destination}
      alternate={{
        prompt: "No account yet?",
        action: "Create one",
        href: crossLink("/sign-up", destination),
      }}
    >
      <AuthForm mode="sign-in" destinationUrl={destination.url} />
    </AuthScreen>
  );
}
