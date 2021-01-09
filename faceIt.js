import axios from "axios"
import config from "./config.json"
axios.defaults.headers.common = { Authorization: `bearer ${config.fci}` }

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
}

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
		)
		const playerId = result.data.player_id
		const playerStats = await axios.get(
			// This get requires stats of a user to be retrieved via player_id rather than player_name
			"https://open.faceit.com/data/v4/players/" + playerId + "/stats/csgo"
		)
		const bestMap = bestMapWinRateFinder(playerStats.data.segments)
		return {
			// .stats information
			avatar: result.data.avatar,
			country: result.data.country,
			elo: result.data.games.csgo.faceit_elo,
			recent_results: playerStats.data.lifetime["Recent Results"],
			kdr: playerStats.data.lifetime["Average K/D Ratio"],
			skill_img: fiLevelUrls[result.data.games.csgo.skill_level],
			best_map: bestMap,
			average_hs: playerStats.data.lifetime["Average Headshots %"],
			player_id: playerId,
		}
	} catch (error) {
		console.error(error)
		return {}
	}
}

export async function getPlayerStats20(playerId) {
	/*    .stats20 $player_name$ implementation. Gets player information from FACEIT Data API for the last 20 matches.
        Input: playerId
        Output: playerStats20 information (playerStats may change over time, see return)
        Assumptions: This currently is made specifically for csgo. In the future, this could quickly be implemented for other games.
  */

	const playerWinRates = {
		de_cache: { won: 0, lost: 0 },
		de_dust2: { won: 0, lost: 0 },
		de_mirage: { won: 0, lost: 0 },
		de_nuke: { won: 0, lost: 0 },
		de_overpass: { won: 0, lost: 0 },
		de_train: { won: 0, lost: 0 },
		de_inferno: { won: 0, lost: 0 },
	}

	const twentyMatches = await getPastMatchesByPlayer(playerId) // Gets winrates and match_id's for the last 20 games
	const allPlayerMatches = []
	twentyMatches.matchIds.forEach(async (match) => {
		allPlayerMatches.push(getMatchStats(match)) // Gets statistics of the match given match_id
	})
	const twentyPlayerMatchStats = await Promise.all(allPlayerMatches)
	if (twentyPlayerMatchStats.length === 0) {
		return {}
	}
	let allPlayerMatchStats = []
	twentyPlayerMatchStats.forEach((result) => {
		// Gets the specific players stats for each match
		const res = result["rounds"][0]
		const teams = res.teams
		const winningTeamId = res.round_stats.Winner
		const mapLabel = res.round_stats.Map
		let winningTeam = false
		if (winningTeamId === teams[0].team_id) {
			if (
				teams[0].players.map((player) => player.player_id).includes(playerId)
			) {
				winningTeam = true
			}
		} else {
			if (
				teams[1].players.map((player) => player.player_id).includes(playerId)
			) {
				winningTeam = true
			}
		}
		playerWinRates[mapLabel][winningTeam === true ? "won" : "lost"] += 1
		allPlayerMatchStats.push(
			teams[0]["players"]
				.concat(teams[1]["players"])
				.find((pl) => pl.player_id === playerId).player_stats
		)
	})
	let summedDict = {}
	allPlayerMatchStats.forEach((matchPlayerStats) => {
		// Sums together each stat for all games (i.e. total kills per match)
		Object.keys(matchPlayerStats).forEach((pStatKey) => {
			if (!summedDict.hasOwnProperty(pStatKey)) {
				summedDict[pStatKey] = Number(matchPlayerStats[pStatKey])
			} else {
				summedDict[pStatKey] += Number(matchPlayerStats[pStatKey])
			}
		})
	})
	Object.keys(summedDict).forEach((key) => {
		// Takes the average for each stat
		summedDict[key] = summedDict[key] / allPlayerMatchStats.length
	})
	let maps = Object.keys(playerWinRates)
	let highestWR = 0
	let highestMap = ""
	maps.forEach((map) => {
		if (playerWinRates[map]["won"] + playerWinRates[map]["lost"] > 1) {
			// Placing this at 1 for now because it doesn't read more for some reason - makes more sense at > 3
			const numWon = Number(playerWinRates[map]["won"])
			const numLost = Number(playerWinRates[map]["lost"])
			let winrate = (numWon / (numWon + numLost)) * 100
			if (
				winrate > highestWR ||
				(winrate === highestWR &&
					(highestMap === "" ||
						playerWinRates[map]["won"] > playerWinRates[highestMap]["won"]))
			) {
				highestWR = winrate
				highestMap = map
			}
		}
	})
	// TODO: How to emphasize WR on many games is better than on a few
	// TODO: Careful for when highestMap does not change?
	return {
		...summedDict,
		highest_wr: highestWR,
		highest_map: highestMap,
		highest_wins: playerWinRates[highestMap]["won"],
		highest_losses: playerWinRates[highestMap]["lost"],
	}
}

function bestMapWinRateFinder(mapData) {
	/*    Looks for the highest winrate map of a player (for .stats) from "https://open.faceit.com/data/v4/players/" + {player_id} + "/stats/csgo" call
        Input: JSON map data (data.segments)
        Output: best map (string), winrate% (string)
  */
	let highest = ""
	let highestWR = 0
	// Currently hard def 20 matches played on this map to be counted
	mapData.forEach((mD) => {
		if (mD.stats["Win Rate %"] > highestWR && mD.stats["Matches"] > 20) {
			highestWR = mD.stats["Win Rate %"]
			highest = mD.label
		}
	})
	return { map: highest, mapWR: highestWR }
}

export async function matchHandler(matchId) {
	// Match ID Example 1-81792399-81a0-41f4-8cb3-26b789f684a5
	const result = await axios
		.get("https://open.faceit.com/data/v4/matches/" + matchId)
		.then(async (response) => {
			const teamOne = response.data.teams.faction1.roster.map(
				(player) => player.player_id
			)
			const teamTwo = response.data.teams.faction2.roster.map(
				(player) => player.player_id
			)
			// For each player, get json with winrates
			let teamOneStatsPromised = []
			teamOne.forEach((pId) => {
				teamOneStatsPromised.push(getPastMatchesByPlayer(pId))
			})
			let teamTwoStatsPromised = []
			teamTwo.forEach((pId) => {
				teamTwoStatsPromised.push(getPastMatchesByPlayer(pId))
			})
			const teamOneStats = await Promise.all(teamOneStatsPromised)
			const teamTwoStats = await Promise.all(teamTwoStatsPromised)
			const teamOneDict = {}
			teamOneStats.forEach((playerStats) => {
				Object.keys(playerStats["playerWinRates"]).forEach((pStatKey) => {
					if (!teamOneDict.hasOwnProperty(pStatKey)) {
						teamOneDict[pStatKey] = {
							won: Number(playerStats["playerWinRates"][pStatKey]["won"]),
							lost: Number(playerStats["playerWinRates"][pStatKey]["lost"]),
						}
					} else {
						teamOneDict[pStatKey]["won"] += Number(
							playerStats["playerWinRates"][pStatKey]["won"]
						)
						teamOneDict[pStatKey]["lost"] += Number(
							playerStats["playerWinRates"][pStatKey]["lost"]
						)
					}
				})
			})
			const teamTwoDict = {}
			teamTwoStats.forEach((playerStats) => {
				Object.keys(playerStats["playerWinRates"]).forEach((pStatKey) => {
					if (!teamTwoDict.hasOwnProperty(pStatKey)) {
						teamTwoDict[pStatKey] = {
							won: Number(playerStats["playerWinRates"][pStatKey]["won"]),
							lost: Number(playerStats["playerWinRates"][pStatKey]["lost"]),
						}
					} else {
						teamTwoDict[pStatKey]["won"] += Number(
							playerStats["playerWinRates"][pStatKey]["won"]
						)
						teamTwoDict[pStatKey]["lost"] += Number(
							playerStats["playerWinRates"][pStatKey]["lost"]
						)
					}
				})
			})
			return { teamOne: teamOneDict, teamTwo: teamTwoDict }
		})
		.catch((error) => {
			console.log(error)
			return {}
		})
	return result
}

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
	)
	let playerWinRates = {
		de_cache: { won: 0, lost: 0 },
		de_dust2: { won: 0, lost: 0 },
		de_mirage: { won: 0, lost: 0 },
		de_nuke: { won: 0, lost: 0 },
		de_overpass: { won: 0, lost: 0 },
		de_train: { won: 0, lost: 0 },
		de_inferno: { won: 0, lost: 0 },
		de_vertigo: { won: 0, lost: 0 },
	}

	let matchIds = []
	let statsPromises = []
	response.data.items.forEach((match) => {
		matchIds.push(match.match_id)
		statsPromises.push(parseMatchWon(match, playerId))
	})
	const listOfResults = await Promise.all(statsPromises)
	listOfResults.forEach((mapWL) => {
		if (mapWL) {
			// If not null or undefined
			let map = Object.keys(mapWL)[0]
			const key = mapWL[map]
			if (playerWinRates[map]) playerWinRates[map][key] += 1
		}
	})
	// The match id's are provided so that in the future they could be parsed to allow for more weight on different matches
	return { playerWinRates, matchIds }
}

// TODO: Make version from above where you pass in match_ids instead of player (these already collected)

async function getMatchStats(matchId) {
	/* Input: matchId
     Output: matchStats
    */
	const result = await axios.get(
		"https://open.faceit.com/data/v4/matches/" + matchId + "/stats"
	)
	return result.data
}

function parseMatchWon(matchJson, playerId) {
	/* Input: Match as JSON, player_id
     Output: {map: {"win": #wins, "lose": #lost}}
    */
	const matchId = matchJson.match_id
	return new Promise((resolve) => {
		axios
			.get("https://open.faceit.com/data/v4/matches/" + matchId)
			.then((response) => {
				const map = response.data.voting.map.pick[0]
				const winningTeam = matchJson.results.winner // check if playerId in faction
				const mapWon = matchJson.teams[winningTeam].players
					.map((player) => player.player_id)
					.includes(playerId)
				resolve({ [map]: mapWon ? "won" : "lost" })
			})
			.catch((error) => {
				// TODO: Handle fail without crashing
				console.log(
					"parseMatchWon Error: " + matchId + " could not be processed"
				)
				resolve(null)
			})
	})
}

export function bestWinRate(team1, team2) {
	const highestWRT1 = highestWRMap(team1)
	const highestWRT2 = highestWRMap(team2)
	const lowestWRT1 = lowestWRMap(team1)
	const lowestWRT2 = lowestWRMap(team2)
	const choiceWR = choice(team1, team2)

	return {
		highestWROne: highestWRT1.highestWR,
		highestMapOne: highestWRT1.highestMap,
		highestWRTwo: highestWRT2.highestWR,
		highestMapTwo: highestWRT2.highestMap,
		lowestWROne: lowestWRT1.lowestWR,
		lowestMapOne: lowestWRT1.lowestMap,
		lowestWRTwo: lowestWRT2.lowestWR,
		lowestMapTwo: lowestWRT2.lowestMap,
		...choiceWR,
	}
}

function highestWRMap(team) {
	const maps = Object.keys(team)
	let highestWR = 0
	let highestMap = ""
	maps.forEach((map) => {
		if (team[map]["won"] + team[map]["lost"] > 3) {
			const numWon = Number(team[map]["won"])
			const numLost = Number(team[map]["lost"])
			let winrate = (numWon / (numWon + numLost)) * 100
			if (
				winrate > highestWR ||
				(winrate === highestWR &&
					(highestMap === "" || team[map]["won"] > team[highestMap]["won"]))
			) {
				highestWR = winrate.toFixed(2)
				highestMap = map
			}
		}
	})
	return { highestWR, highestMap }
}

function lowestWRMap(team) {
	const maps = Object.keys(team)
	let lowestWR = 100
	let lowestMap = ""
	maps.forEach((map) => {
		if (team[map]["won"] + team[map]["lost"] > 3) {
			const numWon = Number(team[map]["won"])
			const numLost = Number(team[map]["lost"])
			let winrate = (numWon / (numWon + numLost)) * 100
			if (
				winrate < lowestWR ||
				(winrate === lowestWR &&
					(lowestMap === "" || team[map]["won"] < team[lowestMap]["won"]))
			) {
				lowestWR = winrate.toFixed(2)
				lowestMap = map
			}
		}
	})
	return { lowestWR, lowestMap }
}

function choice(team1, team2) {
	let choiceWROne = 0
	let choiceWRMapOne = 0
	let choiceOne = ""
	let choiceTwo = ""
	let choiceWRTwo = 0
	let choiceWRMapTwo = 0
	const maps = Object.keys(team1)
	maps.forEach((map) => {
		// Future todo: Sort in order of best to worst instead of just picking the best
		if (
			team1[map]["won"] + team1[map]["lost"] > 3 &&
			team2[map]["won"] + team2[map]["lost"] > 3
		) {
			const numWon = Number(team1[map]["won"])
			const numLost = Number(team1[map]["lost"])
			let winrate1 = (numWon / (numWon + numLost)) * 100
			const numWon2 = Number(team2[map]["won"])
			const numLost2 = Number(team2[map]["lost"])
			let winrate2 = (numWon2 / (numWon2 + numLost2)) * 100
			let wrComp = (winrate1 - winrate2).toFixed(2)
			if (wrComp > 0) {
				// Team 1 is stronger on this map
				if (wrComp > choiceWROne) {
					choiceWROne = wrComp
					choiceOne = map
					choiceWRMapOne = winrate1.toFixed(2)
				}
			} else {
				// Team 2 is stronger on this map
				if (Math.abs(wrComp) > choiceWRTwo) {
					choiceWRTwo = Math.abs(wrComp).toFixed(2)
					choiceTwo = map
					choiceWRMapTwo = winrate2.toFixed(2)
				}
			}
		}
	})
	return {
		choiceWROne: choiceWROne,
		choiceWRMapOne: choiceWRMapOne,
		choiceOne: choiceOne,
		choiceWRTwo: choiceWRTwo,
		choiceWRMapTwo: choiceWRMapTwo,
		choiceTwo: choiceTwo,
	}
}
