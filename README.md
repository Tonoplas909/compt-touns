# Compt'Touns

Compte les « notamment » et les « on va dire » de M. Tounsi, avec un historique par jour.

Site statique (HTML/CSS/JS, sans build) hébergé sur GitHub Pages. Les données sont dans
Supabase : tous les appareils partagent les mêmes compteurs, mis à jour en temps réel.

## Mise en place de Supabase

1. Créer un projet Supabase.
2. **SQL Editor → New query** : coller le contenu de [`supabase.sql`](supabase.sql), puis **Run**.
3. **Project Settings → API** : copier l'URL du projet et la clé *publishable* (ou *anon*)
   dans [`config.js`](config.js).

La clé publishable est publique par nature. Les policies RLS ne permettent au site que de
lire et d'ajouter des clics (+1 / −1) datés de l'instant présent : pas de modification, pas de
suppression, pas de clics antidatés.

Pour remettre les compteurs à zéro, il faut le faire depuis le dashboard Supabase :
`truncate public.compteur_events;`

## Déploiement GitHub Pages

**Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`,
dossier `/ (root)`. Le site sera disponible sur `https://<utilisateur>.github.io/compt-touns/`.
