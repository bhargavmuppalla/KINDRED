create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  provider text not null,
  provider_id text not null check (char_length(provider_id) between 1 and 255),
  added_at timestamptz not null default now(),
  unique (category, provider, provider_id),
  check (
    (category = 'movies' and provider = 'tmdb') or
    (category = 'food' and provider = 'geoapify') or
    (category = 'songs' and provider = 'musicbrainz')
  )
);

create table public.ratings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.catalog_items (id) on delete cascade,
  score smallint not null check (score in (-1, 1, 2)),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index ratings_item_id_user_id_idx on public.ratings (item_id, user_id);

create table public.saved_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.catalog_items (id) on delete cascade,
  primary key (user_id, item_id)
);

alter table public.catalog_items enable row level security;
alter table public.ratings enable row level security;
alter table public.saved_items enable row level security;

revoke all on public.catalog_items, public.ratings, public.saved_items from public, anon, authenticated;
grant select on public.catalog_items to authenticated;
grant select, insert, update, delete on public.ratings, public.saved_items to authenticated;
grant select, insert, update on public.catalog_items to service_role;

create policy "Signed-in users can read catalog items"
  on public.catalog_items for select to authenticated using (true);

create policy "Users can manage their own ratings"
  on public.ratings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can manage their own saved items"
  on public.saved_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.set_rating_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_rating_updated_at() from public, anon, authenticated;

create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function public.set_rating_updated_at();
