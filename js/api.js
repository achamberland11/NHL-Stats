const CACHE_KEY = "nhl_stats_cache";
const CACHE_TTL = 60 * 60 * 1000 * 24;

async function fetchWithCache(url, cacheKey) {
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const result = "data" in json ? json.data : json;

  localStorage.setItem(
    cacheKey,
    JSON.stringify({
      data: result,
      timestamp: Date.now(),
    }),
  );

  return result;
}

function formatTOI(seconds) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function loadPlayers(season) {
  try {
    const url = `/api/stats/rest/en/skater/summary?limit=-1&sort=points&dir=desc&cayenneExp=seasonId=${season}%20and%20gameTypeId=2`;
    const data = await fetchWithCache(url, CACHE_KEY + "_skaters_" + season);

    return data.map((p) => ({
      Joueurs: p.skaterFullName,
      Team: p.teamAbbrevs,
      Position: [p.positionCode],
      GP: p.gamesPlayed,
      G: p.goals,
      A: p.assists,
      P: p.points,
      "+/-": p.plusMinus,
      PPP: p.ppPoints,
      TOI: formatTOI(p.timeOnIcePerGame),
      ID: p.playerId,
    }));
  } catch (err) {
    console.error("Failed to load players.json:", err);
    return [];
  }
}

async function loadGoalies(season) {
  try {
    const url = `/api/stats/rest/en/goalie/summary?limit=-1&sort=wins&dir=desc&cayenneExp=seasonId=${season}%20and%20gameTypeId=2`;
    const data = await fetchWithCache(url, CACHE_KEY + "_goalies_" + season);

    return data.map((p) => ({
      Gardiens: p.goalieFullName,
      Team: p.teamAbbrevs,
      GP: p.gamesPlayed,
      W: p.wins,
      "SV%": p.savePct,
      GAA: p.goalsAgainstAverage,
      ID: p.playerId,
    }));
  } catch (err) {
    console.error("Failed to load goalies.json:", err);
    return [];
  }
}

async function loadPlayerLanding(playerId) {
  try {
    const url = `/api-web/v1/player/${playerId}/landing`;
    return await fetchWithCache(url, CACHE_KEY + "_landing_" + playerId);
  } catch (err) {
    console.error("Failed to load player landing:", err);
    return null;
  }
}

export { CACHE_KEY, fetchWithCache, loadPlayers, loadGoalies, loadPlayerLanding };
