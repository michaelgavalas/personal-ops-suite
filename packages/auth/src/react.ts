import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client.
 *
 * Deliberately unconfigured: the default base URL is the page's own origin and
 * the default base path is /api/auth, which is exactly the proxy route that
 * forwards to the API. The frontend never addresses the API directly.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
