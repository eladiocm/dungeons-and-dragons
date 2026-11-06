-- Supabase defaults may grant authenticated independently of PUBLIC.
revoke all on function public.dnd_ai_state(text,text,jsonb) from authenticated;
