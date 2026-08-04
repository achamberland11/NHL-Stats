import { CACHE_KEY, loadPlayers, loadGoalies, loadRosterBirthDates } from "./api.js";
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

let season = defaultSeason;
let positionFilter = defaultPosition;

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

function computeAge(birthDate, season) {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  if (isNaN(birth)) return 0;
  const start = new Date(Number(season.slice(0, 4)), 9, 1);
  let age = start.getFullYear() - birth.getFullYear();
  const monthDiff = start.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && start.getDate() < birth.getDate())) {
    age--;
  }
  return age;
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

  const birthDates = await loadRosterBirthDates();

  const seasonResults = await Promise.all(
    seasons.map(async (s) => {
      const [players, goalies] = await Promise.all([
        loadPlayers(s),
        loadGoalies(s),
      ]);
      return { s, players, goalies };
    }),
  );

  for (const { s, players, goalies } of seasonResults) {
    for (const player of players) {
      player.Age = computeAge(birthDates.get(player.ID), s);
    }
    for (const goalie of goalies) {
      goalie.Age = computeAge(birthDates.get(goalie.ID), s);
    }

    addPlayerValueFields(players);
    addGoalerValueFields(goalies);
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
