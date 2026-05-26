/**
 * ThinkSync OS — RAG Response Formatter
 *
 * Lightweight, frontend-only formatting pipeline that transforms raw
 * retrieval-augmented output into polished conversational text.
 *
 * Pipeline:  raw LLM text → strip artifacts → remove jargon → clean filler
 *            → collapse whitespace → mode-specific formatting
 *
 * This module does NOT touch the backend, API contracts, streaming logic,
 * retrieval pipeline, embeddings, or any other agent. It operates purely
 * on the final string *after* the LLM has finished generating.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type RagResponseMode = 'conversation' | 'research' | 'technical';

// ── Stage 1: Strip retrieval artifacts ───────────────────────────────────────
// Removes visible citation markers, source blocks, chunk IDs, and debug info
// that leak from the retrieval layer into the user-facing text.

function stripArtifacts(text: string): string {
  let result = text;

  // ── Inline citation markers ──────────────────────────────────────────────
  // Multi-source brackets:  [Source 3, Source 4, Source 5]  or  [Source 1, 2]
  result = result.replace(/\[(?:Source\s*\d+(?:\s*,\s*(?:Source\s*)?\d+)*)\]/gi, '');

  // Single-source brackets: [Source 1], [source 3], [1], [2]
  result = result.replace(/\[(?:Source\s*)?\d+\]/gi, '');

  // Parenthesized source refs: (Source 1), (Source 2, Source 3)
  result = result.replace(/\((?:Source\s*\d+(?:\s*,\s*(?:Source\s*)?\d+)*)\)/gi, '');
  result = result.replace(/\((?:Source\s*)?\d+\)/gi, '');

  // ── "N sources referenced/cited" lines ───────────────────────────────────
  // The LLM sometimes generates "5 sources referenced" as inline text
  result = result.replace(/\n*\d+\s+sources?\s+(?:referenced|cited|used|found|matched|retrieved)\s*/gi, '');

  // ── Trailing source/reference blocks ─────────────────────────────────────
  // "Sources:", "**Sources:**", "References:", etc. followed by everything to EOF
  result = result.replace(/(?:^|\n)\s*(?:\*{0,2}(?:Sources|References|Citations|Source Documents|Source List)\*{0,2})\s*:[\s\S]*$/im, '');

  // ── Chunk / retrieval metadata ───────────────────────────────────────────
  result = result.replace(/(?:^|\n)\s*(?:chunk_id|document_id|doc_id|similarity|relevance_score|metadata)\s*:\s*.+/gi, '');
  result = result.replace(/(?:^|\n)\s*(?:Retrieved|Sourced|Extracted)\s+from\s+(?:document|file|source)\s*:\s*.+/gi, '');
  result = result.replace(/(?:^|\n)\s*Source\s*:\s*.+/gi, '');

  // Numbered source lists:  "1. filename.pdf - chunk 3"
  result = result.replace(/(?:^|\n)\s*\d+\.\s+\S+\.(?:pdf|docx|txt|md|csv|xlsx|json)\s*(?:[-–—].*)?$/gim, '');

  return result;
}

// ── Stage 2: Remove AI jargon and marketing language ─────────────────────────
// These words add no information and make the response sound like a brochure.
// Only removed when they appear as filler adjectives, not as technical terms.

const JARGON_REPLACEMENTS: [RegExp, string][] = [
  // Filler adjectives before nouns
  [/\b(?:revolutionary|cutting[\s-]edge|state[\s-]of[\s-]the[\s-]art)\s+/gi, ''],
  [/\b(?:comprehensive|extensive)\s+(?=(?:overview|guide|list|summary|analysis))/gi, ''],
  [/\b(?:powerful|robust)\s+(?=(?:tool|feature|capability|system|solution|framework))/gi, ''],
  [/\b(?:advanced|sophisticated)\s+(?=(?:algorithm|model|system|feature|capability|tool|AI))/gi, ''],
  [/\b(?:intelligent|smart)\s+(?=(?:system|agent|assistant|tool|feature))/gi, ''],

  // Verb phrases that add nothing
  [/\bis designed to\b/gi, 'can'],
  [/\bis built to\b/gi, 'can'],
  [/\baims to provide\b/gi, 'provides'],
  [/\bis capable of\b/gi, 'can'],
  [/\bhas the ability to\b/gi, 'can'],
  [/\bprovides the ability to\b/gi, 'lets you'],
  [/\benables (?:you|users) to\b/gi, 'lets you'],
  [/\bempowers (?:you|users) to\b/gi, 'lets you'],
  [/\ballows (?:you|users) to\b/gi, 'lets you'],

  // Marketing verbs
  [/\bleverages?\b/gi, 'uses'],
  [/\butilizes?\b/gi, 'uses'],
  [/\bharnesses?\b/gi, 'uses'],
  [/\bfacilitates?\b/gi, 'supports'],
  [/\bstreamlines?\b/gi, 'simplifies'],
  [/\borchestrates?\b/gi, 'coordinates'],

  // RAG self-reference filler
  [/\bIt(?:'s| is) (?:important|worth) (?:to note|noting|mentioning) that\s*/gi, ''],
  [/\bIt(?:'s| is) (?:also )?(?:interesting|notable|noteworthy) (?:to note|that)\s*/gi, ''],
  [/\bAs (?:an AI|a language model|a RAG system|an assistant),?\s*/gi, ''],
  [/\bBased on (?:the|my|your) (?:available |uploaded |provided )?(?:documents?|knowledge base|sources?|files?|notes?),?\s*/gi, ''],
  [/\bAccording to (?:the|your) (?:documents?|uploaded (?:files?|documents?)|knowledge base|sources?|notes?),?\s*/gi, ''],
  [/\bFrom (?:the|your) (?:provided|uploaded|available) (?:documents?|files?|sources?|notes?),?\s*/gi, ''],
  [/\bThe (?:documents?|sources?|files?) (?:indicate|suggest|mention|state|show|reveal) that\s*/gi, ''],
  [/\bI checked your (?:notes?|documents?|files?|sources?),?\s*(?:and\s*)?/gi, ''],
  [/\bit looks like\s+/gi, ''],
  [/\byour (?:documents?|notes?|files?) (?:mention|say|state|indicate|show|suggest|note|explain|describe)s? (?:that\s+)?/gi, ''],
];

function removeJargon(text: string): string {
  let result = text;
  for (const [pattern, replacement] of JARGON_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ── Stage 3: Remove conversational filler ────────────────────────────────────
// Strips meaningless intro/outro phrases that pad responses.

function removeFiller(text: string): string {
  let result = text;

  // ── Opening fillers (start of response) ──────────────────────────────────
  const OPENING_FILLERS: RegExp[] = [
    /^(?:Yeah[,.]?\s*|Sure[,!.]?\s*|Absolutely[,!.]?\s*|Certainly[,!.]?\s*|Of course[,!.]?\s*|Great question[,!.]?\s*)/i,
    /^(?:Here(?:'s| is) (?:what(?:'s| is) going on|the (?:thing|deal|answer))[,:.!]?\s*)/i,
    /^(?:If you(?:'re| are) wondering[,.]?\s*)/i,
    /^(?:That(?:'s| is) a (?:great|good|interesting) question[,!.]?\s*)/i,
    /^(?:I(?:'d| would) be happy to (?:help|explain|answer)[,!.]?\s*)/i,
    /^(?:Let me (?:explain|break (?:this|that|it) down)[,.]?\s*)/i,
  ];
  for (const pattern of OPENING_FILLERS) {
    result = result.replace(pattern, '');
  }

  // ── Per-paragraph fillers (start of any paragraph) ───────────────────────
  // These appear after newlines, at the start of a paragraph
  const PARAGRAPH_FILLERS: RegExp[] = [
    /(?<=\n\n?)(?:Basically[,.]?\s+)/gi,
    /(?<=\n\n?)(?:Essentially[,.]?\s+)/gi,
    /(?<=\n\n?)(?:So[,.]?\s+)(?=[A-Z])/g,
    /(?<=\n\n?)(?:Well[,.]?\s+)(?=[A-Z])/g,
    /(?<=\n\n?)(?:It(?:'s| is) (?:also )?(?:interesting|notable|worth noting|a pretty big) (?:to note |that\b)?)/gi,
    /(?<=\n\n?)(?:It(?:'s| is) a pretty big topic right now[,.]?\s*(?:with\s+)?)/gi,
  ];
  for (const pattern of PARAGRAPH_FILLERS) {
    result = result.replace(pattern, '');
  }

  // ── Closing fillers (end of response) ────────────────────────────────────
  const CLOSING_FILLERS: RegExp[] = [
    /\s*(?:I hope (?:this|that) helps[!.]?\s*|Let me know if you (?:need|have|want) (?:anything|more|further)[!.]?\s*|Feel free to ask[!.]?\s*)$/i,
    /\s*(?:Don't hesitate to (?:ask|reach out)[!.]?\s*|Happy to help (?:further|with anything else)[!.]?\s*)$/i,
  ];
  for (const pattern of CLOSING_FILLERS) {
    result = result.replace(pattern, '');
  }

  return result;
}

// ── Stage 4: Whitespace normalization ────────────────────────────────────────
// Collapses runs of blank lines, trims trailing spaces, fixes orphan bullets.

function normalizeWhitespace(text: string): string {
  return text
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim trailing whitespace on each line
    .replace(/[ \t]+$/gm, '')
    // Remove leading blank lines
    .replace(/^\n+/, '')
    // Remove trailing blank lines
    .replace(/\n+$/, '')
    .trim();
}

// ── Stage 5: Fix sentence-level issues ───────────────────────────────────────
// After artifact stripping, sentences can have dangling commas, double spaces,
// or start with lowercase after a period.

function fixSentences(text: string): string {
  return text
    // Double spaces
    .replace(/ {2,}/g, ' ')
    // Dangling commas from stripped citations: "the document, , shows" → "the document shows"
    .replace(/,\s*,/g, ',')
    // Space before comma/period
    .replace(/ +([.,;:])/g, '$1')
    // Empty parentheses left after stripping
    .replace(/\(\s*\)/g, '')
    // Empty brackets left after stripping
    .replace(/\[\s*\]/g, '')
    // Period followed by period (from stripped refs)
    .replace(/\.(\s*\.)+/g, '.')
    // Capitalize first letter of the response if lowercase
    .replace(/^([a-z])/, (_, c) => c.toUpperCase())
    // Capitalize first letter of each paragraph (after double newline)
    .replace(/(\n\n)([a-z])/g, (_, nl, c) => nl + c.toUpperCase());
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Full formatting pipeline for RAG responses.
 *
 * - `conversation`: full cleanup — no artifacts, no jargon, no filler, compact
 * - `research`:     keep original text intact, no formatting changes
 * - `technical`:    strip filler/jargon but keep structured source references
 */
export function formatRagResponse(raw: string, mode: RagResponseMode): string {
  if (!raw) return raw;

  switch (mode) {
    case 'research':
      // Research mode: pass through completely unmodified
      return raw;

    case 'technical':
      // Technical mode: clean language but keep structure and inline refs
      return normalizeWhitespace(
        fixSentences(
          removeFiller(
            removeJargon(raw)
          )
        )
      );

    case 'conversation':
    default:
      // Conversation mode: full pipeline — clean, natural, no artifacts
      return normalizeWhitespace(
        fixSentences(
          removeFiller(
            removeJargon(
              stripArtifacts(raw)
            )
          )
        )
      );
  }
}

/**
 * Whether to show citation badges for a given mode.
 */
export function shouldShowCitations(mode: RagResponseMode): boolean {
  return mode === 'research' || mode === 'technical';
}

/**
 * Whether to show the source count indicator for a given mode.
 */
export function shouldShowSourceCount(mode: RagResponseMode): boolean {
  return mode !== 'conversation';
}
