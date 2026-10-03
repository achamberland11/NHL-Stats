import { computeRadarZScores } from "./stats.js";
import { LEAGUE_CONFIG } from "./config.js";
import { loadPlayerLanding } from "./api.js";
import { populatePlayerCard } from "./playerCard.js";
import { FIELD_INFO, SECTION_INFO } from "./fields.js";

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

function buildTableSection(players, title, tip = "") {
  const section = document.createElement("div");
  section.className = "compare-section";

  const titleEl = document.createElement("div");
  titleEl.className = "compare-section-title";
  titleEl.textContent = title;
  titleEl.title = tip;
  section.appendChild(titleEl);

  const goalie = isGoalieRow(players[0]);
  const rows = goalie
    ? [
        ["GP"], ["W"], ["SV%"], ["GAA"], ["Age"], ["GVI"], ["AGVI"],
        ["Trend"], ["Stab"], ["Z", "RotoVal"], ["Z82", "RotoVal-Pace"],
        ["Rank", "rankGAA"],
      ]
    : [
        ["GP"], ["G"], ["A"], ["P"], ["PPP"], ["+/-"], ["TOI"], ["Age"],
        ["GVI"], ["RVI"], ["AGVI"], ["Trend"], ["Stab"],
        ["Z", "RotoVal"], ["ZP", "RotoVal-Pos"],
        ["ZPX", "RotoVal-PosExact"], ["Z82", "RotoVal-Pace"], ["Rank", "rankP"],
      ];

  const table = document.createElement("table");
  table.className = "compare-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const thLabel = document.createElement("th");
  thLabel.textContent = title;
  thLabel.title = tip;
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
    tdLabel.title = FIELD_INFO[key] || FIELD_INFO[label] || "";
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

function buildChartContainer(players, leaguePool, mode) {
  const goalie = isGoalieRow(players[0]);
  const cats = goalie
    ? LEAGUE_CONFIG.goalieCategories
    : LEAGUE_CONFIG.skaterCategories;
  const inverted = goalie ? [false, false, true] : cats.map(() => false);
  const minGP = goalie ? LEAGUE_CONFIG.goalieMinGP : LEAGUE_CONFIG.minGP;
  const zScores = computeRadarZScores(
    players,
    leaguePool,
    mode,
    cats,
    inverted,
    minGP,
  );

  const container = document.createElement("div");
  container.className = "compare-chart-container";
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);

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
    const chart = new window.Chart(canvas, {
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
    container.chart = chart;
  });

  return container;
}

function fillBio(bio, data) {
  bio.textContent = "";
  bio.appendChild(createBioText(data));
}

function createBioText(data) {
  const frag = document.createDocumentFragment();
  const teamLogo = document.createElement("img");
  teamLogo.className = "inline-icon";
  teamLogo.src = data.teamLogo;
  teamLogo.alt = "";
  frag.appendChild(teamLogo);

  const heightFt = Math.floor(data.heightInInches / 12);
  const heightIn = data.heightInInches % 12;
  const parts = [
    `#${data.sweaterNumber}`,
    data.position,
    `${heightFt}'${heightIn}"`,
    `${data.weightInPounds} lbs`,
  ].filter(Boolean);
  frag.appendChild(document.createTextNode(parts.join(" · ")));
  return frag;
}

function buildPlayerList(players, onOpenCard, onRemove) {
  const list = document.createElement("div");
  list.className = "compare-player-list";

  const items = new Map();
  players.forEach((p) => {
    const item = document.createElement("div");
    item.className = "compare-player-item";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "compare-player-remove";
    removeBtn.textContent = "\u00d7";
    removeBtn.title = "Remove from comparison";
    removeBtn.addEventListener("click", () => {
      if (onRemove) onRemove(p);
    });

    const headshot = document.createElement("img");
    headshot.className = "compare-player-headshot";
    headshot.alt = "";
    headshot.hidden = true;

    const info = document.createElement("div");
    info.className = "compare-player-info";

    const name = document.createElement("span");
    name.className = "compare-player-name";
    name.textContent = nameOf(p);
    name.title = "Open player card";
    name.addEventListener("click", () => onOpenCard(p));

    const bio = document.createElement("div");
    bio.className = "compare-player-bio";
    bio.textContent = `${p.Team || ""}${p.Position?.length ? " · " + p.Position.join("/") : ""}`;

    info.appendChild(name);
    info.appendChild(bio);
    item.appendChild(removeBtn);
    item.appendChild(headshot);
    item.appendChild(info);
    list.appendChild(item);
    items.set(p.ID, { headshot, bio });
  });

  Promise.all(
    players.map(async (p) => {
      const data = await loadPlayerLanding(p.ID);
      if (!data) return;
      const el = items.get(p.ID);
      if (!el) return;
      el.headshot.hidden = false;
      el.headshot.src = data.headshot;
      fillBio(el.bio, data);
    }),
  );

  return list;
}

function buildRadarSection(players, onOpenCard, onRemove, leaguePool) {
  const section = document.createElement("div");
  section.className = "compare-section";

  const goalie = isGoalieRow(players[0]);

  const header = document.createElement("div");
  header.className = "compare-radar-header";

  const titleEl = document.createElement("div");
  titleEl.className = "compare-section-title";
  titleEl.textContent = "Z-Score Radar";
  titleEl.title = SECTION_INFO.radar;
  header.appendChild(titleEl);

  const modeSelect = document.createElement("select");
  modeSelect.className = "selector";
  modeSelect.title = "Reference pool used to compute the z-scores.";
  const modes = [
    ["selected", "vs compared players"],
  ];
  if (!goalie) {
    modes.push(["group", "vs same group"]);
    modes.push(["position", "vs same position"]);
  }
  modes.push(["league", "vs all players"]);
  for (const [value, label] of modes) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    modeSelect.appendChild(opt);
  }
  modeSelect.value = "league";

  header.appendChild(titleEl);
  header.appendChild(modeSelect);
  section.appendChild(header);

  const row = document.createElement("div");
  row.className = "compare-radar-row";
  row.appendChild(buildChartContainer(players, leaguePool, modeSelect.value));
  row.appendChild(buildPlayerList(players, onOpenCard, onRemove));
  section.appendChild(row);

  modeSelect.addEventListener("change", () => {
    const oldContainer = row.querySelector(".compare-chart-container");
    if (oldContainer) {
      if (oldContainer.chart) oldContainer.chart.destroy();
      oldContainer.replaceWith(
        buildChartContainer(players, leaguePool, modeSelect.value),
      );
    }
  });

  return section;
}

export function openCompareModal(players, season, onRemovePlayer, leaguePool = players) {
  const overlay = document.createElement("div");
  overlay.className = "player-card-overlay";

  let remaining = players.slice();
  let activePanel = null;

  const closePlayerPanel = () => {
    if (activePanel) {
      activePanel.remove();
      activePanel = null;
      overlay.classList.remove("compare-with-panel");
    }
  };

  const closeModal = () => {
    document.removeEventListener("keydown", keyHandler);
    overlay.remove();
  };

  const keyHandler = (e) => {
    if (e.key !== "Escape") return;
    if (activePanel) {
      closePlayerPanel();
    } else {
      closeModal();
    }
  };

  const openPlayerPanel = (player) => {
    closePlayerPanel();
    const panel = document.createElement("div");
    panel.className = "player-card-panel";
    overlay.appendChild(panel);
    overlay.classList.add("compare-with-panel");
    activePanel = panel;
    populatePlayerCard(panel, player, closePlayerPanel);
  };

  const removePlayer = (player) => {
    if (onRemovePlayer) onRemovePlayer(player.ID);
    remaining = remaining.filter((p) => p.ID !== player.ID);
    if (remaining.length < 2) {
      closeModal();
      return;
    }
    closePlayerPanel();
    renderCard();
  };

  function renderCard() {
    overlay.innerHTML = "";

    const card = document.createElement("div");
    card.className = "compare-card";

    const closeBtn = document.createElement("button");
    closeBtn.className = "player-card-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", closeModal);
    card.appendChild(closeBtn);

    const title = document.createElement("div");
    title.className = "compare-title";
    title.textContent = "Player Comparison";
    title.title = SECTION_INFO.comparison;
    card.appendChild(title);

    const body = document.createElement("div");
    body.className = "compare-body";
    card.appendChild(body);

    const goalie = isGoalieRow(remaining[0]);
    const ordered = remaining.slice().sort((a, b) => {
      const ka = goalie ? a.rankGAA : a.rankP;
      const kb = goalie ? b.rankGAA : b.rankP;
      return (ka ?? Infinity) - (kb ?? Infinity);
    });

    body.appendChild(
      buildTableSection(
        ordered,
        `${season ? formatSeason(season) + " " : ""}Stats`,
        SECTION_INFO.stats,
      ),
    );
    body.appendChild(buildRadarSection(ordered, openPlayerPanel, removePlayer, leaguePool));

    overlay.appendChild(card);
  }

  document.addEventListener("keydown", keyHandler);
  renderCard();
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
}
