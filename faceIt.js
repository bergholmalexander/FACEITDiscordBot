import axios from "axios";
import config from "./config.json";
axios.defaults.headers.common = { Authorization: `bearer ${config.fci}` };

const fiLevelUrls = {
  1: "https://support.faceit.com/hc/en-us/article_attachments/204362969/ss__2016-05-18_at_12.29.32_.jpg",
  2: "https://support.faceit.com/hc/en-us/article_attachments/204399625/ss__2016-05-18_at_06.42.10_.png",
  3: "https://support.faceit.com/hc/en-us/article_attachments/204362989/ss__2016-05-18_at_06.23.36_.png",
  4: "https://support.faceit.com/hc/en-us/article_attachments/204399525/ss__2016-05-18_at_06.23.58_.png",
  5: "https://support.faceit.com/hc/en-us/article_attachments/204399545/ss__2016-05-18_at_06.24.15_.png",
  6: "https://support.faceit.com/hc/en-us/article_attachments/204399565/ss__2016-05-18_at_06.24.39_.png",
  7: "https://support.faceit.com/hc/en-us/article_attachments/204363029/ss__2016-05-18_at_06.24.53_.png",
  8: "https://support.faceit.com/hc/en-us/article_attachments/204399585/ss__2016-05-18_at_06.25.06_.png",
  9: "https://support.faceit.com/hc/en-us/article_attachments/204399605/ss__2016-05-18_at_06.25.21_.png",
  10: "https://support.faceit.com/hc/en-us/article_attachments/204399485/ss__2016-05-18_at_12.30.17_.jpg",
};

export async function getPlayerStats(playerName) {
  /*    .stats $player_name$ implementation. Gets player information from FACEIT Data API.
        Input: playerName
        Output: playerStats information (playerStats may change over time, see return)
        Assumptions: This currently is made specifically for csgo. In the future, this could quickly be implemented for other games.
  */

  try {
    const result = await axios.get(
      // get player_id so we can search for rest of the stats
      "https://open.faceit.com/data/v4/players?nickname=" +
        playerName +
        "&game=csgo&game_player_id=" +
        playerName
    );
    const playerId = result.data.player_id;
    const elo = result.data.games.csgo.faceit_elo;
    const playerStats = await axios.get(
      // This get requires stats of a user to be retrieved via player_id rather than player_name
      "https://open.faceit.com/data/v4/players/" + playerId + "/stats/csgo"
    );
    return {
      // .stats information
      avatar: result.data.avatar,
      elo: elo,
      recent_results: playerStats.data.lifetime["Recent Results"],
      kdr: playerStats.data.lifetime["Average K/D Ratio"],
      skill_img: fiLevelUrls[result.data.games.csgo.skill_level],
      best_map: bestMapWinRateFinder(playerStats.data.segments),
      average_hs: playerStats.data.lifetime["Average Headshots %"],
      player_id: playerId,
    };
  } catch (error) {
    console.error(error);
    return {};
  }
}

export async function getPlayerStats20(playerId) {
  /*    .stats20 $player_name$ implementation. Gets player information from FACEIT Data API for the last 20 matches.
        Input: playerId
        Output: playerStats20 information (playerStats may change over time, see return)
        Assumptions: This currently is made specifically for csgo. In the future, this could quickly be implemented for other games.
  */

  const twentyMatches = await getPastMatchesByPlayer(playerId); // Gets winrates and match_id's for the last 20 games
  const allPlayerMatches = [];
  twentyMatches.matchIds.forEach(async (match) => {
    allPlayerMatches.push(getMatchStats(match)); // Gets statistics of the match given match_id
  });

  const twentyPlayerMatchStats = await Promise.all(allPlayerMatches);
  let allPlayerMatchStats = [];
  twentyPlayerMatchStats.forEach((result) => {
    // Gets the specific players stats for each match
    let teams = result["rounds"][0].teams;
    allPlayerMatchStats.push(
      teams[0]["players"]
        .concat(teams[1]["players"])
        .find((pl) => pl.player_id === playerId).player_stats
    );
  });
  let summedDict = {};
  allPlayerMatchStats.forEach((matchPlayerStats) => {
    // Sums together each stat for all games (i.e. total kills per match)
    Object.keys(matchPlayerStats).forEach((pStatKey) => {
      if (!summedDict.hasOwnProperty(pStatKey)) {
        summedDict[pStatKey] = Number(matchPlayerStats[pStatKey]);
      } else {
        summedDict[pStatKey] += Number(matchPlayerStats[pStatKey]);
      }
    });
  });
  Object.keys(summedDict).forEach((key) => {
    // Takes the average for each stat
    summedDict[key] = summedDict[key] / allPlayerMatchStats.length;
  });
  return summedDict;
}

function bestMapWinRateFinder(mapData) {
  /*    Looks for the highest winrate map of a player (for .stats) from "https://open.faceit.com/data/v4/players/" + {player_id} + "/stats/csgo" call
        Input: JSON map data (data.segments)
        Output: best map (string), winrate% (string)
  */
  // TODO: Currently hard defined 20 matches as min played for it to count in "best map winrate". Could be i.e. % of matches played?
  let highest = "";
  let highestWR = 0;
  mapData.forEach((mD) => {
    if (mD.stats["Win Rate %"] > highestWR && mD.stats["Matches"] > 20) {
      highestWR = mD.stats["Win Rate %"];
      highest = mD.label;
    }
  });
  return { map: highest, mapWR: highestWR };
}

// WIP so is commented out as it is not used
// async function matchHandler(matchId) {
//   // Match ID Example 1-81792399-81a0-41f4-8cb3-26b789f684a5
//   const result = await axios
//     .get("https://open.faceit.com/data/v4/matches/" + matchId)
//     .then((response) => {
//       const teamOne = response.data.teams.faction1.roster;
//       const teamTwo = response.data.teams.faction2.roster;
//       // For each player, get json with winrates
//       getPastMatchesByPlayer("20dcc7de-c82b-4d12-9bbd-b9c448b63888").then(
//         (result) => {
//           console.log(result);
//         }
//       );
//       // Send info to discord
//     })
//     .catch((error) => {
//       console.log(error);
//     });
//   return result;
// }

async function getPastMatchesByPlayer(playerId, numMatches = 20) {
  /*  Retrieves the last 20 matches of the player
      FACEIT Data API GET /players/{player_id}/history
       Input:
       player_id * string (path) - The id of the player
       game * string (query) - A game on FACEIT
       from integer (query) - The timestamp (Unix time) as lower bound of the query. 1 month ago if not specified
       to integer (query) - The timestamp (Unix time) as higher bound of the query. Current timestamp if not specified
       offset integer (query) - The starting item position
       limit integer (query) - The number of items to return

       Request URL - https://open.faceit.com/data/v4/players/20dcc7de-c82b-4d12-9bbd-b9c448b63888/history?game=csgo&offset=0&limit=20
    */

  const response = await axios.get(
    "https://open.faceit.com/data/v4/players/" +
      playerId +
      "/history?game=csgo&offset=0&limit=" +
      numMatches
  );
  const playerWinRates = {
    de_cache: { won: 0, lost: 0 },
    de_dust2: { won: 0, lost: 0 },
    de_mirage: { won: 0, lost: 0 },
    de_nuke: { won: 0, lost: 0 },
    de_overpass: { won: 0, lost: 0 },
    de_train: { won: 0, lost: 0 },
    de_inferno: { won: 0, lost: 0 },
  };

  let matchIds = [];
  let statsPromises = [];
  response.data.items.forEach((match) => {
    matchIds.push(match.match_id);
    statsPromises.push(parseMatchWon(match, playerId));
  });

  const listOfResults = await Promise.all(statsPromises);
  listOfResults.forEach((mapWL) => {
    let map = Object.keys(mapWL)[0];
    playerWinRates[map][mapWL[map]] += 1;
  });

  return { playerWinRates: playerWinRates, matchIds: matchIds };
}

// TODO: Make version from above where you pass in match_ids instead of player (these already collected)

async function getMatchStats(matchId) {
  /* Input: matchId
     Output: matchStats
    */
  const result = await axios.get(
    "https://open.faceit.com/data/v4/matches/" + matchId + "/stats"
  );
  return result.data;
}

function parseMatchWon(matchJson, playerId) {
  /* Input: Match as JSON, player_id
     Output: {map: {"win": #wins, "lose": #lost}}
    */
  const matchId = matchJson.match_id;
  return new Promise((resolve, rej) => {
    axios
      .get("https://open.faceit.com/data/v4/matches/" + matchId)
      .then((response) => {
        const map = response.data.voting.map.pick[0];
        const winningTeam = matchJson.results.winner; // check if playerId in faction
        const mapWon = matchJson.teams[winningTeam].players
          .map((player) => player.player_id)
          .includes(playerId);
        resolve({ [map]: mapWon ? "won" : "lost" });
      })
      .catch((error) => {
        rej(error);
        console.log(error);
      });
  });
}
