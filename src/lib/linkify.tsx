import { Fragment, type ReactNode } from "react";

// Match http(s):// and bare www. URLs; the character class trails until
// whitespace or a tag boundary. Trailing punctuation is trimmed below so
// "see https://foo.com." doesn't pull the period into the link.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCT_RE = /[.,;:!?)\]>}'"]+$/;

/**
 * Render text with bare URLs turned into clickable links. Safe by
 * construction: React escapes text nodes, only http(s) / www. matches
 * become anchors, and links open in a new tab with `noopener noreferrer`.
 */
export function linkify(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const full = match[0];

    const trailMatch = full.match(TRAILING_PUNCT_RE);
    const trail = trailMatch?.[0] ?? "";
    const url = trail ? full.slice(0, -trail.length) : full;
    const href = url.startsWith("www.") ? `https://${url}` : url;

    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <a
        key={start}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
      >
        {url}
      </a>,
    );
    if (trail) parts.push(trail);
    cursor = start + full.length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  if (parts.length === 0) return text;
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </>
  );
}
