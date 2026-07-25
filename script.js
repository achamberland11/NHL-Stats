function formatTOI(seconds) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function loadPlayers() {
  try {
    const season = 20252026;
    const url = `/api/stats/rest/en/skater/summary?limit=-1&sort=points&dir=desc&cayenneExp=seasonId=${season}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();

    return json.data.map(p => ({
      Joueurs: p.skaterFullName,
      Position: [p.positionCode],
      GP: p.gamesPlayed,
      G: p.goals,
      A: p.assists,
      P: p.points,
      "+/-": p.plusMinus,
      TOI: formatTOI(p.timeOnIcePerGame),
      Team: p.teamAbbrevs,
    }));
  } catch (err) {
    console.error("Failed to load players.json:", err);
    return [];
  }
}

async function loadGoalies() {
  try {
    const season = 20252026;
    const url = `/api/stats/rest/en/goalie/summary?limit=-1&sort=wins&dir=desc&cayenneExp=seasonId=${season}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();

    return json.data.map(p => ({
      Gardiens: p.goalieFullName,
      GP: p.gamesPlayed,
      W: p.wins,
      "SV%": p.savePct,
      GAA: p.goalsAgainstAverage,
      Team: p.teamAbbrevs,
    }));
  } catch (err) {
    console.error("Failed to load goalies.json:", err);
    return [];
  }
}

const filterSelect = document.getElementById("positionFilter");
const defaultValue = "All";
filterSelect.value = defaultValue;
let allPlayers = [];

////// Calculer moyennes
function calculerMoyennePoints(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  var points = 0;

  data.forEach((player) => {
    const playerPoints = Number(player.P) || 0;
    points += playerPoints;
  });

  return points / data.length;
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
  var moyennePoints = calculerMoyennePoints(data);
  // var moyenneYearLeft = calculerMoyenneYearLeft(data);

  var pointsWeight = 2;
  var plusMinusWeight = 0.05;
  var statsWeight = 100;
  var ageWeight = 0.05;
  // var yearLeftWeight = 0.15;

  const points = Number(player.P) || 0;
  const plusMinus = Number(player["+/-"]) || 0;
  const age = Number(player.Age) || 0;
  const GP = Number(player.GP) || 1;
  // const yearLeft = Number(player["Années Restantes"]);

  var pointsValue = pointsWeight * (points / moyennePoints) + points;
  var plusMinusValue = plusMinusWeight * plusMinus;

  var statsValue = ((pointsValue + plusMinusValue) / GP) * statsWeight;
  var ageValue = ageWeight * (1 - (age - 25) / 25);
  // var yearLeftValue = yearLeftWeight * (1 - yearLeft / moyenneYearLeft);

  var playerValue = statsValue + ageValue/* + yearLeftValue*/;

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

  var goalerValue = statsValue + ageValue/* + yearLeftValue*/;

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

/// Sort table
function columnIsNumeric(data, colKey) {
  if (!Array.isArray(data)) return false;
  return data.every((row) => {
    const v = row[colKey];
    return v === "" || !isNaN(Number(v));
  });
}

/// Build table
function buildTable(data) {
  const sortState = { col: null, asc: true };
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const columns = Object.keys(data[0] || {});
  const numericMap = {};

  columns.forEach((col) => {
    const th = document.createElement("th");
    th.style.cursor = "pointer";

    const btn = document.createElement("button");
    btn.type = "button";

    btn.textContent = col;
    btn.dataset.col = col;

    btn.style.all = "unset";
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.height = "100%";
    th.appendChild(btn);
    headerRow.appendChild(th);

    th.id = `${col}`;

    th.addEventListener("click", () => {
      const colKey = btn.dataset.col;

      if (!(colKey in numericMap)) {
        numericMap[colKey] = columnIsNumeric(data, colKey);
      }

      const numeric = numericMap[colKey];

      if (sortState.col === colKey) {
        sortState.asc = !sortState.asc;
      } else {
        sortState.col = colKey;
        sortState.asc = numeric ? false : true;
      }

      data.sort((a, b) => {
        const av = a[colKey];
        const bv = b[colKey];

        const aVal = av == null ? "" : av;
        const bVal = bv == null ? "" : bv;

        if (aVal === "" && bVal !== "") return 1;
        if (bVal === "" && aVal !== "") return -1;
        if (aVal === "" && bVal === "") return 0;

        if (numeric) {
          return sortState.asc
            ? Number(aVal) - Number(bVal)
            : Number(bVal) - Number(aVal);
        } else {
          return sortState.asc
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
        }
      });
      headerRow
        .querySelectorAll("th")
        .forEach((th) => th.removeAttribute("data-sorted"));
      btn.parentElement.setAttribute(
        "data-sorted",
        sortState.asc ? "asc" : "desc",
      );
      rebuildTbody();
    });

    th.appendChild(btn);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  function rebuildTbody() {
    tbody.innerHTML = "";
    let index = 0;

    // Here
    data.forEach((player) => {
      player.P != null
        ? (player["Player Value"] = calculerPlayerValue(data, player))
        : (player["Player Value"] = calculerGoalerValue(data, player));
    });

    const moyennePlayerValue = calculerMoyennePlayerValue(data);

    data.forEach((item) => {
      const tr = document.createElement("tr");

      index++;
      item.Number = index;

      columns.forEach((col) => {
        const td = document.createElement("td");
        td.textContent = item[col];

        td.id = `${col}`;

        if (col === "Player Value" || col === "Goaler Value") {
          const num = Number(item[col]);
          if (!isNaN(num)) {
            td.classList.add(
              num > moyennePlayerValue ? "value-high" : "value-low",
            );
          }
        }

        // if (col === "Joueurs" || col === "Gardiens") {
        //   a = document.createElement("a");
        //   link = item.Link
        //   a.textContent = "🔗";
        //   a.href = link;
        //   a.target = "_blank";
        //   a.style.textDecoration = "none";
        //   a.style.color = "inherit";
        //
        //   td.appendChild(a);
        // }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }
  rebuildTbody();

  table.appendChild(tbody);
  return table;
}

function renderPlayers(data) {
  const container = document.getElementById("playersContainer");
  if (!container) return console.error("Missing #playersContainer");
  if (!data.length) {
    container.textContent = "No player data.";
    return;
  }
  container.textContent = "";
  container.appendChild(buildTable(data));
}

(async () => {
  let playersData = await loadPlayers();
  let goalerData = await loadGoalies();

  playersData = addPlayerValueField(playersData);

  goalerData = addGoalerValueField(goalerData);

  allPlayers = playersData;
  goalies = goalerData;
  renderPlayers(allPlayers);

  ////// Filtre par position
  let filter = filterSelect.value;
  const Position = {
    ALL: "All",
    F: "F",
    C: "C",
    LW: "LW",
    RW: "RW",
    D: "D",
    G: "G",
  };

  let filtered = allPlayers;
  let forwards = [];
  let centers = [];
  let leftWing = [];
  let rightWing = [];
  let defences = [];

  allPlayers.forEach((player) => {
    if (
      player.Position.includes("C") ||
      player.Position.includes("LW") ||
      player.Position.includes("RW")
    )
      forwards.push(player);
    if (player.Position.includes("C")) centers.push(player);
    if (player.Position.includes("LW")) leftWing.push(player);
    if (player.Position.includes("RW")) rightWing.push(player);
    if (player.Position.includes("D")) defences.push(player);
  });

  filterSelect.addEventListener("change", () => {
    filter = filterSelect.value;
    switch (filter) {
      case Position.ALL:
        filtered = allPlayers;
        break;
      case Position.F:
        filtered = forwards;
        break;
      case Position.C:
        filtered = centers;
        break;
      case Position.LW:
        filtered = leftWing;
        break;
      case Position.RW:
        filtered = rightWing;
        break;
      case Position.D:
        filtered = defences;
        break;
      case Position.G:
        filtered = goalies;
        break;
      default:
        filtered = allPlayers;
        break;
    }
    renderPlayers(filtered);
  });
})();
