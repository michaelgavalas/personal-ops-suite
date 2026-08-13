import { redirect } from "next/navigation";

// Nothing lives at the root: the app is the two screens. Signing in is the
// common arrival, so it is what an unqualified visit resolves to.
export default function Index() {
  redirect("/sign-in");
}
