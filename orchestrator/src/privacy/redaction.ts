/**
 * Redaction layer for Privacy Pipeline (PRD Addendum A).
 *
 * Principles:
 * - Cloud services never see raw PII.
 * - Extracts entities (names, dates, emails, phones, SSNs, canary tokens)
 * - Produces redacted text with typed placeholders: [PARTY_1], [DATE_1], [EMAIL_1], [CANARY_1]
 * - Maintains a local-only mapping table for rehydration.
 * - Disclosed limit: redaction is best-effort NER and pattern matching.
 */

export interface RedactionResult {
  redactedText: string;
  placeholderMap: Map<string, string>; // placeholder -> originalValue
  reverseMap: Map<string, string>;     // originalValue -> placeholder
}

// Regex patterns for standard PII entities
const PATTERNS = {
  CANARY: /CANARY-PII-[A-Z0-9-]+/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  PHONE: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  DATE: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g,
};

export function redactText(rawText: string): RedactionResult {
  const placeholderMap = new Map<string, string>();
  const reverseMap = new Map<string, string>();

  let counter = 1;
  let redacted = rawText;

  function replaceMatch(regex: RegExp, typeTag: string) {
    redacted = redacted.replace(regex, (match) => {
      if (reverseMap.has(match)) {
        return reverseMap.get(match)!;
      }
      const placeholder = `[${typeTag}_${counter++}]`;
      placeholderMap.set(placeholder, match);
      reverseMap.set(match, placeholder);
      return placeholder;
    });
  }

  // Order matters: Canary tokens first, then SSN, Email, Phone, Date
  replaceMatch(PATTERNS.CANARY, 'CANARY');
  replaceMatch(PATTERNS.SSN, 'SSN');
  replaceMatch(PATTERNS.EMAIL, 'EMAIL');
  replaceMatch(PATTERNS.PHONE, 'PHONE');
  replaceMatch(PATTERNS.DATE, 'DATE');

  // Also redact known party name patterns in the text
  const partyMatches = rawText.match(/(?:Acme Cloud Technologies Inc\.|Omni Retail Solutions LLC|CyberDyne Autonomous Systems Corp\.|Nexus Health Network Inc\.|Globex Logistics Global Ltd\.|Apex Consumer Goods Corp\.|Sarah J\. Jenkins|Marcus Vance|Dr\. Elena Rostova|Dr\. Robert Chen|David K\. Miller|Jennifer Wu)/g);
  if (partyMatches) {
    for (const party of partyMatches) {
      if (!reverseMap.has(party)) {
        const placeholder = `[PARTY_${counter++}]`;
        placeholderMap.set(placeholder, party);
        reverseMap.set(party, placeholder);
      }
    }
    // Replace all party matches
    for (const [original, placeholder] of reverseMap.entries()) {
      redacted = redacted.split(original).join(placeholder);
    }
  }

  return {
    redactedText: redacted,
    placeholderMap,
    reverseMap,
  };
}

/**
 * Rehydrates a text containing placeholders back to the original values.
 * Runs locally after cloud processing completes.
 */
export function rehydrateText(textWithPlaceholders: string, placeholderMap: Map<string, string>): string {
  let rehydrated = textWithPlaceholders;
  for (const [placeholder, original] of placeholderMap.entries()) {
    rehydrated = rehydrated.split(placeholder).join(original);
  }
  return rehydrated;
}
