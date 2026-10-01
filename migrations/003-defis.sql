-- Défis : des mots à faire dire au prof.
-- À exécuter une fois dans Supabase : SQL Editor → New query → coller → Run.

create table public.defis (
  id bigint generated always as identity primary key,
  mot text not null check (char_length(mot) between 1 and 60 and mot = btrim(mot)),
  created_at timestamptz not null default now(),
  validated_at timestamptz
);

-- Un même mot ne peut pas être deux fois dans la file d'attente.
create unique index defis_mot_en_attente on public.defis (lower(mot)) where validated_at is null;

alter table public.defis enable row level security;

create policy "lecture publique"
  on public.defis for select
  to anon, authenticated
  using (true);

create policy "ajout public"
  on public.defis for insert
  to anon, authenticated
  with check (validated_at is null and created_at between now() - interval '1 minute' and now() + interval '1 minute');

-- Le site ne peut que lire, et ajouter un mot (seule la colonne `mot` est fournie).
revoke all on public.defis from anon, authenticated;
grant select on public.defis to anon, authenticated;
grant insert (mot) on public.defis to anon, authenticated;

-- Valider un défi : uniquement un mot en attente, à l'heure du serveur.
create function public.valider_defi(defi_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.defis set validated_at = now() where id = defi_id and validated_at is null;
$$;

revoke execute on function public.valider_defi(bigint) from public, anon, authenticated;
grant execute on function public.valider_defi(bigint) to anon, authenticated;

-- Mises à jour en temps réel entre appareils.
alter publication supabase_realtime add table public.defis;
