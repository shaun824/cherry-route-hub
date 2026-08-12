import { ExternalLink } from "lucide-react";
import type { FeedPost } from "@/lib/mock-data";

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g;
const IS_URL = /^https?:\/\//;


/** First link found in the post (explicit source link wins). */
export function postLink(post: Pick<FeedPost, "body" | "sourceUrl">): string | null {
  if (post.sourceUrl) return post.sourceUrl;
  const m = post.body.match(URL_RE);
  return m?.[0] ?? null;
}

/** Body text with any trailing "Read the full article: <url>" line removed. */
function cleanBody(body: string): string {
  return body
    .replace(/\n*\s*Read (?:the )?full article:?\s*https?:\/\/\S+\s*$/i, "")
    .trim();
}

/** Renders post body with inline URLs turned into clickable links. */
export function FeedPostBody({ post }: { post: Pick<FeedPost, "body" | "sourceUrl"> }) {
  const body = cleanBody(post.body);
  const link = postLink(post);
  const parts = body.split(URL_RE);

  return (
    <>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
        {parts.map((part, i) =>
          IS_URL.test(part) ? (

            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline underline-offset-2"
            >
              {part.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </p>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
        >
          Read the full article <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </>
  );
}
