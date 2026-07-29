import { loadPlayerLanding } from "./api.js";

function formatSeason(yyyyyyyy) {
  const s = String(yyyyyyyy);
  return s.slice(0, 4) + "-" + s.slice(4, 6);
}

function isGoalie(data) {
  return data.position === "G";
}

function buildBioSection(data) {
  const header = document.createElement("div");
  header.className = "player-card-header";

  const img = document.createElement("img");
  img.className = "player-card-headshot";
  img.src = data.headshot;
  img.alt = "";
  header.appendChild(img);

  const bio = document.createElement("div");
  bio.className = "player-card-bio";

  const teamLine = document.createElement("div");
  teamLine.className = "player-card-bio-team";
  const teamLogo = document.createElement("img");
  teamLogo.src = data.teamLogo;
  teamLogo.style.cssText = "height:20px;vertical-align:middle;margin-right:0.4rem;";
  teamLine.appendChild(teamLogo);
  teamLine.appendChild(document.createTextNode(`#${data.sweaterNumber} · ${data.position}`));

  const nameLine = document.createElement("div");
  nameLine.className = "player-card-bio-name";
  nameLine.textContent = `${data.firstName.default} ${data.lastName.default}`;

  const detail = document.createElement("div");
  detail.className = "player-card-bio-detail";

  const heightFt = Math.floor(data.heightInInches / 12);
  const heightIn = data.heightInInches % 12;
  const lines = [
    `${heightFt}'${heightIn}" · ${data.weightInPounds} lbs · Shoots ${data.shootsCatches}`,
    `Born ${data.birthDate} · ${data.birthCity?.default || ""}${data.birthStateProvince ? ", " + data.birthStateProvince.default : ""}, ${data.birthCountry}`,
  ];
  if (data.draftDetails) {
    const d = data.draftDetails;
    lines.push(`Draft: ${d.year} · Round ${d.round} Pick ${d.pickInRound} (${d.teamAbbrev}) · Overall #${d.overallPick}`);
  }
  detail.textContent = lines.join("\n");
  detail.style.whiteSpace = "pre-line";

  bio.appendChild(nameLine);
  bio.appendChild(teamLine);
  bio.appendChild(detail);
  header.appendChild(bio);
  return header;
}

function buildStatsSection(title, stats, labels) {
  const section = document.createElement("div");
  section.className = "player-card-section";

  const titleEl = document.createElement("div");
  titleEl.className = "player-card-section-title";
  titleEl.textContent = title;
  section.appendChild(titleEl);

  const grid = document.createElement("div");
  grid.className = "player-card-stats-grid";

  labels.forEach(([key, label]) => {
    if (stats[key] == null) return;
    const stat = document.createElement("div");
    stat.className = "player-card-stat";
    const lbl = document.createElement("div");
    lbl.className = "player-card-stat-label";
    lbl.textContent = label;
    const val = document.createElement("div");
    val.className = "player-card-stat-value";
    val.textContent = typeof stats[key] === "number" && key.includes("Pctg")
      ? (stats[key] * 100).toFixed(1) + "%"
      : stats[key];
    stat.appendChild(lbl);
    stat.appendChild(val);
    grid.appendChild(stat);
  });

  section.appendChild(grid);
  return section;
}

function buildAwardsSection(awards) {
  if (!awards || awards.length === 0) return null;
  const section = document.createElement("div");
  section.className = "player-card-section";

  const title = document.createElement("div");
  title.className = "player-card-section-title";
  title.textContent = "Awards";
  section.appendChild(title);

  const list = document.createElement("ul");
  list.className = "player-card-awards-list";
  awards.forEach((award) => {
    const li = document.createElement("li");
    const seasons = award.seasons.map((s) => formatSeason(s.seasonId)).join(", ");
    li.textContent = `${award.trophy.default}${seasons ? " (" + seasons + ")" : ""}`;
    list.appendChild(li);
  });
  section.appendChild(list);
  return section;
}

function buildLast5Section(last5, goalie) {
  if (!last5 || last5.length === 0) return null;
  const section = document.createElement("div");
  section.className = "player-card-section";

  const title = document.createElement("div");
  title.className = "player-card-section-title";
  title.textContent = "Last 5 Games";
  section.appendChild(title);

  const table = document.createElement("table");
  table.className = "player-card-last5";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = goalie
    ? ["Date", "Opp", "Dec", "SV%", "GAA", "TOI"]
    : ["Date", "Opp", "G", "A", "P", "+/-", "TOI"];
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  last5.slice(0, 5).forEach((game) => {
    const tr = document.createElement("tr");
    let cells;
    if (goalie) {
      cells = [
        game.gameDate,
        game.opponentAbbrev,
        game.decision,
        game.savePctg != null ? (game.savePctg * 100).toFixed(1) + "%" : "-",
        game.goalsAgainstAvg?.toFixed(2) || "-",
        game.toi || "-",
      ];
    } else {
      const pts = (game.goals || 0) + (game.assists || 0);
      cells = [
        game.gameDate,
        game.opponentAbbrev,
        game.goals ?? "-",
        game.assists ?? "-",
        pts,
        game.plusMinus ?? "-",
        game.toi || "-",
      ];
    }
    cells.forEach((c) => {
      const td = document.createElement("td");
      td.textContent = c;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  return section;
}

function closeCard(overlay, keyHandler) {
  document.removeEventListener("keydown", keyHandler);
  overlay.remove();
}

export async function openPlayerCard(player) {
  const overlay = document.createElement("div");
  overlay.className = "player-card-overlay";

  const card = document.createElement("div");
  card.className = "player-card";

  const loading = document.createElement("div");
  loading.className = "player-card-loading";
  loading.textContent = "Loading...";
  card.appendChild(loading);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const keyHandler = (e) => {
    if (e.key === "Escape") closeCard(overlay, keyHandler);
  };
  document.addEventListener("keydown", keyHandler);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeCard(overlay, keyHandler);
  });

  const data = await loadPlayerLanding(player.ID);
  if (!data) {
    loading.textContent = "Failed to load player data.";
    return;
  }

  card.textContent = "";

  const closeBtn = document.createElement("button");
  closeBtn.className = "player-card-close";
  closeBtn.textContent = "\u00d7";
  closeBtn.addEventListener("click", () => closeCard(overlay, keyHandler));
  card.appendChild(closeBtn);

  card.appendChild(buildBioSection(data));

  const playerBody = document.createElement("div");
  playerBody.textContent = "";
  playerBody.className = "player-card-body";
  card.appendChild(playerBody);

  const statsContainer = document.createElement("div");
  statsContainer.textContent = "";
  statsContainer.className = "player-section-container";
  playerBody.appendChild(statsContainer);

  const goalie = isGoalie(data);

  if (data.featuredStats?.regularSeason?.subSeason) {
    const sub = data.featuredStats.regularSeason.subSeason;
    const labels = goalie
      ? [["gamesPlayed", "GP"], ["wins", "W"], ["losses", "L"], ["otLosses", "OTL"], ["goalsAgainstAvg", "GAA"], ["savePctg", "SV%"], ["shutouts", "SO"]]
      : [["gamesPlayed", "GP"], ["goals", "G"], ["assists", "A"], ["points", "P"], ["plusMinus", "+/-"], ["powerPlayPoints", "PPP"]];
    statsContainer.appendChild(buildStatsSection(`Current Season (${formatSeason(data.featuredStats.season)})`, sub, labels));
  }

  if (data.careerTotals?.regularSeason) {
    const career = data.careerTotals.regularSeason;
    const labels = goalie
      ? [["gamesPlayed", "GP"], ["wins", "W"], ["losses", "L"], ["otLosses", "OTL"], ["goalsAgainstAvg", "GAA"], ["savePctg", "SV%"], ["shutouts", "SO"]]
      : [["gamesPlayed", "GP"], ["goals", "G"], ["assists", "A"], ["points", "P"], ["plusMinus", "+/-"], ["avgToi", "Avg TOI"]];
    statsContainer.appendChild(buildStatsSection("Career (NHL Regular Season)", career, labels));
  }
  //
  // if (goalie && data.careerTotals?.playoffs) {
  //   const playoffs = data.careerTotals.playoffs;
  //   const labels = [["gamesPlayed", "GP"], ["wins", "W"], ["losses", "L"], ["goalsAgainstAvg", "GAA"], ["savePctg", "SV%"], ["shutouts", "SO"]];
  //   card.appendChild(buildStatsSection("Career (Playoffs)", playoffs, labels));
  // }

  const last5Section = buildLast5Section(data.last5Games, goalie);
  if (last5Section) statsContainer.appendChild(last5Section);

  const awardsSection = buildAwardsSection(data.awards);
  if (awardsSection) card.appendChild(awardsSection);

  const slug = `${data.firstName.default} ${data.lastName.default}`.toLowerCase().replace(/\s+/g, "-") + "-" + data.playerId;
  const nhlLink = document.createElement("a");
  nhlLink.className = "player-card-nhl-link";
  nhlLink.href = `https://www.nhl.com/player/${slug}`;
  nhlLink.target = "_blank";
  nhlLink.textContent = "View on NHL.com \u2192";
  card.appendChild(nhlLink);
}
