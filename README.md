# BrawlMeta

Site d'analyse de la méta Brawl Stars en classé : tier list, meilleures compos par map,
buffs/nerfs et assistant de draft.

## Démarrage rapide (données de démo)

```bash
npm install
npm run demo     # génère des parties FICTIVES pour tester l'interface
npm run dev      # http://localhost:3000
```

## Brancher les vraies données

1. Crée une clé sur https://developer.brawlstars.com (« My Account » → « Create New Key »).
   Renseigne l'**adresse IP publique** de la machine qui lancera la collecte
   (`curl ifconfig.me` pour la connaître).
2. `cp .env.example .env` puis colle la clé dans `BS_API_KEY`.
3. `npm run collect` : récupère les classements (global + pays), puis l'historique des
   ~2000 joueurs analysés, et garde les parties classées (`soloRanked`). Les données de démo
   sont supprimées automatiquement. Les joueurs croisés dans les parties sont ajoutés pour
   les collectes suivantes.
4. Relance `npm run collect` régulièrement (cron toutes les heures par exemple) : l'API
   ne renvoie que les 25 dernières parties de chaque joueur.

```cron
0 * * * * cd /chemin/vers/brawl-meta && npm run collect >> collect.log 2>&1
```

En fin de collecte, le script affiche les types de parties rencontrés. Si le classé
apparaît sous un autre nom, ajuste `BS_BATTLE_TYPES` dans `.env`.

## Classé et trophées

La collecte récupère les deux (`BS_BATTLE_TYPES=soloRanked,ranked` : dans l'API,
`soloRanked` = Classé et `ranked` = parties en trophées). Chaque page a une barre de filtres
Classé / Trophées, mode de jeu et période.

## Noms des maps en français

L'API ne donne les noms qu'en anglais. Les traductions sont dans `content/map-names-fr.json`
(nom anglais → nom français) ; une map absente reste en anglais. `npm run collect` liste à la
fin les maps qui n'ont pas encore de traduction.

## Assistant draft : compte lié et saisie rapide

- **Lier son compte** : entre ton tag joueur (mémorisé dans le navigateur). Avec « Conseils
  personnalisés » coché, le score de chaque brawler tient compte de :
  - **tes brawlers** : seuls ceux que tu as débloqués sont proposés ;
  - **leur équipement** : -1 % par niveau sous le 11 (max -5 %), -1,5 % sans gadget,
    -2 % sans pouvoir star ;
  - **ton winrate perso** : comparé à ce qu'on attend de toi avec ce brawler (ton niveau
    général + sa force dans la méta), lissé pour que quelques parties comptent peu
    (plafonné à ±8 %). Seules les parties 3v3 en classé et en trophées comptent.
  L'API ne donne que les 25 dernières parties : elles sont enregistrées à chaque visite de
  l'assistant et à chaque `npm run collect` (table `player_battles`), donc ton historique
  grossit avec le temps.
- **Ordre du draft** : choisis « 1er pick : Nous / Eux » et la catégorie active suit l'ordre du
  classé (6 bans puis picks 1-2-2-1). « Annuler » retire le dernier ajout.
- **Saisie rapide** : grille triée du plus fort au plus faible dans le draft en cours, recherche
  (Entrée ajoute le premier résultat), et sur mobile une barre collée en haut avec les bans
  conseillés et les meilleurs picks.

## Buffs & nerfs

Aucune API ne fournit les changements d'équilibrage : ils sont saisis dans
`content/balance-changes.json` (relu à chaque requête, pas besoin de redémarrer).
Supprime l'entrée `"exemple": true` quand tu ajoutes les vraies notes de patch.

## Comment les stats sont calculées

- **Score** : taux de victoire ajusté (moyenne bayésienne). Un brawler peu joué est ramené
  vers 50 % (ou, sur une map, vers son taux global) tant qu'il n'a pas assez de parties.
- **Tiers** : répartis par percentile du score (S = top 10 %, A = 10 suivants 20 %, …).
- **Présence** : part des parties où le brawler est dans l'une des deux équipes.
  L'API ne fournit pas les bans, donc pas de taux de ban.
- **Assistant draft** : score = score du brawler sur la map + synergie moyenne avec tes
  alliés + avantage moyen contre les ennemis déjà choisis (écarts par rapport à son taux
  de victoire habituel). La « compo conseillée » complète ton équipe pick par pick.

## Structure

| Chemin | Rôle |
| --- | --- |
| `scripts/collect.ts` | Collecte via l'API officielle |
| `scripts/seed-demo.ts` | Données de démo |
| `src/lib/db.ts` | Base SQLite (`data/brawl.db`, via `node:sqlite`, Node ≥ 22.5) |
| `src/lib/stats.ts` | Calculs de stats |
| `src/lib/draft.ts` | Moteur de recommandation |
| `src/app/` | Pages (Next.js 16) et route `/api/draft` |

## Hébergement

SQLite a besoin d'un disque persistant : utilise un VPS (ou Railway/Fly.io avec volume),
pas Vercel. Sur le serveur : `npm run build && npm start`, et la collecte en cron. La clé
API doit alors autoriser l'IP du serveur.

Images des brawlers et des maps : CDN de Brawlify.
