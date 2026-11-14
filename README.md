# Entropos

Saisie des fiches d'entrée des entrepôts 1 à 4, liste triable, et exports Excel
(« Situation du stock » et « Fiche d'entrée »).

AdonisJS 7 · Inertia · Vue 3 · PostgreSQL · ExcelJS. Node 24+.

## Fonctionnalités

- **Connexion uniquement** (pas d'inscription, pas de mot de passe oublié). Les comptes
  sont créés en ligne de commande (`users:create`).
- **Formulaire d'entrée** : tous les champs sont facultatifs.
  - Le N° ordre est pré-rempli avec le prochain numéro de l'entrepôt choisi.
  - L'entrepôt par défaut est le dernier utilisé.
  - La destination par défaut est Marrakech.
  - La désignation est pré-remplie à partir d'un code article déjà connu.
  - L'écart réception est calculé : Qté reçue − Qté BL.
- **Liste des entrées** :
  - tri par date, entrepôt, N° ordre, code, fournisseur, marché, quantité, statut ou quai ;
  - filtres par entrepôt, période, fournisseur et statut, plus une recherche libre ;
  - modification, et suppression avec confirmation.
- **Exports Excel** :
  - _Situation du stock_ : quantités reçues par article et par entrepôt jusqu'à une date ;
  - _Fiche d'entrée_ : déchargements d'une journée, éventuellement pour un seul entrepôt.

## Développement

```bash
cp .env.example .env
node ace generate:key
# DATABASE_URL=postgres://user:password@localhost:5432/entropos
npm install
node ace migration:run
node ace users:create admin@entropos.app   # affiche le mot de passe généré
npm run dev
```

## Commandes

| Commande | Rôle |
| --- | --- |
| `node ace users:create <email> [--password=…]` | Crée un compte, ou réinitialise son mot de passe. Sans `--password`, un mot de passe fort est généré et affiché. |
| `node ace import:excel <ORIGINE.xlsx> [--fiche=<fiche.xlsx>] [--dry-run]` | Importe les feuilles `ENTREPOT 1` à `ENTREPOT 4`. Relancer la commande remplace l'import précédent, sans doublons. Les fichiers `--fiche` complètent Départ, Destination et Transporteur (rapprochement par date et matricule). |

Règles de l'import (fichier ORIGINE) :

- **Qté reçue** : colonne « Qté Recus » ou « Qté Commandée ».
- **Qté BL**, calculée à partir de l'ancien écart :
  - un nombre X donne Qté BL = reçue − X ;
  - « MOIN(S) X » donne Qté BL = reçue + X ;
  - un écart vide, ou un résultat négatif, donne Qté BL = reçue.
- **N° ordre** manquant : le prochain numéro de la feuille est attribué.
- **Nettoyage** : les valeurs `0` deviennent vides, les statuts sont normalisés et la
  destination est fixée à Marrakech.
- Les lignes de total (formules `SUM`) sont ignorées.

Les fichiers Excel contiennent des données personnelles : ils sont exclus du dépôt
(`*.xlsx` dans `.gitignore`). L'import se lance depuis un poste local vers la base de
production, en utilisant son URL publique :

```bash
DATABASE_URL="<DATABASE_PUBLIC_URL de Railway>" node ace import:excel "FICHE D'ENTRE ….xlsx" --fiche="FICHE D'entree ….xlsx"
```

### Sans accès shell au serveur

Avant chaque déploiement, `npm run predeploy` lance les migrations puis
`app:bootstrap`. Cette commande lit des variables d'environnement facultatives :

- `ADMIN_EMAIL` + `ADMIN_PASSWORD` : crée ce compte s'il n'existe pas (un compte
  existant n'est jamais modifié). Supprimez `ADMIN_PASSWORD` une fois le compte créé.
- `IMPORT_ORIGINE_B64` (+ `IMPORT_FICHE_B64`) : contenu des classeurs Excel en base64
  (éventuellement gzippé). Ils sont importés avec les mêmes règles que `import:excel`.
  Supprimez ces variables une fois l'import fait.

## Déploiement (Railway)

`railway.json` définit les commandes :

- build : `npm run build`
- pré-déploiement : `npm run predeploy` (migrations, puis `app:bootstrap`)
- démarrage : `node build/bin/server.js`

Variables d'environnement du service :

```
NODE_ENV=production
HOST=0.0.0.0
TZ=UTC
LOG_LEVEL=info
SESSION_DRIVER=cookie
APP_KEY=<node ace generate:key --show>
DATABASE_URL=${{Postgres.DATABASE_URL}}
```
