-- Ajout de l'expression « siris ».
-- À exécuter une fois dans Supabase : SQL Editor → New query → coller → Run.

alter table public.compteur_events drop constraint compteur_events_expression_check;
alter table public.compteur_events add constraint compteur_events_expression_check
  check (expression in ('notamment', 'on_va_dire', 'siris'));

create or replace view public.compteur_jours
  with (security_invoker = true)
as
select
  (created_at at time zone 'Europe/Paris')::date as jour,
  greatest(0, coalesce(sum(delta) filter (where expression = 'notamment'), 0))::int as notamment,
  greatest(0, coalesce(sum(delta) filter (where expression = 'on_va_dire'), 0))::int as on_va_dire,
  greatest(0, coalesce(sum(delta) filter (where expression = 'siris'), 0))::int as siris
from public.compteur_events
group by 1;
