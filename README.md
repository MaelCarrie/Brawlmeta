# BrawlMeta

Site web en français pour analyser la méta de **Brawl Stars** et préparer ses parties en
**classé**. Il s'appuie sur de vraies parties de joueurs, récupérées via l'API officielle de
Supercell : des centaines de milliers de parties des meilleurs joueurs du monde et de nombreux pays.

> Projet de fan, non affilié à Supercell. Images des brawlers et des maps : CDN de Brawlify.

## Ce qu'on peut faire sur le site

### Tier list de la méta
- Classement de tous les brawlers de **S** à **D**, à partir de leur taux de victoire réel.
- Filtres : **Classé** ou **Trophées**, **mode de jeu** (Razzia de gemmes, Brawlball,
  Braquage, Survivant solo, duo, trio…) et **période** (3, 7, 14 ou 30 jours).
- Tableau détaillé : taux de victoire, nombre de parties, présence (part des parties où le
  brawler est joué).

### Maps et meilleures compos
- Toutes les maps jouées, rangées par mode, avec leurs **noms en français**.
- Pour chaque map : **tier list propre à la map**, **meilleures compos à 3** (ou meilleurs
  duos et trios en Survivant) et détail par brawler.

### Fiches brawlers
- Score et tier du brawler, ses **meilleures et pires maps**, ses **meilleurs coéquipiers**,
  les brawlers qu'il **contre** et ceux qui le **contrent**.
- Historique de ses buffs et nerfs.

### Buffs et nerfs
- Les derniers changements d'équilibrage, filtrables par type (buff, nerf, rework,
  ajustement).

### Assistant draft (classé)
L'outil pour la sélection en classé : tu entres la map, puis les bans et les picks au fur et
à mesure, et le site te propose en direct :
- les **bans conseillés** (les brawlers les plus forts sur la map) ;
- les **meilleurs picks** encore disponibles, avec le détail du calcul : force sur la map,
  **synergie** avec tes alliés, **avantage contre** les adversaires déjà choisis ;
- la **compo conseillée** : ton équipe complétée pick par pick ;
- les **compos qui gagnent** réellement sur cette map et qui restent possibles.

Pour aller vite pendant la partie :
- **Ordre du draft** : choisis « 1er pick : Nous / Eux » ; après les 6 bans, la bonne case
  se sélectionne toute seule (ordre du classé : 1-2-2-1). « Annuler » retire le dernier ajout.
- **Grille triée** du plus fort au plus faible pour le draft en cours, recherche (Entrée
  ajoute le premier résultat).
- **Sur mobile**, les bans et picks restent collés en haut de l'écran avec les conseils
  rapides juste en dessous : un toucher pour ajouter.

### Compte lié et conseils personnalisés
Entre ton **tag joueur** (#XXXX, sur ton profil en jeu) dans l'assistant draft. Avec
« Conseils personnalisés » coché, les recommandations tiennent compte de :
- **tes brawlers** : seuls ceux que tu as débloqués sont proposés ;
- **leur équipement** : -1 % par niveau sous le 11 (max -5 %), -1,5 % sans gadget, -2 % sans
  pouvoir star ;
- **ton winrate perso** : un brawler avec lequel tu fais mieux que d'habitude remonte, un
  brawler que tu rates souvent descend (lissé : quelques parties comptent peu ; plafonné à ±8 %).

L'API ne donne que tes 25 dernières parties : elles sont enregistrées à chaque visite de
l'assistant et à chaque collecte, donc ton historique s'enrichit avec le temps.

## Installation

Il faut **Node.js 24** (ou au moins 22.18) et **npm**.

```bash
git clone https://github.com/MaelCarrie/Brawlmeta.git
cd Brawlmeta
npm install
```

### Essayer sans clé API (données de démo)

```bash
npm run demo     # génère des parties FICTIVES pour tester l'interface
npm run dev      # puis ouvre http://localhost:3000
```

Sans clé, le compte lié et la mise à jour des stats ne fonctionnent pas.

## Mettre à jour les données avec ta propre clé API

La base de données (`data/brawl.db`) **n'est pas sur GitHub** : chaque personne qui installe
le projet a la sienne. N'importe qui peut la remplir et la tenir à jour avec **sa clé API
perso**, gratuite :

1. **Crée une clé** sur https://developer.brawlstars.com (compte gratuit, puis
   « My Account » → « Create New Key »). Indique l'**adresse IP publique** de ton réseau
   (tu la trouves avec `curl ifconfig.me`).
2. **Crée ton fichier de configuration** puis colle ta clé dedans :
   ```bash
   cp .env.example .env
   ```
   ```env
   BS_API_KEY=ta_cle
   ```
   Une clé ne marche que depuis les IP indiquées. Si tu changes souvent de réseau (maison,
   école, partage de connexion…), crée une clé par réseau et mets-les toutes, séparées par
   des virgules : le site utilise automatiquement celle qui marche.
   ```env
   BS_API_KEY=cle_maison,cle_ecole
   ```
3. **Lance la collecte** :
   ```bash
   npm run collect
   ```
   Elle récupère les classements (mondial + pays), puis l'historique de ces joueurs et des
   joueurs croisés dans leurs parties (2000 par défaut, réglable avec `BS_MAX_PLAYERS`).
   Compte quelques minutes. Les données de démo sont supprimées automatiquement.
4. **Relance-la régulièrement** : l'API ne renvoie que les 25 dernières parties de chaque
   joueur, donc plus tu collectes souvent, plus les stats sont fiables. Par exemple toutes les
   heures avec cron (Linux/Mac) :
   ```cron
   0 * * * * cd /chemin/vers/Brawlmeta && npm run collect >> collect.log 2>&1
   ```

**Ne partage jamais ton fichier `.env`** : il est ignoré par git, ne le mets ni sur GitHub
ni dans un message.

### Réglages de la collecte (`.env`)

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `BS_API_KEY` | Clé(s) API, séparées par des virgules | — |
| `BS_BATTLE_TYPES` | Types de parties : `soloRanked` = Classé, `ranked` = Trophées | `soloRanked,ranked` |
| `BS_COUNTRIES` | Classements de départ (`global` + codes pays) | 15 pays |
| `BS_MAX_PLAYERS` | Nombre max de joueurs analysés par collecte | `2000` |
| `BS_CONCURRENCY` | Requêtes en parallèle | `8` |
| `BS_RETENTION_DAYS` | Durée de conservation des parties (jours) | `60` |
| `BS_DEFAULT_DAYS` | Période affichée par défaut (3, 7, 14 ou 30) | `14` |

## Contribuer au contenu

Deux parties du site sont écrites à la main, car aucune API ne les fournit :

- **Buffs et nerfs** : `content/balance-changes.json` (relu à chaque requête, pas besoin de
  redémarrer). Supprime l'entrée `"exemple": true` quand tu ajoutes les vraies notes de patch.
- **Noms des maps en français** : `content/map-names-fr.json` (nom anglais → nom français).
  Certains noms sont des propositions à vérifier en jeu ; une map absente reste en anglais.
  `npm run collect` liste à la fin les maps sans traduction.

## Comment les stats sont calculées

- **Score** : taux de victoire ajusté (moyenne bayésienne). Un brawler peu joué est ramené
  vers 50 % (ou, sur une map, vers son taux global) tant qu'il n'a pas assez de parties.
- **Tiers** : répartis par percentile du score (S = top 10 %, A = 20 % suivants, puis B, C, D).
- **Présence** : part des parties où le brawler est dans l'une des deux équipes. L'API ne
  fournit pas les bans, donc pas de taux de ban.
- **Survivant** : une « victoire » = finir dans la première moitié du classement (top 5 sur 10
  en solo, top 2 sur 4 équipes en trio…), la place du milieu compte comme un nul. Ces modes
  sont exclus de « Tous les modes » et de l'assistant draft.
- **Assistant draft** : score = score du brawler sur la map + synergie moyenne avec tes alliés
  + avantage moyen contre les ennemis choisis (écarts par rapport à son taux habituel), plus
  les bonus/malus perso si le compte est lié.

Limite : l'API ne donne ni les parties en cours ni les bans. L'assistant ne peut donc pas lire
ton draft tout seul, il faut entrer les brawlers à la main.

## Structure du code

| Chemin | Rôle |
| --- | --- |
| `src/app/` | Pages (Next.js 16) et routes `/api/draft`, `/api/player` |
| `src/components/` | Composants d'interface (tier list, filtres, assistant draft…) |
| `src/lib/db.ts` | Base SQLite (`data/brawl.db`, via `node:sqlite`) |
| `src/lib/stats.ts` | Calculs de stats |
| `src/lib/draft.ts` | Moteur de recommandation du draft |
| `src/lib/player.ts`, `src/lib/personal.ts` | Compte lié et stats perso |
| `src/lib/api-key.ts` | Gestion de plusieurs clés API |
| `scripts/collect.ts` | Collecte via l'API officielle |
| `scripts/seed-demo.ts` | Données de démo |
| `content/` | Buffs/nerfs et noms français des maps |

Stack : Next.js 16, React 19, Tailwind CSS 4, SQLite (`node:sqlite`), TypeScript.

## Mettre le site en ligne

SQLite a besoin d'un disque persistant : utilise un VPS (ou Railway/Fly.io avec un volume),
pas Vercel. Sur le serveur : `npm run build && npm start`, et la collecte en cron. La clé API
doit alors autoriser l'IP du serveur.
