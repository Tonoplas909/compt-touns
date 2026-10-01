# Compt'Touns

Compte les « notamment », les « on va dire » et les « SIRIS » de M. Tounsi, avec un historique par jour.
On peut aussi lancer des défis : proposer des mots à lui faire dire, puis les valider quand il les dit.

Site statique (HTML/CSS/JS, sans build) hébergé sur GitHub Pages. Les données sont dans
Supabase : tous les appareils partagent les mêmes compteurs, mis à jour en temps réel.

## Mise en place de Supabase

1. Créer un projet Supabase.
2. **SQL Editor → New query** : coller le contenu de [`supabase.sql`](supabase.sql), puis **Run**.
   (Les fichiers de [`migrations/`](migrations) servent seulement à mettre à jour une base déjà créée.)
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

## Mise à jour du site

Après une modification de `style.css`, `config.js` ou `script.js`, augmenter le numéro `?v=`
des liens correspondants dans `index.html` : sinon les navigateurs peuvent garder l'ancienne
version en cache jusqu'à 10 minutes.
