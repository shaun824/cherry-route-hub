ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS source_url text;

CREATE UNIQUE INDEX IF NOT EXISTS feed_posts_source_url_key ON public.feed_posts (source_url) WHERE source_url IS NOT NULL;

UPDATE public.feed_posts
SET source_url = (regexp_match(body, 'https?://[^\s)]+'))[1]
WHERE source_url IS NULL AND body ~ 'https?://';