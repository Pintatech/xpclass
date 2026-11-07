-- Undo add_api_rate_limits.sql: drop the call counter. The AI routes then skip their hourly limit (they keep the
-- login checks and the per-call caps, which live in api/). Safe to run twice.

BEGIN;

DROP FUNCTION IF EXISTS public.api_rate_hit(text, integer, integer);
DROP TABLE IF EXISTS public.api_rate_limits;

COMMIT;

NOTIFY pgrst, 'reload schema';
