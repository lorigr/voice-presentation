import type { Slide, StreamingSlide } from "./types";

/**
 * Extract all COMPLETE slide objects from a partial JSON buffer.
 */
export function parseCompleteSlides(raw: string): Slide[] {
  const arrayStart = raw.indexOf("[");
  if (arrayStart === -1) return [];

  const slides: Slide[] = [];
  let depth = 0;
  let objectStart = -1;

  for (let i = arrayStart; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        try {
          const obj = JSON.parse(raw.slice(objectStart, i + 1));
          if (obj.title && Array.isArray(obj.bullets))
            slides.push(obj as Slide);
        } catch {
          /* malformed — skip */
        }
        objectStart = -1;
      }
    }
  }
  return slides;
}

/**
 * Parse the LAST (incomplete) slide object being streamed right now.
 */
export function parseStreamingSlide(raw: string): StreamingSlide | null {
  const arrayStart = raw.indexOf("[");
  if (arrayStart === -1) return null;

  let depth = 0;
  let lastOpenAt = -1;
  for (let i = arrayStart; i < raw.length; i++) {
    if (raw[i] === "{") {
      if (depth === 0) lastOpenAt = i;
      depth++;
    } else if (raw[i] === "}") {
      depth--;
      if (depth === 0) lastOpenAt = -1;
    }
  }
  if (lastOpenAt === -1) return null;

  const fragment = raw.slice(lastOpenAt);

  const titleMatch = fragment.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const title = titleMatch ? titleMatch[1] : "";

  const bulletsStart = fragment.indexOf('"bullets"');
  if (bulletsStart === -1)
    return title ? { title, bullets: [], streamingBullet: null } : null;

  const arrayOpen = fragment.indexOf("[", bulletsStart);
  if (arrayOpen === -1) return { title, bullets: [], streamingBullet: null };

  const bulletsFragment = fragment.slice(arrayOpen + 1);

  const completedBullets: string[] = [];
  let streamingBullet: string | null = null;
  let pos = 0;

  while (pos < bulletsFragment.length) {
    while (pos < bulletsFragment.length && /[\s,]/.test(bulletsFragment[pos]))
      pos++;
    if (pos >= bulletsFragment.length) break;
    if (bulletsFragment[pos] === "]") break;

    if (bulletsFragment[pos] === '"') {
      let str = "";
      pos++;
      let closed = false;
      while (pos < bulletsFragment.length) {
        const c = bulletsFragment[pos];
        if (c === "\\") {
          str += bulletsFragment[++pos] ?? "";
          pos++;
          continue;
        }
        if (c === '"') {
          closed = true;
          pos++;
          break;
        }
        str += c;
        pos++;
      }
      if (closed) {
        completedBullets.push(str);
      } else {
        streamingBullet = str;
        break;
      }
    } else {
      pos++;
    }
  }

  return { title, bullets: completedBullets, streamingBullet };
}
