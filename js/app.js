import { CACHE_KEY, loadPlayers, loadGoalies } from "./api.js";
import {
  addGoalerValueFields,
  addPlayerValueFields,
  addCategoryRanks,
  computeAverageGVI,
  SKATER_RANK_CONFIG,
  GOALIE_RANK_CONFIG,
} from "./stats.js";
import { renderPlayers, resetHidden } from "./table.js";

const positionSelect = document.getElementById("positionFilter");
const defaultPosition = "All";
positionSelect.value = defaultPosition;
let allPlayers = [];
let goalies = [];

const seasonSelect = document.getElementById("seasonFilter");
const defaultSeason = "20252026";
seasonSelect.value = defaultSeason;

const searchInput = document.getElementById("searchInput");

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

function filterBySearch(players, query) {
  const q = query.trim().toLowerCase();
  if (!q) return players;
  return players.filter((p) => {
    const name = (p.Joueurs || p.Gardiens || "").toLowerCase();
    const team = (p.Team || "").toLowerCase();
    return name.includes(q) || team.includes(q);
  });
}

function render() {
  const filtered = filterBySearch(
    filterByPosition(allPlayers, positionFilter),
    searchInput.value,
  );
  renderPlayers(filtered);
}

(async () => {
  document.getElementById("refreshBtn").addEventListener("click", () => {
    localStorage.removeItem(CACHE_KEY + "_skaters_" + seasons[0]);
    localStorage.removeItem(CACHE_KEY + "_goalies_" + seasons[0]);
    location.reload();
  });

  const ranksToggle = document.getElementById("ranksToggle");
  ranksToggle.addEventListener("change", () => {
    document.body.classList.toggle("show-ranks", ranksToggle.checked);
  });

  document.getElementById("resetHideBtn").addEventListener("click", () => {
    resetHidden();
    render();
  });

  // Filtre par saison
  let season = seasonSelect.value;
  let positionFilter = positionSelect.value;

  for (const s of seasons) {
    const players = addPlayerValueFields(await loadPlayers(s));
    const goalies = addGoalerValueFields(await loadGoalies(s));

    addCategoryRanks(players, SKATER_RANK_CONFIG);
    addCategoryRanks(goalies, GOALIE_RANK_CONFIG);

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
  render();

  seasonSelect.addEventListener("change", async () => {
    season = seasonSelect.value;

    allPlayers = seasonDataPlayer[season];
    goalies = seasonDataGoaler[season];

    render();
  });

  positionSelect.addEventListener("change", () => {
    positionFilter = positionSelect.value;
    render();
  });

  searchInput.addEventListener("input", () => {
    render();
  });
})();


export { seasons, seasonDataPlayer, seasonDataGoaler };
