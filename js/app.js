import { CACHE_KEY, loadPlayers, loadGoalies } from "./api.js";
import { addGoalerValueField, addPlayerValueField } from "./stats.js";
import { renderPlayers } from "./table.js";

const filterSelect = document.getElementById("positionFilter");
const defaultValue = "All";
filterSelect.value = defaultValue;
let allPlayers = [];
let goalies = [];

const seasonSelect = document.getElementById("seasonFilter");
const defaultSeason = "20252026";
seasonSelect.value = defaultSeason;

(async () => {
  document.getElementById("refreshBtn").addEventListener("click", () => {
    localStorage.removeItem(CACHE_KEY + "_skaters");
    localStorage.removeItem(CACHE_KEY + "_goalies");
    location.reload();
  });

  // Filtre par saison
  let season = seasonSelect.value;
  const seasons = {
    20252026: "2025-26",
    20242025: "2024-25",
    20232024: "2023-24",
  };

  let playersData = await loadPlayers(season);
  let goalerData = await loadGoalies(season);

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
      player.Position.includes("L") ||
      player.Position.includes("R")
    )
      forwards.push(player);
    if (player.Position.includes("C")) centers.push(player);
    if (player.Position.includes("L")) leftWing.push(player);
    if (player.Position.includes("R")) rightWing.push(player);
    if (player.Position.includes("D")) defences.push(player);
  });

  seasonSelect.addEventListener("change", () => {
    season = seasonSelect.value;

    playersData = loadPlayers(season);
    goalerData = loadGoalies(season);

    playersData = addPlayerValueField(playersData);
    goalerData = addGoalerValueField(goalerData);
    allPlayers = playersData;
    goalies = goalerData;
    renderPlayers(allPlayers);
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
