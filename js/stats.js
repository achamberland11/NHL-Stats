import { LEAGUE_CONFIG, VALUE_WEIGHTS } from "./config.js";

////// Calculer moyennes
function calculerMoyenneGoals(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var goals = 0;

  data.forEach((player) => {
    const playerGoals = Number(player.G) || 0;
    goals += playerGoals;
  });

  return goals / data.length;
}

function calculerMoyenneAssists(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var assists = 0;

  data.forEach((player) => {
    const playerAssists = Number(player.A) || 0;
    assists += playerAssists;
  });

  return assists / data.length;
}

function calculerMoyennePoints(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var points = 0;

  data.forEach((player) => {
    const playerPoints = Number(player.P) || 0;
    points += playerPoints;
  });

  return points / data.length;
}

function calculerMoyennePPPoints(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var ppPoints = 0;

  data.forEach((player) => {
    const playerPPPoints = Number(player.PPP) || 0;
    ppPoints += playerPPPoints;
  });

  return ppPoints / data.length;
}

/// Goalies
function calculerMoyenneWin(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var wins = 0;

  data.forEach((goaler) => {
    const goalerWins = Number(goaler.W) || 0;
    wins += goalerWins;
  });

  return wins / data.length;
}

function calculerMoyenneSAV(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var sav = 0;

  data.forEach((goaler) => {
    const goealerSAV = Number(goaler["SV%"]);
    sav += goealerSAV;
  });

  return sav / data.length;
}

function calculerMoyenneGAA(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var gaa = 0;

  data.forEach((goaler) => {
    const goalerGAA = Number(goaler.GAA);
    gaa += goalerGAA;
  });

  return gaa / data.length;
}

/// Player Value Index et Relative Value Index
function calculerPlayerValueIndex(data, player) {
  var moyenneGoals = calculerMoyenneGoals(data);
  var moyenneAssists = calculerMoyenneAssists(data);
  var moyennePoints = calculerMoyennePoints(data);
  var moyennePPPoints = calculerMoyennePPPoints(data);

  var {
    goalsWeight,
    assistWeight,
    pointsWeight,
    plusMinusWeight,
    ppPointsWeight,
    statsWeight,
    ageWeight,
    skaterAgePeak,
  } = VALUE_WEIGHTS;

  const goals = Number(player.G) || 0;
  const assists = Number(player.A) || 0;
  const points = Number(player.P) || 0;
  const plusMinus = Number(player["+/-"]) || 0;
  const ppPoints = Number(player.PPP) || 0;
  const age = Number(player.Age) || 0;
  const GP = Number(player.GP) || 1;

  var goalsValue = goalsWeight * (goals / moyenneGoals) + goals;
  var assistsValue = assistWeight * (assists / moyenneAssists) + assists;
  var pointsValue = pointsWeight * (points / moyennePoints) + points;
  var plusMinusValue = plusMinusWeight * plusMinus;
  var ppPointsValue = ppPointsWeight * (ppPoints / moyennePPPoints) + ppPoints;

  var stats =
    goalsValue + assistsValue + pointsValue + plusMinusValue + ppPointsValue;
  var statsValue = (stats + stats / GP) * statsWeight;
  var ageValue = ageWeight * (1 - (age - skaterAgePeak) / skaterAgePeak);

  var playerValue = statsValue + ageValue;
  playerValue /= 100;

  return Math.round(playerValue * 100) / 100;
}

function calculerGoalerValueIndex(data, goaler) {
  var moyenneWin = calculerMoyenneWin(data);
  var moyenneSAV = calculerMoyenneSAV(data);
  var moyenneGAA = calculerMoyenneGAA(data);

  var {
    winWeight,
    saveWeight,
    gaaWeight,
    gpWeight,
    goalieAgeWeight,
    goalieAgePeak,
  } = VALUE_WEIGHTS;

  const win = Number(goaler.W) || 0;
  const sav = Number(goaler["SV%"]) || 0;
  const gaa = Number(goaler.GAA) || 0;
  const age = Number(goaler.Age) || 0;
  const GP = Number(goaler.GP) || 1;

  var winValue = winWeight * win + win / GP + win / moyenneWin;
  var SAVValue = saveWeight * sav + sav / moyenneSAV;
  var GAAValue = gaaWeight * gaa + gaa / moyenneGAA;
  var GPValue = gpWeight * GP;

  var statsValue = winValue + SAVValue - GAAValue + GPValue;
  var ageValue = goalieAgeWeight * (1 - (age - goalieAgePeak) / goalieAgePeak);

  var goalerValue = statsValue + ageValue;

  return Math.round(goalerValue * 100) / 100;
}

function calculerMoyenneRVI(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var PlayersValue = 0;

  data.forEach((player) => {
    const playerValue = Number(player["RVI"]);
    PlayersValue += playerValue;
  });

  return PlayersValue / data.length;
}

function computeAverageGVI(seasonData) {
  const gviSums = new Map();
  const gviCounts = new Map();

  for (const players of Object.values(seasonData)) {
    for (const player of players){
      const name = player.Joueurs || player.Gardiens;
      const gvi = Number(player.GVI) || 0;
      gviSums.set(name, (gviSums.get(name) || 0) + gvi);
      gviCounts.set(name, (gviCounts.get(name) || 0) + 1);
    }
  }

  const avgMap = new Map();
  for (const [name, sum] of gviSums) {
    avgMap.set(name, Math.round((sum / gviCounts.get(name)) * 100) / 100);
  }

  return avgMap;
}

////// Ajouter les fields qui ne sont pas encore intégré
// Player Value Index
function addPlayerValueFields(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  data.forEach((player) => {
    var RVI = calculerPlayerValueIndex(data, player);
    var GVI = calculerPlayerValueIndex(data, player);
    player["RVI"] = RVI;
    player["GVI"] = GVI;
  });
  return data;
}

function addGoalerValueFields(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  data.forEach((goaler) => {
    var GVI = calculerGoalerValueIndex(data, goaler);
    goaler["GVI"] = GVI;
  });
  return data;
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
const PACE_COLS = [
  { stat: "G", paceKey: "G82" },
  { stat: "A", paceKey: "A82" },
  { stat: "P", paceKey: "P82" },
  { stat: "PPP", paceKey: "PPP82" },
  { stat: "+/-", paceKey: "PM82" },
];

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

function assignRoto(pool, cats, inverted, targetKey) {
  const weights = LEAGUE_CONFIG.categoryWeights;
  const zMaps = categoryZ(cats, inverted, pool);
  for (const p of pool) {
    let total = 0;
    for (let i = 0; i < cats.length; i++) {
      total += (weights[cats[i]] ?? 1) * zMaps[i].get(p);
    }
    p[targetKey] = Math.round(total * 100) / 100;
  }
}

function groupRoto(data, groupFn, cats, inverted, targetKey, minGP) {
  const groups = new Map();
  for (const p of eligible(data, minGP)) {
    const g = groupFn(p);
    if (g == null) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  for (const group of groups.values()) {
    assignRoto(group, cats, inverted, targetKey);
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

function computeRotoValues(players) {
  const cfg = LEAGUE_CONFIG;
  const cats = cfg.skaterCategories;
  const inverted = cats.map(() => false);
  const pool = eligible(players, cfg.minGP);

  for (const p of players) {
    const gp = Math.max(Number(p.GP) || 0, 1);
    for (const { stat, paceKey } of PACE_COLS) {
      p[paceKey] = Math.round(((Number(p[stat]) || 0) / gp) * cfg.paceGames);
    }
  }

  assignRoto(pool, cats, inverted, "RotoVal");
  groupRoto(
    players,
    (p) => (p.Position && p.Position.includes("D") ? "D" : "F"),
    cats,
    inverted,
    "RotoVal-Pos",
    cfg.minGP,
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
  );

  const paceCats = PACE_COLS.map((c) => c.paceKey);
  assignRoto(pool, paceCats, inverted, "RotoVal-Pace");
}

function computeGoalieRotoValues(goalies) {
  const cfg = LEAGUE_CONFIG;
  const cats = cfg.goalieCategories;
  const inverted = [false, false, true];
  const pool = eligible(goalies, cfg.goalieMinGP);

  for (const g of goalies) {
    const gp = Math.max(Number(g.GP) || 0, 1);
    g.W82 = Math.round(((Number(g.W) || 0) / gp) * cfg.paceGames);
  }

  assignRoto(pool, cats, inverted, "RotoVal");
  assignRoto(pool, ["W82", "SV%", "GAA"], inverted, "RotoVal-Pace");
}

export {
  addPlayerValueFields,
  addGoalerValueFields,
  addCategoryRanks,
  SKATER_RANK_CONFIG,
  GOALIE_RANK_CONFIG,
  calculerPlayerValueIndex,
  calculerGoalerValueIndex,
  calculerMoyenneRVI,
  computeAverageGVI,
  computeRotoValues,
  computeGoalieRotoValues,
  computeZScores,
  computeGoalieZScores,
};
