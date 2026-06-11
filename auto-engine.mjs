/* =====================================================================
   MONDIAL 2026 INTELLIGENCE HUB — MOTEUR AUTOMATIQUE
   Tourne en cloud (GitHub Actions) ou en local (node auto-engine.mjs).
   À chaque exécution : news + briefing + analyse des matchs du jour
   + classements + résultats. Écrit data/resultats.json que le site lit.
   Aucune dépendance npm (Node 18+ : fetch & fs natifs).
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const KEY   = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.WC26_MODEL || 'claude-sonnet-4-20250514';
const OUT   = 'data/resultats.json';
if (!KEY) { console.error('❌ ANTHROPIC_API_KEY manquante (secret GitHub ou variable d\'env).'); process.exit(1); }

/* ---------- Données (identiques au site) ---------- */
const GROUPES = {
  A:[["Mexique","🇲🇽"],["Afrique du Sud","🇿🇦"],["Corée du Sud","🇰🇷"],["Tchéquie","🇨🇿"]],
  B:[["Canada","🇨🇦"],["Bosnie-Herzégovine","🇧🇦"],["Qatar","🇶🇦"],["Suisse","🇨🇭"]],
  C:[["Brésil","🇧🇷"],["Maroc","🇲🇦"],["Haïti","🇭🇹"],["Écosse","🏴󠁧󠁢󠁳󠁣󠁴󠁿"]],
  D:[["États-Unis","🇺🇸"],["Paraguay","🇵🇾"],["Australie","🇦🇺"],["Turquie","🇹🇷"]],
  E:[["Allemagne","🇩🇪"],["Curaçao","🇨🇼"],["Côte d'Ivoire","🇨🇮"],["Équateur","🇪🇨"]],
  F:[["Pays-Bas","🇳🇱"],["Japon","🇯🇵"],["Suède","🇸🇪"],["Tunisie","🇹🇳"]],
  G:[["Belgique","🇧🇪"],["Égypte","🇪🇬"],["Iran","🇮🇷"],["Nouvelle-Zélande","🇳🇿"]],
  H:[["Espagne","🇪🇸"],["Cap-Vert","🇨🇻"],["Arabie saoudite","🇸🇦"],["Uruguay","🇺🇾"]],
  I:[["France","🇫🇷"],["Sénégal","🇸🇳"],["Irak","🇮🇶"],["Norvège","🇳🇴"]],
  J:[["Argentine","🇦🇷"],["Algérie","🇩🇿"],["Autriche","🇦🇹"],["Jordanie","🇯🇴"]],
  K:[["Portugal","🇵🇹"],["Colombie","🇨🇴"],["Ouzbékistan","🇺🇿"],["RD Congo","🇨🇩"]],
  L:[["Angleterre","🏴󠁧󠁢󠁥󠁮󠁧󠁿"],["Croatie","🇭🇷"],["Panama","🇵🇦"],["Ghana","🇬🇭"]]
};
const JOURNEES = {1:"J1 · 11–17 juin",2:"J2 · 18–23 juin",3:"J3 · 24–27 juin"};
const SCHEMA = {1:[[0,1],[2,3]],2:[[0,2],[3,1]],3:[[3,0],[1,2]]};
const MATCHS = [];
for (const g of Object.keys(GROUPES)) for (const j of [1,2,3]) for (const [a,b] of SCHEMA[j])
  MATCHS.push({ id:`G${g}-J${j}-${a}${b}`, groupe:g, journee:j, eqA:GROUPES[g][a], eqB:GROUPES[g][b] });

/* ---------- Appel IA avec recherche web ---------- */
const ANTI_HALLU = `RÈGLES STRICTES : n'invente JAMAIS un résultat, une blessure, une compo, une cote, une météo ou un classement. Si une donnée n'est pas trouvée/vérifiée via la recherche web, écris exactement "Non confirmé — à vérifier". Sépare faits vérifiés et estimations. Sois neutre, prudent, factuel. Les probabilités sont tes estimations, pas des certitudes.`;
async function callIA(prompt, maxTokens=1400, tries=3){
  for (let k=1;k<=tries;k++){
    try{
      const resp = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{ 'Content-Type':'application/json','x-api-key':KEY,'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model:MODEL, max_tokens:maxTokens,
          messages:[{role:'user',content:prompt}],
          tools:[{type:'web_search_20250305',name:'web_search',max_uses:4}] })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message||'API error');
      const txt = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
      const clean = txt.replace(/```json|```/g,'').trim();
      const s=clean.indexOf('{'), e=clean.lastIndexOf('}');
      if (s===-1||e===-1) throw new Error('réponse non structurée');
      return JSON.parse(clean.slice(s,e+1));
    }catch(err){
      console.warn(`  ⚠️ tentative ${k}/${tries} : ${err.message}`);
      if (k===tries) return null;
      await new Promise(r=>setTimeout(r, 2500*k));
    }
  }
}

/* ---------- Prompts (mêmes formats que le site) ---------- */
const dStr = () => new Date().toLocaleString('fr-CH',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Zurich'});
const pBriefing = () => `Analyste football. Coupe du monde 2026 (USA/Canada/Mexique). Nous sommes le ${dStr()}.
${ANTI_HALLU}
UTILISE la recherche web (2-3 recherches) : matchs du Mondial 2026 prévus AUJOURD'HUI (heure suisse/CET), dernières actus (blessures, compos, météo).
Réponds UNIQUEMENT en JSON valide, français :
{"matchs":[{"affiche":"Équipe A vs Équipe B","heure":"heure (fuseau)","stade":"stade, ville","groupe":"A","badges":["🔥"],"note":"enjeu en 1 phrase"}],
"top":"match du jour le plus intéressant + pourquoi","eviter":"match le plus piégeux + pourquoi","alertes":["actu 1","actu 2"],"fraicheur":"date/heure"}
Si aucun match aujourd'hui : "matchs":[] et explique dans "alertes".`;
const pNews = () => `Veilleur sportif. Coupe du monde 2026. Nous sommes le ${dStr()}.
${ANTI_HALLU}
UTILISE la recherche web (3-4 recherches) : actus des DERNIÈRES 24H — blessures/forfaits, compos officielles, résultats, météo, suspensions. Infos vérifiables et datées uniquement.
Réponds UNIQUEMENT en JSON valide, français :
{"items":[{"niveau":"critique|important|info","cat":"blessure|compo|resultat|meteo|suspension|cote|autre","titre":"titre court","detail":"1-2 phrases","equipes":["Pays"],"quand":"fraîcheur"}],
"resume":"synthèse en 1 phrase","fraicheur":"date/heure"}
Classe du plus important au moins important. Si rien : "items":[].`;
const pTerrain = (a,b,ctx) => `Analyste football professionnel. Coupe du monde 2026, pendant le tournoi. Match : ${a} vs ${b} — ${ctx}.
${ANTI_HALLU}
UTILISE la recherche web (3 recherches max) : date/heure/stade, résultats déjà joués + classement du groupe, forme, blessés/suspendus, conditions.
Réponds UNIQUEMENT en JSON valide, français, dense :
{"resume":{"date":"date+heure (heure suisse si possible)","stade":"stade, ville","enjeu":"enjeu réel","lecture":"lecture en 1 phrase","interet":3},
"contexte":{"classement":"situation des 2 équipes (faits)","conditions":"météo/altitude/voyage ou 'Non confirmé — à vérifier'","pression":"contexte mental/public"},
"forme":{"A":"derniers résultats + dynamique de ${a}","B":"idem ${b}"},
"absences":{"A":"absents de ${a} ou 'Aucune absence majeure trouvée'","B":"idem ${b}","fiable":true},
"tactique":{"styleA":"système+style ${a}","styleB":"idem ${b}","duel":"duel clé","zone":"zone décisive","risque":"risque tactique"},
"scores":{"A":75,"B":60,"detA":{"forme":15,"effectif":16,"tactique":14,"mental":11,"absences":8,"conditions":8,"momentum":4},"detB":{"forme":12,"effectif":13,"tactique":12,"mental":9,"absences":7,"conditions":7,"momentum":3},"commentaire":"justification + incertitude"},
"sources":[{"nom":"source","info":"donnée","date":"fraîcheur"}]}
"interet"=1-5. scores.A/B=/100. detA/detB sous-scores (forme/20,effectif/20,tactique/20,mental/15,absences/10,conditions/10,momentum/5).`;
const pMarche = (a,b,terrain) => `Analyste paris sportifs responsable. Coupe du monde 2026. Match : ${a} vs ${b}.
Terrain (faits) : ${JSON.stringify({resume:terrain.resume,contexte:terrain.contexte,forme:terrain.forme,absences:terrain.absences,tactique:terrain.tactique,scores:terrain.scores})}
${ANTI_HALLU} N'invente AUCUNE cote. "cote_min" = cote minimale pour que le pari vaille selon TA proba (≈ 100/proba +10%). Recommande NO BET si incertitude trop forte.
Réponds UNIQUEMENT en JSON valide, français :
{"probas":{"eqA":45,"nul":25,"eqB":30,"over25":55,"under25":45,"btts":48,"over15":72,"over35":33},
"score_probable":"2-1",
"scenarios":{"dominant":"...","alternatif":"...","pire":"..."},
"marches":[{"marche":"...","verdict":"🟢|🟡|🔴|⚪","proba":62,"cote_min":1.8,"pour":"...","contre":"..."},{"marche":"...","verdict":"🟡","proba":50,"cote_min":2.2,"pour":"...","contre":"..."},{"marche":"...","verdict":"🔴","proba":35,"cote_min":3.2,"pour":"...","contre":"..."},{"marche":"...","verdict":"⚪","proba":40,"cote_min":2.5,"pour":"...","contre":"..."}],
"verdict":{"reco":"pari logique OU 'NO BET'","alternative":"alternative prudente","no_bet":false,"risque":"risque","confiance":"faible|moyenne|élevée","mise":"faible|modérée|aucune"},
"synthese":"1 phrase","incertitude":"faible|moyenne|élevée"}
probas eqA/nul/eqB entiers somme 100, eqA=${a}, eqB=${b}. 4 marchés. Verdicts 🟢/🟡/🔴/⚪.`;
const pClassement = (g) => { const noms=GROUPES[g].map(e=>e[0]).join(', ');
  return `Coupe du monde 2026, pendant le tournoi. Groupe ${g} : ${noms}.
${ANTI_HALLU} Si aucun match joué, classement à 0 et indique-le.
UTILISE la recherche web : classement ACTUEL du groupe ${g} (points, joués, buts) + résultats.
Réponds UNIQUEMENT en JSON valide :
{"classement":[{"nom":"...","pts":0,"j":0,"bp":0,"bc":0}],"resultats":"résultats joués ou 'Aucun match joué'","scenarios":"scénarios qualif (2 phrases)","fraicheur":"date"}
Classe par points décroissants. Noms exacts : ${noms}.`; };
const pResultat = (a,b,ctx) => `Coupe du monde 2026. Le match ${a} vs ${b} (${ctx}) a-t-il déjà été joué ?
${ANTI_HALLU}
UTILISE la recherche web (1 recherche). Réponds UNIQUEMENT en JSON :
{"joue":true,"score":"2-1","vainqueur":"A|nul|B","resume":"1 phrase (buteurs si trouvés)"}
vainqueur "A"=${a},"B"=${b}. Si pas joué : {"joue":false,"score":"","vainqueur":"","resume":"Match pas encore joué"}.`;

/* ---------- Utilitaires ---------- */
const now = () => Date.now();
function matchsDuJour(briefing){
  const aff = (briefing?.matchs||[]).map(x=>(x.affiche||'').toLowerCase());
  if (!aff.length) return [];
  return MATCHS.filter(m => aff.some(a => a.includes(m.eqA[0].toLowerCase()) && a.includes(m.eqB[0].toLowerCase())));
}

/* ---------- Exécution ---------- */
async function main(){
  console.log(`🛰️  Moteur auto — ${dStr()} — modèle ${MODEL}`);
  // base : on repart de l'existant pour conserver l'historique
  let base = { generatedAt:null, news:null, briefing:null, analyses:{}, standings:{} };
  if (existsSync(OUT)) { try { base = JSON.parse(readFileSync(OUT,'utf8')); } catch(e){} }
  base.analyses = base.analyses||{}; base.standings = base.standings||{};

  // 1) Briefing + News
  console.log('📡 Briefing du jour…');
  const brief = await callIA(pBriefing(), 1200);
  if (brief) base.briefing = { data:brief, ts:now() };
  console.log('📰 Scan news…');
  const news = await callIA(pNews(), 1600);
  if (news) base.news = { data:news, ts:now() };

  // 2) Matchs du jour → analyse complète (terrain + marchés)
  const dujour = matchsDuJour(brief);
  console.log(`⚽ ${dujour.length} match(s) du jour à analyser.`);
  const groupesActifs = new Set();
  for (const m of dujour){
    groupesActifs.add(m.groupe);
    console.log(`   → ${m.eqA[0]} vs ${m.eqB[0]} (Gr.${m.groupe})`);
    const terrain = await callIA(pTerrain(m.eqA[0],m.eqB[0],`Groupe ${m.groupe}, ${JOURNEES[m.journee]}`), 1400);
    if (!terrain) continue;
    const marche = await callIA(pMarche(m.eqA[0],m.eqB[0],terrain), 1400);
    base.analyses[m.id] = {
      type:'match', auto:true,
      titre:`${m.eqA[1]} ${m.eqA[0]} vs ${m.eqB[0]} ${m.eqB[1]} · Gr.${m.groupe} ${JOURNEES[m.journee]}`,
      eqA:m.eqA, eqB:m.eqB, terrain, marche, ts:now(),
      cotes: base.analyses[m.id]?.cotes||null, resultat: base.analyses[m.id]?.resultat||null
    };
  }

  // 3) Classements : groupes actifs + ceux déjà suivis (rafraîchis)
  const gMaj = new Set([...groupesActifs, ...Object.keys(base.standings)]);
  console.log(`📊 Classements à actualiser : ${[...gMaj].join(',')||'aucun'}`);
  for (const g of gMaj){
    const data = await callIA(pClassement(g), 900);
    if (data) base.standings[g] = { data, ts:now() };
  }

  // 4) Résultats : tous les matchs analysés sans score
  const aVerifier = Object.entries(base.analyses).filter(([id,A])=>A.type==='match' && !A.resultat?.joue);
  console.log(`🏁 Vérification résultats : ${aVerifier.length} match(s).`);
  for (const [id,A] of aVerifier){
    const r = await callIA(pResultat(A.eqA[0],A.eqB[0],A.titre), 500);
    if (r) base.analyses[id].resultat = r;
  }

  // 5) Value bets (dérivés, calculés ici pour info)
  const value = [];
  for (const [id,A] of Object.entries(base.analyses)){
    (A.marche?.marches||[]).forEach(x=>{ if (x.verdict==='🟢') value.push({ id, titre:A.titre, marche:x.marche, proba:x.proba, cote_min:x.cote_min }); });
  }
  value.sort((a,b)=>(b.proba||0)-(a.proba||0));
  base.value = value;
  base.generatedAt = new Date().toISOString();

  if (!existsSync('data')) mkdirSync('data');
  writeFileSync(OUT, JSON.stringify(base,null,2));
  console.log(`✅ Écrit ${OUT} — ${Object.keys(base.analyses).length} analyses, ${Object.keys(base.standings).length} classements, ${value.length} pistes 🟢.`);
}
main().catch(e=>{ console.error('💥 Échec moteur :', e); process.exit(1); });
