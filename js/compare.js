import { computeZScores, computeGoalieZScores } from "./stats.js";
import { LEAGUE_CONFIG } from "./config.js";

const PLAYER_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
];

function formatSeason(yyyyyyyy) {
  const s = String(yyyyyyyy);
  return s.slice(0, 4) + "-" + s.slice(6, 8);
}

function isGoalieRow(p) {
  return p.Gardiens != null;
}

function nameOf(p) {
  return p.Joueurs || p.Gardiens || "?";
}

function closeModal(overlay, keyHandler) {
  document.removeEventListener("keydown", keyHandler);
  overlay.remove();
}

function buildTableSection(players, title) {
  const section = document.createElement("div");
  section.className = "compare-section";

  const titleEl = document.createElement("div");
  titleEl.className = "compare-section-title";
  titleEl.textContent = title;
  section.appendChild(titleEl);

  const goalie = isGoalieRow(players[0]);
  const rows = goalie
    ? [
        ["GP"], ["W"], ["SV%"], ["GAA"], ["Age"], ["GVI"], ["AGVI"],
        ["Z", "RotoVal"], ["Z82", "RotoVal-Pace"], ["Rank", "rankGAA"],
      ]
    : [
        ["GP"], ["G"], ["A"], ["P"], ["PPP"], ["+/-"], ["TOI"], ["Age"],
        ["GVI"], ["RVI"], ["AGVI"], ["Z", "RotoVal"], ["ZP", "RotoVal-Pos"],
        ["ZPX", "RotoVal-PosExact"], ["Z82", "RotoVal-Pace"], ["Rank", "rankP"],
      ];

  const table = document.createElement("table");
  table.className = "compare-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const thLabel = document.createElement("th");
  thLabel.textContent = title;
  headRow.appendChild(thLabel);
  players.forEach((p, i) => {
    const th = document.createElement("th");
    th.textContent = nameOf(p);
    th.style.color = PLAYER_COLORS[i % PLAYER_COLORS.length];
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach(([label, key = label]) => {
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.textContent = label;
    tdLabel.className = "compare-row-label";
    tr.appendChild(tdLabel);

    let bestIdx = null;
    let bestVal = null;
    const vals = players.map((p) => {
      const raw = p[key];
      return raw == null || raw === "" ? null : Number(raw);
    });

    vals.forEach((v, i) => {
      if (v == null) return;
      if (bestIdx == null) {
        bestIdx = i;
        bestVal = v;
        return;
      }
      const lowerBetter = key === "GAA";
      if (lowerBetter ? v < bestVal : v > bestVal) {
        bestIdx = i;
        bestVal = v;
      }
    });

    vals.forEach((raw, i) => {
      const td = document.createElement("td");
      const player = players[i];
      let val = player[key];
      if (val == null) {
        td.textContent = "–";
      } else if (key === "rankGAA" || key === "rankP") {
        td.textContent = `${val}/${player.poolSize}`;
      } else {
        td.textContent = val;
      }
      if (i === bestIdx && raw != null) td.classList.add("compare-best");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  return section;
}

function buildRadarSection(players) {
  const goalie = isGoalieRow(players[0]);
  const cats = goalie
    ? LEAGUE_CONFIG.goalieCategories
    : LEAGUE_CONFIG.skaterCategories;
  const inverted = goalie ? [false, false, true] : cats.map(() => false);
  const zScores = goalie
    ? computeGoalieZScores(players, cats, inverted)
    : computeZScores(players, cats, inverted);

  const section = document.createElement("div");
  section.className = "compare-section";

  const titleEl = document.createElement("div");
  titleEl.className = "compare-section-title";
  titleEl.textContent = "League Z-Score Radar";
  section.appendChild(titleEl);

  const container = document.createElement("div");
  container.className = "compare-chart-container";
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  section.appendChild(container);

  const datasets = players
    .filter((p) => zScores.has(p))
    .map((p, i) => ({
      label: nameOf(p),
      data: cats.map((c) => zScores.get(p)[c] ?? 0),
      borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
      backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] + "33",
      pointRadius: 3,
    }));

  requestAnimationFrame(() => {
    new window.Chart(canvas, {
      type: "radar",
      data: { labels: cats, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 8 } } },
        scales: {
          r: {
            ticks: { display: false },
            suggestedMin: -3,
            suggestedMax: 3,
          },
        },
      },
    });
  });

  return section;
}

export function openCompareModal(players, season) {
  const overlay = document.createElement("div");
  overlay.className = "player-card-overlay";

  const card = document.createElement("div");
  card.className = "compare-card";

  const closeBtn = document.createElement("button");
  closeBtn.className = "player-card-close";
  closeBtn.textContent = "\u00d7";
  card.appendChild(closeBtn);

  const title = document.createElement("div");
  title.className = "compare-title";
  title.textContent = "Player Comparison";
  card.appendChild(title);

  const body = document.createElement("div");
  body.className = "compare-body";
  card.appendChild(body);

  const goalie = isGoalieRow(players[0]);
  const ordered = players.slice().sort((a, b) => {
    const ka = goalie ? a.rankGAA : a.rankP;
    const kb = goalie ? b.rankGAA : b.rankP;
    return (ka ?? Infinity) - (kb ?? Infinity);
  });

  body.appendChild(
    buildTableSection(
      ordered,
      `${season ? formatSeason(season) + " " : ""}Stats`,
    ),
  );

  const radar = buildRadarSection(ordered);
  if (radar) body.appendChild(radar);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const keyHandler = (e) => {
    if (e.key === "Escape") closeModal(overlay, keyHandler);
  };
  document.addEventListener("keydown", keyHandler);
  closeBtn.addEventListener("click", () => closeModal(overlay, keyHandler));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay, keyHandler);
  });
}
