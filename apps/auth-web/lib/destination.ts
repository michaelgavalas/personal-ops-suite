/**
 * Where someone lands once they are through the door.
 *
 * The destination arrives as a query parameter, so it is attacker-controlled.
 * Anything not on the allow-list is dropped rather than repaired: silently
 * redirecting somewhere unvetted would lend this domain's credibility — and
 * whatever the visitor just typed into it — to a page we do not own.
 */
export type Destination = {
  /** Absolute URL to send the browser to. */
  url: string;
  /** Host shown on the screen, so the visitor can see where they're going. */
  label: string;
  /**
   * Whether the request asked for this, rather than falling back. Lets the
   * screens carry a vetted destination between them without ever putting the
   * raw parameter back into the page.
   */
  requested: boolean;
};

function allowedOrigins() {
  return (process.env.ALLOWED_REDIRECT_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Parses to an absolute URL, or null when the value is unusable. */
function parse(value: string | undefined) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Resolves the post-authentication destination, falling back to the default
 * app whenever the request does not name one this deployment trusts.
 *
 * Read at call time rather than module scope, matching @repo/api-client: Next
 * evaluates modules during the build, where none of these are set yet.
 */
export function resolveDestination(requested?: string): Destination {
  const fallback = parse(process.env.DEFAULT_REDIRECT_URL);
  if (!fallback) {
    throw new Error(
      "Set DEFAULT_REDIRECT_URL to the app people land on after signing in",
    );
  }

  const target = parse(requested);
  // Compared by origin, not by prefix: a startsWith check on the URL treats
  // https://jobs.example.com.attacker.test as a match.
  const trusted = target && allowedOrigins().includes(target.origin);

  const url = trusted ? (target as URL) : fallback;
  return { url: url.toString(), label: url.host, requested: Boolean(trusted) };
}
