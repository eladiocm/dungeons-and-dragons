-- Dedicated application boundary: no table or role credentials are exposed to clients.
create schema if not exists dnd_private;
revoke all on schema dnd_private from public, anon, authenticated;
create table dnd_private.config(singleton boolean primary key default true check(singleton), key_hash text not null);
create table dnd_private.sessions(id text primary key, owner_hash text not null, version integer not null, state jsonb not null, updated_at bigint not null);
create index sessions_owner on dnd_private.sessions(owner_hash, updated_at desc);
create table dnd_private.creations(owner_hash text not null, command_id text not null, request_hash text not null, session_id text not null references dnd_private.sessions(id), primary key(owner_hash,command_id));
create table dnd_private.commands(session_id text not null references dnd_private.sessions(id), command_id text not null, request_hash text not null, result_version integer not null, primary key(session_id,command_id));
create table dnd_private.jobs(session_id text not null references dnd_private.sessions(id), job_key text not null, request_hash text not null, lease_until bigint not null, result text, primary key(session_id,job_key));
create table dnd_private.media(cache_key text primary key, data text not null, created_at bigint not null);
create table dnd_private.budgets(bucket text primary key, used integer not null, created_at timestamptz not null default now());
alter table dnd_private.config enable row level security;
alter table dnd_private.sessions enable row level security;
alter table dnd_private.creations enable row level security;
alter table dnd_private.commands enable row level security;
alter table dnd_private.jobs enable row level security;
alter table dnd_private.media enable row level security;
alter table dnd_private.budgets enable row level security;
revoke all on all tables in schema dnd_private from public, anon, authenticated;

create or replace function public.dnd_backend(p_secret text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s dnd_private.sessions%rowtype;
  c record;
  j dnd_private.jobs%rowtype;
  v_state jsonb;
  v_owner text := p_args->>'owner';
  v_id text := p_args->>'id';
  v_command text := p_args->>'commandId';
  v_hash text := p_args->>'hash';
  v_now bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  n integer;
begin
  -- A publishable API key alone has no authority. The backend credential is
  -- random 256-bit material, server-only; only its SHA256 is stored here.
  if p_secret is null or length(p_secret) <> 64 or not exists (
    select 1 from dnd_private.config where key_hash = encode(extensions.digest(p_secret,'sha256'),'hex')
  ) then return jsonb_build_object('error','Acceso de servidor no autorizado.','status',403); end if;
  if p_op = 'quota' then
    if (p_args->>'limit')::integer not between 1 and 1000 or length(p_args->>'bucket') > 150 then
      return jsonb_build_object('error','Cuota inválida.','status',400);
    end if;
    delete from dnd_private.budgets where created_at < now()-interval '2 days';
    insert into dnd_private.budgets(bucket,used) values(p_args->>'bucket',1)
      on conflict(bucket) do update set used=dnd_private.budgets.used+1
      where dnd_private.budgets.used < (p_args->>'limit')::integer returning used into n;
    if n is null then return jsonb_build_object('error','La demo alcanzó su límite diario de IA. Puedes seguir leyendo y volver mañana.','status',429); end if;
    return '{}'::jsonb;
  elsif p_op = 'media' then
    return jsonb_build_object('data',(select data from dnd_private.media where cache_key=p_args->>'key'));
  elsif p_op = 'saveMedia' then
    if octet_length(p_args->>'data') > 2000000 then return '{}'::jsonb; end if;
    perform pg_advisory_xact_lock(712402);
    insert into dnd_private.media(cache_key,data,created_at) values(p_args->>'key',p_args->>'data',v_now)
      on conflict(cache_key) do update set data=excluded.data,created_at=excluded.created_at;
    delete from dnd_private.media where cache_key not in(select cache_key from dnd_private.media order by created_at desc,cache_key desc limit 24);
    return '{}'::jsonb;
  elsif p_op in ('finishJob','releaseJob') then
    update dnd_private.jobs set lease_until=0, result=case when p_op='finishJob' then p_args->>'result' else result end where session_id=v_id and job_key=p_args->>'key';
    return '{}'::jsonb;
  end if;
  if v_owner is null or length(v_owner) not between 1 and 100 then
    return jsonb_build_object('error','Propietario inválido.','status',400);
  end if;
  if p_op = 'list' then
    return coalesce((select jsonb_agg(x.summary order by x.updated_at desc) from (
      select updated_at,jsonb_build_object('id',id,'version',version,'status',state->>'status','character',state#>>array['battle','actors',state#>>'{participants,0,characterId}','name'],'scene',state#>>'{world,sceneId}','updatedAt',updated_at) summary
      from dnd_private.sessions where owner_hash=v_owner order by updated_at desc limit 100
    ) x),'[]'::jsonb);
  elsif p_op in ('creation','create') then
    perform pg_advisory_xact_lock(712401);
    select * into c from dnd_private.creations where owner_hash=v_owner and command_id=v_command;
    if found then
      if c.request_hash <> v_hash then return jsonb_build_object('error','Ese identificador de creación ya se usó con otros datos.','status',409); end if;
      select * into s from dnd_private.sessions where id=c.session_id and owner_hash=v_owner;
      return jsonb_build_object('state',s.state,'replayed',true);
    end if;
    if p_op='creation' then return '{}'::jsonb; end if;
    if (select count(*) from dnd_private.sessions)>=200 or (select count(*) from dnd_private.sessions where owner_hash=v_owner)>=100 then
      return jsonb_build_object('error','La demo alcanzó el límite de partidas guardadas.','status',409);
    end if;
    v_state := p_args->'state';
  else
    if p_op in ('commit','amend') then
      perform pg_advisory_xact_lock(712401);
      select * into s from dnd_private.sessions where id=v_id and owner_hash=v_owner for update;
    else
      select * into s from dnd_private.sessions where id=v_id and owner_hash=v_owner;
    end if;
    if not found then return jsonb_build_object('error','No se encontró esa partida privada.','status',404); end if;
    if p_op='read' then return s.state; end if;
    if p_op in ('prepare','commit') then
      select * into c from dnd_private.commands where session_id=v_id and command_id=v_command;
      if found then
        if c.request_hash <> v_hash then return jsonb_build_object('error','Ese comando ya se usó con otros datos.','status',409); end if;
        return jsonb_build_object('state',s.state,'replayed',true);
      end if;
      if p_op='prepare' then return jsonb_build_object('state',s.state,'replayed',false); end if;
    end if;
    if p_op='claim' then
      perform pg_advisory_xact_lock(hashtextextended(v_id||':'||(p_args->>'key'),0));
      select * into j from dnd_private.jobs where session_id=v_id and job_key=p_args->>'key';
      if found then
        if j.request_hash <> v_hash then return jsonb_build_object('error','Ese identificador ya se usó con otros datos.','status',409); end if;
        if j.result is not null then return jsonb_build_object('cached',j.result); end if;
        if j.lease_until>v_now then return jsonb_build_object('error','El Master ya está preparando esa respuesta. Espera y reintenta.','status',409); end if;
      end if;
      insert into dnd_private.jobs(session_id,job_key,request_hash,lease_until) values(v_id,p_args->>'key',v_hash,v_now+130000)
        on conflict(session_id,job_key) do update set lease_until=excluded.lease_until;
      return '{}'::jsonb;
    end if;
    if p_op not in ('commit','amend') then return jsonb_build_object('error','Operación no reconocida.','status',400); end if;
    if s.version <> (p_args->>'expectedVersion')::integer then
      return jsonb_build_object('error','La partida cambió en otra pestaña. Actualiza el estado y revisa tu acción.','status',409);
    end if;
    v_state := p_args->'state';
    if v_state->>'id' <> v_id or (v_state->>'version')::integer <> s.version+1 then return jsonb_build_object('error','Transición de partida inválida.','status',500); end if;
  end if;
  if v_state is null or v_state->>'schemaVersion'<>'2' or v_state->>'rulesetVersion'<>'SRD-5.2.1' or jsonb_typeof(v_state->'participants')<>'array' or not(v_state ? 'world' and v_state ? 'battle') then
    return jsonb_build_object('error','Estado de partida inválido.','status',400);
  end if;
  if octet_length(v_state::text)>2000000 or coalesce((select sum(octet_length(state::text)) from dnd_private.sessions where id<>coalesce(v_id,'')),0)+octet_length(v_state::text)>120000000 then
    return jsonb_build_object('error','El guardado supera el espacio disponible de esta demo gratuita.','status',413);
  end if;
  if p_op='create' then
    insert into dnd_private.sessions values(v_state->>'id',v_owner,(v_state->>'version')::integer,v_state,v_now);
    insert into dnd_private.creations values(v_owner,v_command,v_hash,v_state->>'id');
  else
    update dnd_private.sessions set version=(v_state->>'version')::integer,state=v_state,updated_at=v_now where id=v_id;
    if p_op='commit' then insert into dnd_private.commands values(v_id,v_command,v_hash,(v_state->>'version')::integer); end if;
  end if;
  return jsonb_build_object('state',v_state,'replayed',false);
exception when unique_violation then
  return jsonb_build_object('error','Otra operación ya utilizó ese identificador.','status',409);
when others then
  return jsonb_build_object('error','No se pudo completar el guardado remoto. Reintenta.','status',503);
end;
$$;
revoke all on function public.dnd_backend(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.dnd_backend(text,text,jsonb) to anon;
-- Provision the random backend credential hash separately. Never commit secrets.
