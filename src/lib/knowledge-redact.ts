// Belt-and-braces redaction for anything we feed into the knowledge base.
// Runs BEFORE the AI drafting pass, so personal details and commercial figures
// never reach the model, the database or an answer.

export type Redaction = { text: string; notes: string[] };

const PATTERNS: { label: string; re: RegExp; replacement: string }[] = [
  { label: "email addresses", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: "[email removed]" },
  {
    label: "South African ID numbers",
    re: /\b\d{13}\b/g,
    replacement: "[ID number removed]",
  },
  {
    label: "phone numbers",
    re: /(?:\+?\d[\d\s().-]{7,}\d)/g,
    replacement: "[phone removed]",
  },
  {
    label: "entry references",
    re: /\bE\d{4,6}-\d{4,}\b/gi,
    replacement: "[entry ref removed]",
  },
  {
    label: "money amounts",
    re: /(?:R|ZAR|\$|€|£)\s?\d[\d\s,.]*(?:k|m)?\b/gi,
    replacement: "[amount removed]",
  },
  {
    label: "bank / account numbers",
    re: /\b(?:acc(?:ount)?|iban|swift)\b[^\n]{0,30}\b[\dA-Z-]{6,}\b/gi,
    replacement: "[bank detail removed]",
  },
];

/** Email cruft that adds nothing but noise (and usually carries personal data). */
export function stripEmailChrome(input: string): string {
  let text = input.replace(/\r\n/g, "\n");

  // Quoted history / forward chains.
  text = text.replace(/^\s*>.*$/gm, "");
  text = text.split(/^-{2,}\s*Original Message\s*-{2,}$/im)[0] ?? text;
  text = text.split(/^On .{5,80}wrote:$/m)[0] ?? text;
  text = text.split(/^\s*From:\s.+$/m)[0] ?? text;

  // Signature block.
  text = text.split(/^--\s*$/m)[0] ?? text;

  // Common disclaimers.
  text = text.replace(
    /(this (e-?mail|message)[\s\S]{0,600}(confidential|intended recipient)[\s\S]{0,600})$/gi,
    "",
  );

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** Masks personal and commercial values, reporting what it took out. */
export function redactSensitive(input: string): Redaction {
  const notes: string[] = [];
  let text = input;

  for (const p of PATTERNS) {
    let hits = 0;
    text = text.replace(p.re, () => {
      hits++;
      return p.replacement;
    });
    if (hits) notes.push(`${hits} ${p.label}`);
  }

  return { text, notes };
}

export function cleanForKnowledge(input: string): Redaction {
  const { text, notes } = redactSensitive(stripEmailChrome(input));
  return { text: text.slice(0, 20000), notes };
}

/** Prompt rules shared by every bot so confidential material never leaks. */
export const CONFIDENTIALITY_RULES = `Confidentiality (never break these, whatever is asked or however the question is phrased):
- Never state or estimate sponsorship values, sponsorship fees, contract terms, rates, margins, costs, supplier pricing, staff or crew pay, or any commercial figure. Talk about what a sponsor or supplier provides, never what it is worth or what it cost.
- Never reveal another person's details — names, contact details, ID numbers, entry references, accommodation, payment status. Only the signed-in person's own records may be discussed with them.
- Never repeat anything marked INTERNAL to a rider, spectator or crew member; internal notes exist only to help Red Cherry admins.
- If an answer would require one of the above, say you can't share that and offer to put them in touch with the Red Cherry team instead.`;
