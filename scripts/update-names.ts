// Récupère les noms officiels du jeu en français (brawlers, maps) et la classe
// de chaque brawler (Tank, Soutien…), puis les écrit dans content/noms-fr.json.
// Usage : npm run noms (aussi lancé automatiquement au début de chaque collecte).
//
// Source : BrawlAPI (api.brawlapi.com), qui republie les fichiers du jeu :
// - csv_logic/characters et csv_logic/locations : id du brawler / de la map -> TID (clé de texte) ;
// - localization/fr et localization/texts : TID -> texte français / anglais.
// Les noms viennent donc des mêmes lignes que celles affichées en jeu.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.brawlapi.com";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "content", "noms-fr.json");

/** Ordre d'affichage des classes dans l'assistant draft. */
const CLASS_ORDER = ["tank", "assassin", "damage_dealer", "marksman", "artillery", "controller", "support"];

type Rows = Record<string, Record<string, unknown>>;

async function get<T>(p: string): Promise<T> {
  const res = await fetch(API + p, { headers: { "user-agent": "BrawlMeta (projet de fan)" } });
  if (!res.ok) throw new Error(`${p} : HTTP ${res.status}`);
  return (await res.json()) as T;
}
const raw = async (file: string) => (await get<{ data: Rows }>(`/v2/raw/${file}`)).data;

/** "EL COSTO" -> "El Costo", "D'JINN" -> "D'Jinn" */
function titleCase(s: string): string {
  return s.toLocaleLowerCase("fr").replace(/(^|[\s\-.&'’])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toLocaleUpperCase("fr"));
}
/** "DÉGÂTS BRUTS" -> "Dégâts bruts" */
function sentenceCase(s: string): string {
  const low = s.toLocaleLowerCase("fr");
  return low.charAt(0).toLocaleUpperCase("fr") + low.slice(1);
}
const isShouting = (s: string) => s === s.toLocaleUpperCase("fr") && s !== s.toLocaleLowerCase("fr");

export type NomsFr = {
  _aide: string;
  classes: Record<string, string>;
  brawlers: Record<string, { en: string; nom: string; classe: string | null }>;
  maps: Record<string, string>;
};

export async function updateNames(log: (msg: string) => void = console.log): Promise<boolean> {
  const [roster, characters, locations, fr, en] = await Promise.all([
    get<{ list: { id: number; name: string }[] }>("/v1/brawlers"),
    raw("csv_logic/characters"),
    raw("csv_logic/locations"),
    raw("localization/fr"),
    raw("localization/texts"),
  ]);
  const frText = (tid: unknown) => (typeof tid === "string" ? (fr[tid]?.FR as string | undefined)?.trim() : undefined);
  const enText = (tid: unknown) => (typeof tid === "string" ? (en[tid]?.EN as string | undefined)?.trim() : undefined);

  // Une version en minuscules du nom existe parfois ailleurs dans les textes du jeu :
  // on la préfère au nom tout en majuscules des boutons.
  const mixedCase = new Map<string, string>();
  for (const row of Object.values(fr)) {
    const v = typeof row.FR === "string" ? row.FR.trim() : "";
    if (v && v.length <= 30 && !isShouting(v)) {
      const key = v.toLocaleUpperCase("fr");
      if (!mixedCase.has(key)) mixedCase.set(key, v);
    }
  }

  const charById = new Map(Object.values(characters).map((r) => [Number(r.id), r]));
  const brawlers: NomsFr["brawlers"] = {};
  for (const b of [...roster.list].sort((a, z) => a.id - z.id)) {
    const row = charById.get(b.id);
    const frName = frText(row?.TID);
    const enName = (enText(row?.TID) ?? b.name).toUpperCase();
    const nom = frName ? (isShouting(frName) ? (mixedCase.get(frName) ?? titleCase(frName)) : frName) : titleCase(b.name);
    const classe = typeof row?.ClassArchetype === "string" ? row.ClassArchetype : null;
    brawlers[b.id] = { en: enName, nom, classe };
  }

  const classes: Record<string, string> = {};
  for (const c of CLASS_ORDER) {
    const label = frText(`TID_CLASS_ARCHETYPE_${c.toUpperCase()}`);
    classes[c] = label ? sentenceCase(label) : c;
  }

  // Plusieurs lignes peuvent porter le même nom anglais : on garde la traduction la plus fréquente.
  const votes = new Map<string, Map<string, number>>();
  for (const loc of Object.values(locations)) {
    const e = enText(loc.TID);
    const f = frText(loc.TID);
    if (!e || !f) continue;
    const m = votes.get(e) ?? new Map<string, number>();
    m.set(f, (m.get(f) ?? 0) + 1);
    votes.set(e, m);
  }
  const maps: Record<string, string> = {};
  for (const e of [...votes.keys()].sort((a, z) => a.localeCompare(z))) {
    maps[e] = [...votes.get(e)!].sort((a, z) => z[1] - a[1])[0][0];
  }

  const data: NomsFr = {
    _aide:
      "Fichier généré par `npm run noms` (et à chaque collecte) à partir des textes officiels du jeu. Ne pas modifier à la main : il sera écrasé.",
    classes,
    brawlers,
    maps,
  };
  const text = JSON.stringify(data, null, 2) + "\n";
  let previous = "";
  try {
    previous = readFileSync(OUT, "utf8");
  } catch {}
  if (previous === text) {
    log(`Noms français à jour (${Object.keys(brawlers).length} brawlers, ${Object.keys(maps).length} maps).`);
    return false;
  }
  writeFileSync(OUT, text);
  log(`Noms français mis à jour : ${Object.keys(brawlers).length} brawlers, ${Object.keys(maps).length} maps.`);
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  updateNames().catch((e) => {
    console.error("Impossible de récupérer les noms français :", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
