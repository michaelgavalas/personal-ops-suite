import type { Destination } from "./destination";

/** Query parameter naming where to go once authentication succeeds. */
export const REDIRECT_TO = "redirect_to";

type SearchParams = Awaited<PageProps<"/sign-in">["searchParams"]>;

/**
 * Reads the requested destination. A repeated parameter arrives as an array,
 * which is not a destination — dropping it lets resolveDestination fall back
 * rather than picking one of them arbitrarily.
 */
export function readRedirectTo(params: SearchParams) {
  const value = params[REDIRECT_TO];
  return typeof value === "string" ? value : undefined;
}

/**
 * Path to the other screen, carrying the destination across so it survives the
 * trip.
 *
 * Carries the resolved destination rather than the raw parameter, so a value
 * that failed validation is dropped here instead of being handed back to the
 * browser in a link. A fallback destination is left off entirely: the other
 * screen derives the same one on its own.
 */
export function crossLink(path: string, destination: Destination) {
  if (!destination.requested) {
    return path;
  }
  return `${path}?${new URLSearchParams({ [REDIRECT_TO]: destination.url })}`;
}
