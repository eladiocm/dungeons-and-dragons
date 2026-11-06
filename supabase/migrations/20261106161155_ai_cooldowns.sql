-- Cooldowns outlive Vercel instances and do not evict scene/audio caches.
create table dnd_private.ai_cooldowns(provider text primary key check(provider in ('groq','gemini','cloudflare')), blocked_until bigint not null);
alter table dnd_private.ai_cooldowns enable row level security;
revoke all on dnd_private.ai_cooldowns from public, anon, authenticated;
create or replace function public.dnd_ai_state(p_secret text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_provider text := p_args->>'provider';
  v_until bigint;
begin
  if p_secret is null or length(p_secret) <> 64 or not exists (
    select 1 from dnd_private.config where key_hash=encode(extensions.digest(p_secret,'sha256'),'hex')
  ) then return jsonb_build_object('error','Acceso de servidor no autorizado.','status',403); end if;
  if v_provider is null or v_provider not in ('groq','gemini','cloudflare') then
    return jsonb_build_object('error','Proveedor no válido.','status',400);
  end if;
  if p_op='block' then
    v_until := (p_args->>'until')::bigint;
    if v_until is null or v_until < 0 then return jsonb_build_object('error','Pausa no válida.','status',400); end if;
    insert into dnd_private.ai_cooldowns(provider,blocked_until) values(v_provider,v_until)
      on conflict(provider) do update set blocked_until=greatest(dnd_private.ai_cooldowns.blocked_until,excluded.blocked_until);
  elsif p_op <> 'get' or p_op is null then
    return jsonb_build_object('error','Operación no válida.','status',400);
  end if;
  return jsonb_build_object('until',coalesce((select blocked_until from dnd_private.ai_cooldowns where provider=v_provider),0));
end;
$$;
revoke all on function public.dnd_ai_state(text,text,jsonb) from public;
grant execute on function public.dnd_ai_state(text,text,jsonb) to anon;
