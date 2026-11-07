-- Step 4 of the lock: call counter for the AI routes in api/ (pet-chat, ai-score, transcribe, transcribe-video,
-- ai-analyze).
--
-- Found 2026-11-07: those routes have no login check and take model / max_tokens from the caller, so anyone who knows
-- the URL can spend the Groq, OpenAI and AssemblyAI credit without limit. The guest page and the demo pages use three
-- of them without a login, so they stay open to guests, with a limit per hour (decided with the user 2026-11-07).
--
-- api/_lib/guard.js calls api_rate_hit() with the service role key for every paid call:
--   key "<route>:u:<user id>" for a signed-in user, "<route>:ip:<address>" plus "<route>:guests" for a guest.
-- It returns false once a key has been used more than p_limit times in the current window (one hour by default).
-- Only the service role can call it or read the table. Old windows are cleaned up as it runs.
--
-- If this file has not been run yet, the routes still work (they skip the limit), so it can be run before or after
-- the deploy. Safe to run twice. Undo: remove_api_rate_limits.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.api_rate_hit(p_key text, p_limit integer, p_window_seconds integer DEFAULT 3600)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  w timestamptz;
  n integer;
BEGIN
  IF p_key IS NULL OR p_limit IS NULL OR p_limit < 0 OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'api_rate_hit: bad arguments';
  END IF;

  w := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.api_rate_limits AS r (key, window_start, hits)
  VALUES (left(p_key, 200), w, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO n;

  -- About one call in a hundred clears windows older than two days.
  IF random() < 0.01 THEN
    DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '2 days';
  END IF;

  RETURN n <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.api_rate_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_rate_hit(text, integer, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check. Expected: one row, table_exists = true, anon_can_call = false, authenticated_can_call = false,
-- service_role_can_call = true.
SELECT to_regclass('public.api_rate_limits') IS NOT NULL AS table_exists,
       has_function_privilege('anon', 'public.api_rate_hit(text, integer, integer)', 'EXECUTE') AS anon_can_call,
       has_function_privilege('authenticated', 'public.api_rate_hit(text, integer, integer)', 'EXECUTE') AS authenticated_can_call,
       has_function_privilege('service_role', 'public.api_rate_hit(text, integer, integer)', 'EXECUTE') AS service_role_can_call;
