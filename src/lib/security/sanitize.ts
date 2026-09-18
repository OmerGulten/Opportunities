/**
 * Text sanitisation for content that came from somewhere we do not control:
 * fetched HTML, provider payloads, user input.
 *
 * `sanitizeForPrompt` is the boundary for AI calls — fetched page text is data,
 * never instructions, and the prompt builders keep it inside a clearly delimited
 * block. `escapeHtml` is the boundary for anything rendered outside React.
 */

/** Blocks whose text content is markup or code, never page copy. */
const NON_TEXT_BLOCKS = /<(script|style|noscript|template|svg|math|iframe|object|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
/** An unterminated `<script>` / `<style>` swallows the rest of the document, as a browser would. */
const UNCLOSED_NON_TEXT = /<(?:script|style)\b(?![^>]*\/>)[\s\S]*$/i;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const DOCTYPE_OR_PI = /<[!?][^>]*>/g;
/** Tags that imply a line/word break when the markup is removed. */
const BLOCK_TAG =
  /<\/?(?:p|div|br|hr|li|ul|ol|dl|dt|dd|tr|td|th|table|thead|tbody|tfoot|h[1-6]|section|article|header|footer|main|nav|aside|blockquote|pre|form|fieldset|legend|figure|figcaption|address|option|label|title)\b[^>]*>/gi;
const ANY_TAG = /<\/?[a-zA-Z][^>]*>/g;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  shy: "",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  euro: "€",
  pound: "£",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
};

/** Decode the HTML entities that appear in real page copy, plus numeric references. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]{1,31});/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? safeFromCodePoint(code, match) : match;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? safeFromCodePoint(code, match) : match;
    }
    const named = NAMED_ENTITIES[lower];
    return named === undefined ? match : named;
  });
}

function safeFromCodePoint(code: number, fallback: string): string {
  // Surrogate halves are not valid on their own.
  if (code >= 0xd800 && code <= 0xdfff) return fallback;
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

/**
 * Remove C0/C1 control characters plus the zero-width, bidi and line/paragraph
 * separator characters that are used to hide or reorder text. Tab, newline and
 * carriage return survive; `collapseWhitespace` deals with those.
 */
export function stripControlCharacters(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      out += char;
      continue;
    }
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) continue; // C0 / C1
    if (code >= 0x200b && code <= 0x200f) continue; // zero-width + bidi marks
    if (code === 0x2028 || code === 0x2029) continue; // line / paragraph separators
    if (code >= 0x202a && code <= 0x202e) continue; // bidi overrides
    if (code === 0x2060 || code === 0xfeff) continue; // word joiner, BOM
    out += char;
  }
  return out;
}

/**
 * Plain text from an HTML document: script/style/SVG blocks and comments are
 * dropped, block-level tags become spaces, entities are decoded and whitespace
 * is collapsed. Structural extraction (titles, headings, links) uses cheerio in
 * the audit module; this is for text-only checks and prompt input.
 */
export function stripHtml(html: string): string {
  const withoutBlocks = html
    .replace(HTML_COMMENT, " ")
    .replace(NON_TEXT_BLOCKS, " ")
    .replace(UNCLOSED_NON_TEXT, " ")
    .replace(DOCTYPE_OR_PI, " ");
  const withoutTags = withoutBlocks.replace(BLOCK_TAG, " ").replace(ANY_TAG, "");
  return collapseWhitespace(decodeHtmlEntities(withoutTags));
}

/**
 * Collapse every run of whitespace to a single space and trim. JavaScript's
 * `\s` already covers NBSP, the U+2000 block, the line/paragraph separators and
 * the ideographic space.
 */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Truncate on a word boundary where possible, appending an ellipsis. */
export function truncateText(text: string, max: number): string {
  if (max <= 0) return "";
  if (text.length <= max) return text;
  const hard = text.slice(0, max);
  const lastSpace = hard.lastIndexOf(" ");
  const body = lastSpace > Math.floor(max * 0.6) ? hard.slice(0, lastSpace) : hard;
  return `${body.trimEnd()}…`;
}

/**
 * Prepare untrusted text for an AI prompt: control and zero-width characters
 * removed, whitespace collapsed, fence/tag markers that could break out of the
 * data block neutralised, and a hard length cap. The prompt builders still
 * label the result as untrusted data.
 */
export function sanitizeForPrompt(text: string, max = 500): string {
  const cleaned = collapseWhitespace(stripControlCharacters(text))
    .replace(/`{3,}/g, "'''")
    .replace(/[`]/g, "'")
    .replace(/</g, "‹")
    .replace(/>/g, "›");
  return truncateText(cleaned, max);
}

/** Escape text for interpolation into HTML (report snapshots, e-mail bodies). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
