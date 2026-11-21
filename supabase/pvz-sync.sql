-- 单词花园 · 跨设备同步（Supabase）
-- 在 Supabase Dashboard → SQL Editor 中整段执行一次即可。
-- 表与函数均带 pvz_sync 前缀，不影响同一项目里的其他应用。

create table if not exists public.pvz_sync (
  code text primary key,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.pvz_sync enable row level security;
revoke all on table public.pvz_sync from anon, authenticated;

create or replace function public.pvz_sync_get(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'payload', payload,
    'revision', revision,
    'updatedAt', updated_at
  )
  from public.pvz_sync
  where code = p_code;
$$;

create or replace function public.pvz_sync_put(p_code text, p_payload jsonb, p_revision bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pvz_sync%rowtype;
begin
  if p_code is null or length(p_code) < 16 or length(p_code) > 128 then
    raise exception 'invalid sync code' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be an object' using errcode = '22023';
  end if;

  insert into public.pvz_sync as t (code, payload, revision)
  values (p_code, p_payload, 1)
  on conflict (code) do update
    set payload = excluded.payload,
        revision = t.revision + 1,
        updated_at = now()
    where t.revision = p_revision
  returning * into v_row;

  if v_row.code is null then
    raise exception 'revision conflict' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'payload', v_row.payload,
    'revision', v_row.revision,
    'updatedAt', v_row.updated_at
  );
end;
$$;

revoke all on function public.pvz_sync_get(text) from public;
revoke all on function public.pvz_sync_put(text, jsonb, bigint) from public;
grant execute on function public.pvz_sync_get(text) to anon, authenticated;
grant execute on function public.pvz_sync_put(text, jsonb, bigint) to anon, authenticated;

-- ---- 自测（可选，执行后可删除这些测试行）----
-- select public.pvz_sync_put('test-code-0000000000000001', '{"students":[]}'::jsonb, null);
-- select public.pvz_sync_put('test-code-0000000000000001', '{"students":[1]}'::jsonb, 1);
-- select public.pvz_sync_put('test-code-0000000000000001', '{"students":[2]}'::jsonb, 1); -- 期望 40001 冲突
-- select public.pvz_sync_get('test-code-0000000000000001');
-- delete from public.pvz_sync where code = 'test-code-0000000000000001';
