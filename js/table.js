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

const VALUE_COLS = [
  "RVI",
  "GVI",
  "AGVI",
  "RotoVal",
  "RotoVal-Pos",
  "RotoVal-PosExact",
  "RotoVal-Pace",
];

const HEADER_LABELS = {
  rankG: "G Rank",
  rankA: "A Rank",
  rankP: "P Rank",
  rankPPP: "PPP Rank",
  rankPM: "+/- Rank",
  rankW: "W Rank",
  rankSV: "SV% Rank",
  rankGAA: "GAA Rank",
  RotoVal: "Z",
  "RotoVal-Pos": "ZP",
  "RotoVal-PosExact": "ZPX",
  "RotoVal-Pace": "Z82",
  PM82: "+/-82",
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

const MAX_COMPARE = 5;
const compareIds = new Set();
const compareListeners = new Set();

function notifyCompareChange() {
  for (const fn of compareListeners) fn(getCompareIds());
}

function toggleCompare(id) {
  if (compareIds.has(id)) {
    compareIds.delete(id);
  } else {
    if (compareIds.size >= MAX_COMPARE) return false;
    compareIds.add(id);
  }
  notifyCompareChange();
  return true;
}

function isCompareSelected(id) {
  return compareIds.has(id);
}

function getCompareIds() {
  return new Set(compareIds);
}

function clearCompare() {
  compareIds.clear();
  notifyCompareChange();
}

function onCompareChange(fn) {
  compareListeners.add(fn);
  return () => compareListeners.delete(fn);
}

/// Sort table
function columnIsNumeric(data, colKey) {
  if (!Array.isArray(data)) return false;
  return data.every((row) => {
    const v = row[colKey];
    return v == null || v === "" || !isNaN(Number(v));
  });
}

function applyValueBanding(td, item, col, rankMap, nbr, percentile) {
  if (item[col] == null) return;
  const num = Number(item[col]);
  if (isNaN(num)) return;
  const rank = rankMap.get(item);
  if (rank == null) return;
  if (rank >= nbr - percentile / 2) {
    td.classList.add("value-peak");
  } else if (rank >= nbr - 2 * percentile) {
    td.classList.add("value-high");
  } else if (rank >= nbr - 3 * percentile) {
    td.classList.add("value-mid");
  } else if (rank >= nbr - 4 * percentile) {
    td.classList.add("value-low");
  } else {
    td.classList.add("value-bad");
  }
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

    const rankMaps = {};
    const nbr = {};
    const percentiles = {};
    for (const col of VALUE_COLS) {
      const sorted = [...data].sort(
        (a, b) => (Number(a[col]) || 0) - (Number(b[col]) || 0),
      );
      rankMaps[col] = new Map(sorted.map((item, i) => [item, i]));
      nbr[col] = sorted.length;
      percentiles[col] = Math.floor(sorted.length / 10);
    }

    data.forEach((item) => {
      const tr = document.createElement("tr");

      {
        const hidden = hiddenPlayers.has(item.ID);
        tr.classList.toggle("row-hidden", hidden);

        const tdOptions = document.createElement("td");
        tdOptions.className = "col-options";

        const playerName = item.Joueurs || item.Gardiens;
        const slug = playerName.toLowerCase().replace(/\s+/g, "-");

        let a = document.createElement("a");
        a.textContent = "🔗";
        a.href = `https://www.nhl.com/player/${slug}-${item.ID}`;
        a.target = "_blank";

        const hideBtn = document.createElement("button");
        hideBtn.type = "button";
        hideBtn.textContent = "❌";
        hideBtn.className = "hide-btn";
        hideBtn.addEventListener("click", () => {
          hiddenPlayers.add(item.ID);
          saveHidden();
          tr.classList.add("row-hidden");
        });

        const cmpBtn = document.createElement("button");
        cmpBtn.type = "button";
        cmpBtn.textContent = "⚖️";
        cmpBtn.title = "Add to comparison";
        cmpBtn.className = "compare-btn";
        cmpBtn.classList.toggle("compare-on", isCompareSelected(item.ID));
        cmpBtn.addEventListener("click", () => {
          if (!toggleCompare(item.ID)) {
            cmpBtn.textContent = "🙅";
            setTimeout(() => (cmpBtn.textContent = "⚖️"), 900);
            return;
          }
          cmpBtn.classList.toggle("compare-on", isCompareSelected(item.ID));
          tr.classList.toggle(
            "compare-selected",
            isCompareSelected(item.ID),
          );
        });

        tdOptions.appendChild(hideBtn);
        tdOptions.appendChild(cmpBtn);
        tr.appendChild(tdOptions);

        tdOptions.appendChild(a);

        if (isCompareSelected(item.ID)) tr.classList.add("compare-selected");

        if (!hidden) {
          const tdNum = document.createElement("td");
          tdNum.textContent = ++index;
          tr.appendChild(tdNum);
        }
      }

      columns.forEach((col) => {
        const td = document.createElement("td");
        if (RANK_COLS.has(col)) {
          td.textContent = `${item[col]}/${item.poolSize}`;
        } else {
          const v = item[col];
          td.textContent = v == null ? "" : v;
        }

        td.classList.add(`col-${col}`);

        if (VALUE_COLS.includes(col)) {
          applyValueBanding(td, item, col, rankMaps[col], nbr[col], percentiles[col]);
        }

        if (col === "Joueurs" || col === "Gardiens") {
          td.classList.add("cell-name");
          td.addEventListener("click", () => openPlayerCard(item));
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

export {
  columnIsNumeric,
  buildTable,
  renderPlayers,
  resetHidden,
  toggleCompare,
  isCompareSelected,
  getCompareIds,
  clearCompare,
  onCompareChange,
  MAX_COMPARE,
};
