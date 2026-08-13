/** Query parameter naming where to return to once authentication succeeds. */
export const REDIRECT_TO = "redirect_to";

/**
 * Reads a required public origin from the environment.
 *
 * Read at call time rather than module scope, matching @repo/api-client: Next
 * evaluates modules during the build, where neither variable is set yet — and
 * baking a public URL into the image is exactly what this repo avoids
 * elsewhere.
 */
export function requireOrigin(name: "AUTH_URL" | "APP_URL") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name} to an absolute origin`);
  }
  return value;
}
