import { calculerPlayerValue, calculerGoalerValue, calculerMoyennePlayerValue } from "./stats.js"

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

export { columnIsNumeric, buildTable, renderPlayers };
