import { LEAGUE_CONFIG } from "./config.js";
import { getWeight } from "./weights.js";

////// Pace projection
const PACE_KEYS = {
  G: "G82",
  A: "A82",
  P: "P82",
  PPP: "PPP82",
  "+/-": "PM82",
  S: "S82",
  BLK: "BLK82",
  HITS: "HITS82",
  W: "W82",
  SA: "SA82",
};

const SKATER_PACE_KEYS = {
  G: "G82",
  A: "A82",
  P: "P82",
  PPP: "PPP82",
  "+/-": "PM82",
  S: "S82",
  BLK: "BLK82",
  HITS: "HITS82",
};

const GOALIE_PACE_KEYS = {
  W: "W82",
  SA: "SA82",
};

function computePaceValues(items) {
  for (const p of items) {
    const keys = p.Gardiens != null ? GOALIE_PACE_KEYS : SKATER_PACE_KEYS;
    const gp = Math.max(Number(p.GP) || 0, 1);
    for (const [cat, key] of Object.entries(keys)) {
      const v = Number(p[cat]) || 0;
      p[key] = Math.round((v / gp) * LEAGUE_CONFIG.paceGames);
    }
  }
}

function paceKeyFor(cat) {
  return PACE_KEYS[cat] || cat;
}

////// Value indexes (weighted pace z-scores)
function ageZScore(pool) {
  const vals = pool.map((p) => Number(p.Age)).filter(Number.isFinite);
  const m = mean(vals);
  const sd = stdev(vals);
  const map = new Map();
  for (const p of pool) {
    const v = Number(p.Age);
    map.set(p, !Number.isFinite(v) || sd === 0 ? 0 : (v - m) / sd);
  }
  return map;
}

function linearSlope(vals) {
  const n = vals.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = mean(vals);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (vals[i] - meanY);
    den += (i - meanX) * (i - meanX);
  }
  return den === 0 ? 0 : num / den;
}

function weightedComposite(p, cats, zMaps, ageMap) {
  let total = 0;
  for (let i = 0; i < cats.length; i++) {
    total += getWeight(cats[i]) * zMaps[i].get(p);
  }
  total += getWeight("Age") * -ageMap.get(p);
  return Math.round(total * 100) / 100;
}

function assignValueIndex(pool, cats, inverted, targetKey) {
  const paceCats = cats.map((c) => paceKeyFor(c));
  const zMaps = categoryZ(paceCats, inverted, pool);
  const ageMap = ageZScore(pool);
  for (const p of pool) p[targetKey] = weightedComposite(p, cats, zMaps, ageMap);
}

function groupValueIndex(data, groupFn, cats, inverted, targetKey, minGP) {
  const groups = new Map();
  for (const p of eligible(data, minGP)) {
    const g = groupFn(p);
    if (g == null) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  for (const group of groups.values()) {
    assignValueIndex(group, cats, inverted, targetKey);
  }
}

function addPlayerValueFields(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const cfg = LEAGUE_CONFIG;
  const pool = eligible(data, cfg.minGP);
  computePaceValues(data);

  const cats = cfg.skaterCategories;
  const inverted = cats.map(() => false);
  assignValueIndex(pool, cats, inverted, "GVI");
  groupValueIndex(
    data,
    (p) => (isForward(p) ? "F" : "D"),
    cats,
    inverted,
    "RVI",
    cfg.minGP,
  );
  return data;
}

function addGoalerValueFields(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const cfg = LEAGUE_CONFIG;
  const pool = eligible(data, cfg.goalieMinGP);
  computePaceValues(data);

  const cats = cfg.goalieCategories;
  const inverted = cats.map((c) => c === "GAA");
  assignValueIndex(pool, cats, inverted, "GVI");
  assignValueIndex(pool, cats, inverted, "RVI");
  return data;
}

function computeAverageGVI(seasonData) {
  const series = new Map();
  for (const season of Object.keys(seasonData)) {
    for (const player of seasonData[season]) {
      const name = player.Joueurs || player.Gardiens;
      if (!series.has(name)) series.set(name, []);
      series.get(name).push({ season, gvi: Number(player.GVI) || 0 });
    }
  }

  const avgMap = new Map();
  const trendMap = new Map();
  const stabMap = new Map();
  for (const [name, list] of series) {
    list.sort((a, b) => (a.season < b.season ? -1 : 1));
    const vals = list.map((s) => s.gvi);
    const m = mean(vals);
    avgMap.set(name, Math.round(m * 100) / 100);
    trendMap.set(name, Math.round(linearSlope(vals) * 100) / 100);
    const sd = stdev(vals);
    const cv = m === 0 ? 0 : sd / Math.abs(m);
    stabMap.set(name, Math.round((1 / (1 + cv)) * 100) / 100);
  }
  return { avgMap, trendMap, stabMap };
}

const SKATER_RANK_CONFIG = [
  { key: "G", rankKey: "rankG", ascending: false },
  { key: "A", rankKey: "rankA", ascending: false },
  { key: "P", rankKey: "rankP", ascending: false },
  { key: "PPP", rankKey: "rankPPP", ascending: false },
  { key: "+/-", rankKey: "rankPM", ascending: false },
];

const GOALIE_RANK_CONFIG = [
  { key: "W", rankKey: "rankW", ascending: false },
  { key: "SV%", rankKey: "rankSV", ascending: false },
  { key: "GAA", rankKey: "rankGAA", ascending: true },
];

function addCategoryRanks(data, config) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const poolSize = data.length;

  for (const { key, rankKey, ascending } of config) {
    const sorted = [...data].sort((a, b) => {
      const av = Number(a[key]);
      const bv = Number(b[key]);
      const aSafe = Number.isFinite(av) ? av : ascending ? Infinity : -Infinity;
      const bSafe = Number.isFinite(bv) ? bv : ascending ? Infinity : -Infinity;
      return ascending ? aSafe - bSafe : bSafe - aSafe;
    });
    const rankMap = new Map();
    sorted.forEach((player, i) => rankMap.set(player, i + 1));
    for (const player of data) player[rankKey] = rankMap.get(player);
  }

  for (const player of data) player.poolSize = poolSize;
  return data;
}

////// Roto value (Z-score)
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(
    arr.reduce((sum, v) => sum + (v - m) * (v - m), 0) / arr.length,
  );
}

function eligible(data, minGP) {
  return data.filter((p) => (Number(p.GP) || 0) >= minGP);
}

function categoryZ(cats, inverted, pool) {
  return cats.map((cat, i) => {
    const vals = [];
    for (const p of pool) {
      const v = Number(p[cat]);
      if (Number.isFinite(v)) vals.push(v);
    }
    const m = mean(vals);
    const sd = stdev(vals);
    const zMap = new Map();
    for (const p of pool) {
      const v = Number(p[cat]);
      if (!Number.isFinite(v)) {
        zMap.set(p, 0);
        continue;
      }
      const z = sd === 0 ? 0 : (v - m) / sd;
      zMap.set(p, inverted[i] ? -z : z);
    }
    return zMap;
  });
}

function assignRoto(pool, cats, inverted, targetKey, weightList) {
  const zMaps = categoryZ(cats, inverted, pool);
  for (const p of pool) {
    let total = 0;
    for (let i = 0; i < cats.length; i++) {
      total +=
        (weightList ? weightList[i] : getWeight(cats[i])) * zMaps[i].get(p);
    }
    p[targetKey] = Math.round(total * 100) / 100;
  }
}

function groupRoto(data, groupFn, cats, inverted, targetKey, minGP, weightList) {
  const groups = new Map();
  for (const p of eligible(data, minGP)) {
    const g = groupFn(p);
    if (g == null) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  for (const group of groups.values()) {
    assignRoto(group, cats, inverted, targetKey, weightList);
  }
}

function computeZScores(players, cats, inverted) {
  const pool = eligible(players, LEAGUE_CONFIG.minGP);
  const zMaps = categoryZ(cats, inverted, pool);
  const result = new Map();
  for (const p of pool) {
    const perCat = {};
    for (let i = 0; i < cats.length; i++) {
      perCat[cats[i]] = Math.round(zMaps[i].get(p) * 100) / 100;
    }
    result.set(p, perCat);
  }
  return result;
}

function computeGoalieZScores(goalies, cats, inverted) {
  const pool = eligible(goalies, LEAGUE_CONFIG.goalieMinGP);
  const zMaps = categoryZ(cats, inverted, pool);
  const result = new Map();
  for (const p of pool) {
    const perCat = {};
    for (let i = 0; i < cats.length; i++) {
      perCat[cats[i]] = Math.round(zMaps[i].get(p) * 100) / 100;
    }
    result.set(p, perCat);
  }
  return result;
}

function zScoresFor(pool, cats, inverted) {
  const zMaps = categoryZ(cats, inverted, pool);
  const result = new Map();
  for (const p of pool) {
    const perCat = {};
    for (let i = 0; i < cats.length; i++) {
      perCat[cats[i]] = Math.round(zMaps[i].get(p) * 100) / 100;
    }
    result.set(p, perCat);
  }
  return result;
}

function isForward(p) {
  return !(p.Position && p.Position.includes("D"));
}

function positionCode(p) {
  for (const code of ["C", "L", "R", "D"]) {
    if (p.Position && p.Position.includes(code)) return code;
  }
  return null;
}

function computeRadarZScores(players, leaguePool, mode, cats, inverted, minGP) {
  if (mode === "selected") {
    return zScoresFor(eligible(players, minGP), cats, inverted);
  }
  if (mode === "league") {
    return zScoresFor(eligible(leaguePool, minGP), cats, inverted);
  }

  if (mode === "group") {
    const groupZ = zScoresFor(
      eligible(leaguePool.filter(isForward), minGP),
      cats,
      inverted,
    );
    const defenceZ = zScoresFor(
      eligible(leaguePool.filter((p) => !isForward(p)), minGP),
      cats,
      inverted,
    );
    const result = new Map();
    for (const p of players) {
      const zMap = isForward(p) ? groupZ : defenceZ;
      const z = zMap.get(p);
      if (z) result.set(p, z);
    }
    return result;
  }

  const positionZ = new Map();
  for (const code of ["C", "L", "R", "D"]) {
    positionZ.set(
      code,
      zScoresFor(
        eligible(leaguePool.filter((p) => positionCode(p) === code), minGP),
        cats,
        inverted,
      ),
    );
  }
  const result = new Map();
  for (const p of players) {
    const zMap = positionZ.get(positionCode(p));
    if (!zMap) continue;
    const z = zMap.get(p);
    if (z) result.set(p, z);
  }
  return result;
}

function computeRotoValues(players, cats = LEAGUE_CONFIG.rotoCategories) {
  const cfg = LEAGUE_CONFIG;
  const inverted = cats.map(() => false);
  const pool = eligible(players, cfg.minGP);
  computePaceValues(players);

  const weightList = cats.map((c) => getWeight(c));
  assignRoto(pool, cats, inverted, "RotoVal", weightList);
  groupRoto(
    players,
    (p) => (p.Position && p.Position.includes("D") ? "D" : "F"),
    cats,
    inverted,
    "RotoVal-Pos",
    cfg.minGP,
    weightList,
  );
  groupRoto(
    players,
    (p) => {
      for (const code of ["C", "L", "R", "D"]) {
        if (p.Position && p.Position.includes(code)) return code;
      }
      return null;
    },
    cats,
    inverted,
    "RotoVal-PosExact",
    cfg.minGP,
    weightList,
  );

  const included = new Set(cats);
  const paceCats = [];
  const paceWeights = [];
  for (const [stat, key] of Object.entries(PACE_KEYS)) {
    if (!included.has(stat)) continue;
    paceCats.push(key);
    paceWeights.push(getWeight(stat));
  }
  assignRoto(
    pool,
    paceCats,
    paceCats.map(() => false),
    "RotoVal-Pace",
    paceWeights,
  );
}

function computeGoalieRotoValues(goalies, cats = LEAGUE_CONFIG.goalieRotoCategories) {
  const cfg = LEAGUE_CONFIG;
  const inverted = cats.map((c) => c === "GAA");
  const pool = eligible(goalies, cfg.goalieMinGP);
  computePaceValues(goalies);

  const weightList = cats.map((c) => getWeight(c));
  assignRoto(pool, cats, inverted, "RotoVal", weightList);

  const collected = [];
  for (const c of cats) {
    if (c === "W") collected.push(["W82", false]);
    else if (c === "SA") collected.push(["SA82", false]);
    else if (c === "SV%") collected.push(["SV%", false]);
    else if (c === "GAA") collected.push(["GAA", true]);
  }
  const paceCats = collected.map(([k]) => k);
  const paceInverted = collected.map(([, inv]) => inv);
  const paceWeights = collected.map(([k]) =>
    getWeight(k === "W82" ? "W" : k === "SA82" ? "SA" : k),
  );
  assignRoto(pool, paceCats, paceInverted, "RotoVal-Pace", paceWeights);
}

export {
  addPlayerValueFields,
  addGoalerValueFields,
  addCategoryRanks,
  SKATER_RANK_CONFIG,
  GOALIE_RANK_CONFIG,
  computeAverageGVI,
  computeRotoValues,
  computeGoalieRotoValues,
  computeZScores,
  computeGoalieZScores,
  computeRadarZScores,
};
