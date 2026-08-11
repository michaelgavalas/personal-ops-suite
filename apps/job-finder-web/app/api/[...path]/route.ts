// Server-side proxy to the api app, shared by every frontend — see
// @repo/api-client/proxy for how it works and why the path passes through
// untouched.
//
// This is a route handler rather than a `rewrites()` entry because Next
// serializes next.config into required-server-files.json at build time, which
// would bake the API location into the image instead of reading it at boot.

import { apiProxy } from "@repo/api-client/proxy";

// Has to be declared here as a literal: Next reads route segment config off
// the route module itself, so a re-export from the package would not be seen.
export const dynamic = "force-dynamic";

export {
  apiProxy as GET,
  apiProxy as POST,
  apiProxy as PUT,
  apiProxy as PATCH,
  apiProxy as DELETE,
};
