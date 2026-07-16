-- 在 Supabase 项目的 SQL Editor 中运行一次。
-- 网页只使用 publishable key；表里保存的是浏览器端 AES-GCM 加密后的内容。

create table if not exists public.couple_spaces (
  space_id text primary key check (char_length(space_id) = 64),
  payload text not null,
  updated_at timestamptz not null default now()
);

alter table public.couple_spaces enable row level security;

grant select, insert, update on table public.couple_spaces to anon;

drop policy if exists "read encrypted couple spaces" on public.couple_spaces;
create policy "read encrypted couple spaces"
on public.couple_spaces for select
to anon
using (true);

drop policy if exists "create encrypted couple spaces" on public.couple_spaces;
create policy "create encrypted couple spaces"
on public.couple_spaces for insert
to anon
with check (true);

drop policy if exists "update encrypted couple spaces" on public.couple_spaces;
create policy "update encrypted couple spaces"
on public.couple_spaces for update
to anon
using (true)
with check (true);

revoke delete on table public.couple_spaces from anon;
