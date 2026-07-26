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

function calculerMoyenneYearLeft(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var yearLeft = 0;

  data.forEach((player) => {
    const playerYearLeft = Number(player["Années Restantes"]) || 0;
    yearLeft += playerYearLeft;
  });

  return yearLeft / data.length;
}

function calculerMoyennePlayerValue(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var PlayersValue = 0;

  data.forEach((player) => {
    const playerValue = Number(player["Player Value"]);
    PlayersValue += playerValue;
  });

  return PlayersValue / data.length;
}

function calculerPlayerValue(data, player) {
  var moyenneGoals = calculerMoyenneGoals(data);
  var moyenneAssists = calculerMoyenneAssists(data);
  var moyennePoints = calculerMoyennePoints(data);
  var moyennePPPoints = calculerMoyennePPPoints(data);
  // var moyenneYearLeft = calculerMoyenneYearLeft(data);

  var goalsWeight = 1;
  var assistWeight = 0.5;
  var pointsWeight = 2;
  var plusMinusWeight = 0.05;
  var ppPointsWeight = 1.5;
  var statsWeight = 100;
  var ageWeight = 0.05;
  // var yearLeftWeight = 0.15;

  const goals = Number(player.G) || 0;
  const assists = Number(player.A) || 0;
  const points = Number(player.P) || 0;
  const plusMinus = Number(player["+/-"]) || 0;
  const ppPoints = Number(player.PPP) || 0;
  const age = Number(player.Age) || 0;
  const GP = Number(player.GP) || 1;
  // const yearLeft = Number(player["Années Restantes"]);

  var goalsValue = goalsWeight * (goals / moyenneGoals) + goals;
  var assistsValue = assistWeight * (assists / moyenneAssists) + assists;
  var pointsValue = pointsWeight * (points / moyennePoints) + points;
  var plusMinusValue = plusMinusWeight * plusMinus;
  var ppPointsValue = ppPointsWeight * (ppPoints / moyennePPPoints) + ppPoints;

  var stats =
    goalsValue + assistsValue + pointsValue + plusMinusValue + ppPointsValue;
  var statsValue = (stats + stats / GP) * statsWeight;
  var ageValue = ageWeight * (1 - (age - 25) / 25);
  // var yearLeftValue = yearLeftWeight * (1 - yearLeft / moyenneYearLeft);

  var playerValue = statsValue + ageValue; /* + yearLeftValue*/
  playerValue /= 100;

  return Math.round(playerValue * 100) / 100;
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

function calculerGoalerValue(data, goaler) {
  var moyenneWin = calculerMoyenneWin(data);
  var moyenneSAV = calculerMoyenneSAV(data);
  // var moyenneYearLeft = calculerMoyenneYearLeft(data);

  var winWeight = 0.04;
  var SAVWeight = 1;
  var GAAWeight = 0.75;
  var GPWeight = 0.025;
  var ageWeight = 0.05;
  // var yearLeftWeight = 0.15;

  const win = Number(goaler.W) || 0;
  const sav = Number(goaler["SV%"]) || 0;
  const gaa = Number(goaler.GAA) || 0;
  const age = Number(goaler.Age) || 0;
  const GP = Number(goaler.GP) || 1;
  // const yearLeft = Number(goaler["Années Restantes"]);

  var winValue = winWeight * win + win / GP + win / moyenneWin;
  var SAVValue = SAVWeight * sav + sav / moyenneSAV;
  var GAAValue = GAAWeight * gaa;
  var GPValue = GPWeight * GP;

  var statsValue = winValue + SAVValue - GAAValue + GPValue;
  var ageValue = ageWeight * (1 - (age - 26) / 26);
  // var yearLeftValue = yearLeftWeight * (1 - yearLeft / moyenneYearLeft);

  var goalerValue = statsValue + ageValue; /* + yearLeftValue*/

  return Math.round(goalerValue * 100) / 100;
}

////// Ajouter les fields qui ne sont pas encore intégré
function addPointsField(data) {
  if (!Array.isArray(data) || data.length === 0) return data;

  data.forEach((player) => {
    const goals = Number(player.G) || 0;
    const assists = Number(player.A) || 0;
    player.P = goals + assists;
  });

  return data;
}

function addYearLeftField(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  data.forEach((player) => {
    const finContrat = Number(player["Fin Contrat"]) || 0;
    const yearsLeft = 2000 + finContrat + 1 - 2025;
    player["Années Restantes"] = yearsLeft;
  });
  return data;
}

function addPlayerValueField(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  data.forEach((player) => {
    var playerValue = calculerPlayerValue(data, player);
    player["Player Value"] = playerValue;
  });
  return data;
}

// Goaler
function addGoalerValueField(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  data.forEach((goaler) => {
    var goalerValue = calculerGoalerValue(data, goaler);
    goaler["Player Value"] = goalerValue;
  });
  return data;
}

export {
  addPlayerValueField,
  addGoalerValueField,
  calculerPlayerValue,
  calculerGoalerValue,
  calculerMoyennePlayerValue,
};
