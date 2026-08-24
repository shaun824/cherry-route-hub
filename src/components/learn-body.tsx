import type React from "react";

// Tiny markdown renderer for lesson bodies: headings, bullets, bold and paragraphs.
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function LearnBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key} className="ml-4 list-disc space-y-1 text-sm text-ink-soft">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const l = raw.trim();
    if (!l) {
      flush(`u${idx}`);
      return;
    }
    if (/^[-*•]\s+/.test(l)) {
      bullets.push(l.replace(/^[-*•]\s+/, ""));
      return;
    }
    flush(`u${idx}`);
    if (/^#{1,6}\s+/.test(l)) {
      blocks.push(
        <h4 key={idx} className="font-display text-sm font-bold text-ink">
          {l.replace(/^#{1,6}\s+/, "")}
        </h4>,
      );
      return;
    }
    blocks.push(
      <p key={idx} className="text-sm leading-relaxed text-ink-soft">
        {inline(l)}
      </p>,
    );
  });
  flush("u-last");

  return <div className="space-y-2">{blocks}</div>;
}
