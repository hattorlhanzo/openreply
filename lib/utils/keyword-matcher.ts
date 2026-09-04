/**
 * Keyword Matcher
 *
 * Matches comment text against a set of keywords with support for:
 * - Case-insensitive matching
 * - Whole-word or partial matching
 * - Multi-keyword OR logic (any match = true)
 * - Emoji and special character stripping
 */

export interface KeywordMatchResult {
  matched: boolean;
  matchedKeyword: string | null;
}

const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

// "Put a ➕ in the comments" is one of the most common campaign triggers, and
// the heavy plus sign lives inside the emoji ranges stripped below. Fold those
// variants onto a plain "+" first so the keyword survives.
const PLUS_VARIANTS = /[➕＋]/g;

// Letters of any script, digits, and the plus sign are meaningful; everything
// else is punctuation. `\w` is deliberately not used here: without the Unicode
// flag it means [A-Za-z0-9_], which silently deletes Cyrillic and every other
// non-Latin alphabet, leaving an empty string that can never match.
const NON_MEANINGFUL = /[^\p{L}\p{N}+\s]/gu;

const EMOJI =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu;

/**
 * Strip emojis and punctuation from text, keeping letters of any script,
 * digits, the plus sign, and whitespace.
 */
export function stripSpecialCharacters(text: string): string {
  return text
    .replace(PLUS_VARIANTS, "+")
    .replace(EMOJI, "")
    .replace(NON_MEANINGFUL, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if a comment text matches any of the given keywords.
 *
 * @param commentText - The raw comment text to check
 * @param keywords - Array of keywords to match against
 * @param wholeWordMatch - If true, keyword must be a standalone word.
 *                         If false, partial matches are allowed (e.g. "linking" matches "link")
 * @returns Match result with the first matched keyword (if any)
 */
export function matchKeywords(
  commentText: string,
  keywords: string[],
  wholeWordMatch: boolean = true
): KeywordMatchResult {
  if (!commentText || keywords.length === 0) {
    return { matched: false, matchedKeyword: null };
  }

  const cleanedText = stripSpecialCharacters(commentText).toLowerCase();

  if (!cleanedText) {
    return { matched: false, matchedKeyword: null };
  }

  for (const keyword of keywords) {
    const cleanedKeyword = stripSpecialCharacters(keyword).toLowerCase();

    if (!cleanedKeyword) continue;

    if (wholeWordMatch && HAS_LETTER_OR_DIGIT.test(cleanedKeyword)) {
      const escapedKeyword = cleanedKeyword.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      // Lookarounds instead of \b: \b is defined against [A-Za-z0-9_], so it
      // never fires between two Cyrillic letters and "тест" would match inside
      // "тестирование". These assert the neighbours are not letters or digits
      // in any script.
      const regex = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapedKeyword}(?![\\p{L}\\p{N}])`,
        "iu"
      );
      if (regex.test(cleanedText)) {
        return { matched: true, matchedKeyword: keyword };
      }
    } else if (wholeWordMatch) {
      // A symbol-only keyword such as "+" has no word boundaries to speak of,
      // so whole-word mode would never match it. Fall back to substring.
      if (cleanedText.includes(cleanedKeyword)) {
        return { matched: true, matchedKeyword: keyword };
      }
    } else {
      // Partial match — keyword substring exists anywhere in the cleaned text
      if (cleanedText.includes(cleanedKeyword)) {
        return { matched: true, matchedKeyword: keyword };
      }
    }
  }

  return { matched: false, matchedKeyword: null };
}
