# 🤖 Rendre le Mondial 2026 Hub 100 % automatique (cloud 24/7)

Objectif : un robot tourne **tout seul dans le cloud** (toutes les 3 h, même PC éteint),
analyse les matchs du jour + news + classements + résultats avec recherche web,
et publie le tout sur ton site. **Gratuit.**

Pièces déjà codées dans ce dossier :
- `auto-engine.mjs` — le moteur d'analyse (Node, sans dépendance)
- `.github/workflows/auto.yml` — le robot planifié (GitHub Actions)
- `mondial-2026-intelligence-hub.html` — le site, qui lit `data/resultats.json`

---

## Étape 1 — Compte GitHub (2 min, gratuit)
1. Va sur **github.com** → **Sign up** si tu n'as pas de compte.

## Étape 2 — Créer le dépôt
1. **github.com/new** → nom : `mondial2026` → coche **Public** → **Create repository**.
2. Sur la page du dépôt : **Add file → Upload files**.
3. Glisse **tous** les fichiers de ce dossier en gardant l'arborescence :
   - `mondial-2026-intelligence-hub.html`
   - `auto-engine.mjs`
   - le dossier `.github/` (avec `workflows/auto.yml` dedans)
   > Astuce : si le dossier `.github` ne s'uploade pas par glisser-déposer,
   > crée le fichier à la main : **Add file → Create new file**, nomme-le
   > exactement `.github/workflows/auto.yml` et colle le contenu.
4. **Commit changes**.

## Étape 3 — Mettre ta clé API en secret (jamais exposée)
1. Récupère ta clé sur **console.anthropic.com → Settings → API Keys → Create Key** (`sk-ant-…`).
   Ajoute quelques $ de crédit dans **Billing**.
2. Dans ton dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**.
3. Name : `ANTHROPIC_API_KEY` — Secret : colle ta clé `sk-ant-…` → **Add secret**.

## Étape 4 — Lancer le robot une première fois (test)
1. Onglet **Actions** du dépôt → si demandé, clique **I understand my workflows, enable them**.
2. Choisis **« Mondial 2026 — Moteur auto »** → **Run workflow** → **Run workflow**.
3. Attends ~1–3 min. Coche que le job passe au **vert ✅**.
   - En cas d'erreur rouge : clique dessus, lis le log (souvent : clé manquante/sans crédit).
4. Vérifie qu'un fichier **`data/resultats.json`** est apparu dans le dépôt.

À partir de là, il se relance **tout seul toutes les 3 h**. (Modifiable dans `auto.yml`, ligne `cron`.)

## Étape 5 — Publier le site (GitHub Pages)
1. **Settings → Pages → Source : Deploy from a branch → Branch : `main` / `/root` → Save**.
2. Après ~1 min, ton site est en ligne à :
   `https://TON-PSEUDO.github.io/mondial2026/mondial-2026-intelligence-hub.html`
3. Ouvre ce lien : en haut s'affiche **« 🤖 données auto MAJ … »** et les matchs analysés
   par le robot portent le badge **🤖**. Tu peux toujours analyser/ré-analyser à la main
   par-dessus (tes analyses ne sont jamais écrasées par le robot).

---

## Réglages utiles

**Changer la fréquence** — dans `.github/workflows/auto.yml`, ligne `cron` :
- toutes les heures : `'0 * * * *'`
- toutes les 6 h : `'0 */6 * * *'`
- 2× par jour (8h et 20h UTC) : `'0 8,20 * * *'`
> ⚠️ Plus c'est fréquent, plus ça consomme de crédit API. Toutes les 3 h est un bon équilibre.

**Maîtriser le coût** — chaque cycle = briefing + news + (2 appels × matchs du jour)
+ classements + résultats. Les jours sans match, c'est quasi gratuit ; les grosses journées,
compte quelques dizaines d'appels. Surveille ta conso sur console.anthropic.com.

**Modèle** — dans `auto.yml`, `WC26_MODEL`. `claude-sonnet-4-20250514` = bon rapport
qualité/prix. Mets un modèle Opus pour plus de finesse (plus cher).

---

## Variante : tout en local (PC allumé, sans cloud)
Si tu préfères ne pas utiliser GitHub :
1. Installe **Node.js** (nodejs.org, version LTS).
2. Dans ce dossier, ouvre PowerShell et lance :
   ```powershell
   $env:ANTHROPIC_API_KEY="sk-ant-..."
   node auto-engine.mjs
   ```
   Ça génère `data/resultats.json`.
3. Pour l'automatiser : **Planificateur de tâches Windows → Créer une tâche** →
   déclencheur « toutes les 3 heures » → action « démarrer un programme » :
   `node` avec argument `auto-engine.mjs` et « commencer dans » = ce dossier.
   (Pense à définir la variable `ANTHROPIC_API_KEY` dans les variables d'environnement Windows.)
4. Ouvre le `.html` par double-clic — il lira le `data/resultats.json` local.
   > Limite : le robot ne tourne que **quand ton PC est allumé**.

---

## Rappel responsable
Les analyses et probabilités restent des **estimations**, jamais des certitudes.
Le moteur ne parie pas à ta place et n'invente rien (s'il ne trouve pas une info, il l'écrit).
Les paris sportifs comportent un risque réel de perte. 18+ · joue responsable · SOS-Jeu.ch.
