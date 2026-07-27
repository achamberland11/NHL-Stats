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

  var goalsWeight = 1;
  var assistWeight = 0.5;
  var pointsWeight = 2;
  var plusMinusWeight = 0.05;
  var ppPointsWeight = 1.5;
  var statsWeight = 100;
  var ageWeight = 0.05;

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
  var ageValue = ageWeight * (1 - (age - 25) / 25);

  var playerValue = statsValue + ageValue;
  playerValue /= 100;

  return Math.round(playerValue * 100) / 100;
}

function calculerGoalerValueIndex(data, goaler) {
  var moyenneWin = calculerMoyenneWin(data);
  var moyenneSAV = calculerMoyenneSAV(data);
  var moyenneGAA = calculerMoyenneGAA(data);

  var winWeight = 0.04;
  var SAVWeight = 1;
  var GAAWeight = 0.75;
  var GPWeight = 0.025;
  var ageWeight = 0.05;

  const win = Number(goaler.W) || 0;
  const sav = Number(goaler["SV%"]) || 0;
  const gaa = Number(goaler.GAA) || 0;
  const age = Number(goaler.Age) || 0;
  const GP = Number(goaler.GP) || 1;

  var winValue = winWeight * win + win / GP + win / moyenneWin;
  var SAVValue = SAVWeight * sav + sav / moyenneSAV;
  var GAAValue = GAAWeight * gaa + gaa / moyenneGAA;
  var GPValue = GPWeight * GP;

  var statsValue = winValue + SAVValue - GAAValue + GPValue;
  var ageValue = ageWeight * (1 - (age - 26) / 26);

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

export {
  addPlayerValueFields,
  addGoalerValueFields,
  calculerPlayerValueIndex,
  calculerGoalerValueIndex,
  calculerMoyenneRVI,
  computeAverageGVI,
};
