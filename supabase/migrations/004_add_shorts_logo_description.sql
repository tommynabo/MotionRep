-- Migration 004: Add shorts_logo_description to config
-- Flux Kontext is a text-to-image model — it cannot read image URLs.
-- This key stores a plain-text description of the brand logo that appears
-- on the outer left thigh of the athlete's black shorts.
-- Claude uses this description verbatim when building the image_prompt.
--
-- Example values:
--   "a small minimalist white triangle logo"
--   "the text MOTIONREP in bold white uppercase sans-serif"
--   "a white stylised lightning bolt symbol"
--
-- Update this in the Supabase Dashboard → Table Editor → config
-- or via the Configuration UI once you know exactly how the logo should look.

INSERT INTO public.config (key, value, description)
VALUES (
  'shorts_logo_description',
  'a small white minimalist brand logo',
  'Plain-text visual description of the brand logo printed on the outer left thigh of the black shorts. Used verbatim in the Flux image prompt — be specific: shape, style, size (e.g. "a small white minimalist mountain peak logo" or "the word MOTIONREP in small white bold uppercase letters").'
)
ON CONFLICT (key) DO NOTHING;
