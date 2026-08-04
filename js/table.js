import { calculerPlayerValueIndex, calculerGoalerValueIndex } from "./stats.js";
import { openPlayerCard } from "./playerCard.js";

const RANK_COLS = new Set([
  "rankG",
  "rankA",
  "rankP",
  "rankPPP",
  "rankPM",
  "rankW",
  "rankSV",
  "rankGAA",
]);

const HEADER_LABELS = {
  rankG: "G Rank",
  rankA: "A Rank",
  rankP: "P Rank",
  rankPPP: "PPP Rank",
  rankPM: "+/- Rank",
  rankW: "W Rank",
  rankSV: "SV% Rank",
  rankGAA: "GAA Rank",
};

const HIDDEN_STORAGE_KEY = "nhl_stats_hidden";
const hiddenPlayers = new Set(loadHidden());

function loadHidden() {
  try {
    const stored = JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch (err) {
    return [];
  }
}

function saveHidden() {
  localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify([...hiddenPlayers]));
}

function resetHidden() {
  hiddenPlayers.clear();
  localStorage.removeItem(HIDDEN_STORAGE_KEY);
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

  const thHide = document.createElement("th");
  thHide.className = "col-hide";
  thHide.title = "Hide player";
  headerRow.appendChild(thHide);

  const thNum = document.createElement("th");
  thNum.textContent = "#";
  headerRow.appendChild(thNum);

  columns.forEach((col) => {
    const th = document.createElement("th");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sort-btn";

    btn.textContent = HEADER_LABELS[col] || col;
    btn.dataset.col = col;
    th.appendChild(btn);
    headerRow.appendChild(th);

    th.classList.add(`col-${col}`);

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
        sortState.asc = RANK_COLS.has(colKey) ? true : numeric ? false : true;
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

    data.forEach((player) => {
      player.P != null
        ? (player["RVI"] = calculerPlayerValueIndex(data, player))
        : (player["RVI"] = calculerGoalerValueIndex(data, player));
    });

    const RVISorted = [...data].sort(
      (a, b) => (Number(a["RVI"]) || 0) - (Number(b["RVI"]) || 0),
    );
    const GVISorted = [...data].sort(
      (a, b) => (Number(a["GVI"]) || 0) - (Number(b["GVI"]) || 0),
    );
    const AGVISorted = [...data].sort(
      (a, b) => (Number(a["AGVI"]) || 0) - (Number(b["AGVI"]) || 0),
    );
    const RVIRankMap = new Map(RVISorted.map((item, i) => [item, i]));
    const GVIRankMap = new Map(GVISorted.map((item, i) => [item, i]));
    const AGVIRankMap = new Map(AGVISorted.map((item, i) => [item, i]));
    const nbrRVI = RVISorted.length;
    const nbrGVI = GVISorted.length;
    const nbrAGVI = AGVISorted.length;
    const RVIPercentile = Math.floor(nbrRVI / 10);
    const GVIPercentile = Math.floor(nbrGVI / 10);
    const AGVIPercentile = Math.floor(nbrAGVI / 10);

    data.forEach((item) => {
      const tr = document.createElement("tr");

      const hidden = hiddenPlayers.has(item.ID);
      tr.classList.toggle("row-hidden", hidden);

      const tdHide = document.createElement("td");
      tdHide.className = "col-hide";
      const hideCheck = document.createElement("input");
      hideCheck.type = "checkbox";
      hideCheck.className = "hide-check";
      hideCheck.checked = hidden;
      hideCheck.addEventListener("change", () => {
        if (hideCheck.checked) {
          hiddenPlayers.add(item.ID);
        } else {
          hiddenPlayers.delete(item.ID);
        }
        saveHidden();
        tr.classList.toggle("row-hidden", hideCheck.checked);
      });
      tdHide.appendChild(hideCheck);
      tr.appendChild(tdHide);

      if (!hidden) {
        const tdNum = document.createElement("td");
        tdNum.textContent = ++index;
        tr.appendChild(tdNum);
      }

      columns.forEach((col) => {
        const td = document.createElement("td");
        if (RANK_COLS.has(col)) {
          td.textContent = `${item[col]}/${item.poolSize}`;
        } else {
          td.textContent = item[col];
        }

        td.classList.add(`col-${col}`);

        if (col === "RVI") {
          const num = Number(item[col]);
          if (!isNaN(num)) {
            const rank = RVIRankMap.get(item);
            if (rank >= nbrRVI - RVIPercentile / 2) {
              td.classList.add("value-peak");
            } else if (rank >= nbrRVI - 2 * RVIPercentile) {
              td.classList.add("value-high");
            } else if (rank >= nbrRVI - 3 * RVIPercentile) {
              td.classList.add("value-mid");
            } else if (rank >= nbrRVI - 4 * RVIPercentile) {
              td.classList.add("value-low");
            } else {
              td.classList.add("value-bad");
            }
          }
        }

        if (col === "GVI") {
          const num = Number(item[col]);
          if (!isNaN(num)) {
            const rank = GVIRankMap.get(item);
            if (rank >= nbrGVI - GVIPercentile / 2) {
              td.classList.add("value-peak");
            } else if (rank >= nbrGVI - 2 * GVIPercentile) {
              td.classList.add("value-high");
            } else if (rank >= nbrGVI - 3 * GVIPercentile) {
              td.classList.add("value-mid");
            } else if (rank >= nbrGVI - 4 * GVIPercentile) {
              td.classList.add("value-low");
            } else {
              td.classList.add("value-bad");
            }
          }
        }

        if (col === "AGVI") {
          const num = Number(item[col]);
          if (!isNaN(num)) {
            const rank = AGVIRankMap.get(item);
            if (rank >= nbrAGVI - AGVIPercentile / 2) {
              td.classList.add("value-peak");
            } else if (rank >= nbrAGVI - 2 * AGVIPercentile) {
              td.classList.add("value-high");
            } else if (rank >= nbrAGVI - 3 * AGVIPercentile) {
              td.classList.add("value-mid");
            } else if (rank >= nbrAGVI - 4 * AGVIPercentile) {
              td.classList.add("value-low");
            } else {
              td.classList.add("value-bad");
            }
          }
        }

        if (col === "Joueurs" || col === "Gardiens") {
          const playerName = item.Joueurs || item.Gardiens;
          const slug = playerName.toLowerCase().replace(/\s+/g, "-");

          td.classList.add("cell-name");
          td.addEventListener("click", () => openPlayerCard(item));

          let a = document.createElement("a");
          a.textContent = "🔗";
          a.href = `https://www.nhl.com/player/${slug}-${item.ID}`;
          a.target = "_blank";

          td.appendChild(a);
        }

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

export { columnIsNumeric, buildTable, renderPlayers, resetHidden };
