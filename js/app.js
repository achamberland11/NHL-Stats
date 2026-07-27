import { CACHE_KEY, loadPlayers, loadGoalies } from "./api.js";
import { addGoalerValueFields, addPlayerValueFields, computeAverageGVI } from "./stats.js";
import { renderPlayers } from "./table.js";

const positionSelect = document.getElementById("positionFilter");
const defaultPosition = "All";
positionSelect.value = defaultPosition;
let allPlayers = [];
let goalies = [];

const seasonSelect = document.getElementById("seasonFilter");
const defaultSeason = "20252026";
seasonSelect.value = defaultSeason;

const Position = {
  ALL: "All",
  F: "F",
  C: "C",
  LW: "LW",
  RW: "RW",
  D: "D",
  G: "G",
};

const seasons = ["20252026", "20242025", "20232024", "20222023", "20212022"];
const seasonDataPlayer = {};
const seasonDataGoaler = {};

function filterByPosition(players, position) {
  switch (position) {
    case Position.ALL:
      return players;
    case Position.F:
      return players.filter(
        (p) =>
          p.Position.includes("C") ||
          p.Position.includes("L") ||
          p.Position.includes("R"),
      );
    case Position.C:
      return players.filter((p) => p.Position.includes("C"));
    case Position.LW:
      return players.filter((p) => p.Position.includes("L"));
    case Position.RW:
      return players.filter((p) => p.Position.includes("R"));
    case Position.D:
      return players.filter((p) => p.Position.includes("D"));
    case Position.G:
      return goalies;
    default:
      return players;
  }
}

(async () => {
  document.getElementById("refreshBtn").addEventListener("click", () => {
    localStorage.removeItem(CACHE_KEY + "_skaters_" + seasons[0]);
    localStorage.removeItem(CACHE_KEY + "_goalies_" + seasons[0]);
    location.reload();
  });

  // Filtre par saison
  let season = seasonSelect.value;
  let positionFilter = positionSelect.value;

  for (const s of seasons) {
    const players = addPlayerValueFields(await loadPlayers(s));
    const goalies = addGoalerValueFields(await loadGoalies(s));

    seasonDataPlayer[s] = players;
    seasonDataGoaler[s] = goalies;
  }

  const skatersAGVI = computeAverageGVI(seasonDataPlayer);
  const goaliesAGVI = computeAverageGVI(seasonDataGoaler);

  for (const s of seasons){
    for (const player of seasonDataPlayer[s]){
      player["AGVI"] = skatersAGVI.get(player.Joueurs) || 0;
    }
    for (const goalie of seasonDataGoaler[s]){
      goalie["AGVI"] = goaliesAGVI.get(goalie.Gardiens) || 0;
    }
  }

  allPlayers = seasonDataPlayer[season];
  goalies = seasonDataGoaler[season];
  renderPlayers(allPlayers);


  seasonSelect.addEventListener("change", async () => {
    season = seasonSelect.value;

    allPlayers = seasonDataPlayer[season];
    goalies = seasonDataGoaler[season];

    renderPlayers(filterByPosition(allPlayers, positionFilter));
  });

  positionSelect.addEventListener("change", () => {
    positionFilter = positionSelect.value;
    renderPlayers(filterByPosition(allPlayers, positionFilter));
  });
})();
