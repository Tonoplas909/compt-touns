-- À exécuter une fois dans Supabase : SQL Editor → New query → coller → Run.

-- Chaque clic = une ligne (+1 ou -1). Pas de mise à jour ni de suppression depuis le site.
create table public.compteur_events (
  id bigint generated always as identity primary key,
  expression text not null check (expression in ('notamment', 'on_va_dire')),
  delta smallint not null default 1 check (delta in (1, -1)),
  created_at timestamptz not null default now()
);

alter table public.compteur_events enable row level security;

create policy "lecture publique"
  on public.compteur_events for select
  to anon, authenticated
  using (true);

-- La date est imposée par le serveur : impossible d'ajouter des clics dans le passé.
create policy "ajout public"
  on public.compteur_events for insert
  to anon, authenticated
  with check (created_at between now() - interval '1 minute' and now() + interval '1 minute');

grant select, insert on public.compteur_events to anon, authenticated;

-- Totaux par jour, à l'heure de Paris.
create view public.compteur_jours
  with (security_invoker = true)
as
select
  (created_at at time zone 'Europe/Paris')::date as jour,
  greatest(0, coalesce(sum(delta) filter (where expression = 'notamment'), 0))::int as notamment,
  greatest(0, coalesce(sum(delta) filter (where expression = 'on_va_dire'), 0))::int as on_va_dire
from public.compteur_events
group by 1;

grant select on public.compteur_jours to anon, authenticated;

-- Mises à jour en temps réel entre appareils.
alter publication supabase_realtime add table public.compteur_events;
