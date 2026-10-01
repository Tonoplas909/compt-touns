-- Défis : supprimer un mot en attente, et indiquer qui a fait dire un mot.
-- À exécuter une fois dans Supabase : SQL Editor → New query → coller → Run.

alter table public.defis add column valide_par text
  check (valide_par is null or (char_length(valide_par) between 1 and 40 and valide_par = btrim(valide_par)));

-- Valider un défi, avec le nom (facultatif) de celui qui l'a fait dire.
drop function public.valider_defi(bigint);

create function public.valider_defi(defi_id bigint, par text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.defis
  set validated_at = now(), valide_par = nullif(btrim(left(par, 40)), '')
  where id = defi_id and validated_at is null;
$$;

revoke execute on function public.valider_defi(bigint, text) from public, anon, authenticated;
grant execute on function public.valider_defi(bigint, text) to anon, authenticated;

-- Supprimer un défi encore en attente (les défis validés ne peuvent pas être supprimés).
create function public.supprimer_defi(defi_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.defis where id = defi_id and validated_at is null;
$$;

revoke execute on function public.supprimer_defi(bigint) from public, anon, authenticated;
grant execute on function public.supprimer_defi(bigint) to anon, authenticated;
