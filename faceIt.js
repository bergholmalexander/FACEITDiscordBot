import axios from "axios"
import config from "./config.json"
axios.defaults.headers.common = {'Authorization': `bearer ${config.fci}`}

const fiLevelUrls = {
    "1": "https://support.faceit.com/hc/en-us/article_attachments/204362969/ss__2016-05-18_at_12.29.32_.jpg",
    "2": "https://support.faceit.com/hc/en-us/article_attachments/204399625/ss__2016-05-18_at_06.42.10_.png",
    "3": "https://support.faceit.com/hc/en-us/article_attachments/204362989/ss__2016-05-18_at_06.23.36_.png",
    "4": "https://support.faceit.com/hc/en-us/article_attachments/204399525/ss__2016-05-18_at_06.23.58_.png",
    "5": "https://support.faceit.com/hc/en-us/article_attachments/204399545/ss__2016-05-18_at_06.24.15_.png",
    "6": "https://support.faceit.com/hc/en-us/article_attachments/204399565/ss__2016-05-18_at_06.24.39_.png",
    "7": "https://support.faceit.com/hc/en-us/article_attachments/204363029/ss__2016-05-18_at_06.24.53_.png",
    "8": "https://support.faceit.com/hc/en-us/article_attachments/204399585/ss__2016-05-18_at_06.25.06_.png",
    "9": "https://support.faceit.com/hc/en-us/article_attachments/204399605/ss__2016-05-18_at_06.25.21_.png",
    "10": "https://support.faceit.com/hc/en-us/article_attachments/204399485/ss__2016-05-18_at_12.30.17_.jpg"
}

export async function getPlayerStats(playerName) {
    try {
        const result = await axios.get("https://open.faceit.com/data/v4/players?nickname="+playerName+"&game=csgo&game_player_id="+playerName)
        const playerId = result.data.player_id
        const elo = result.data.games.csgo.faceit_elo
        const playerStats = await axios.get("https://open.faceit.com/data/v4/players/"+playerId+"/stats/csgo")

        return {
            "avatar": result.data.avatar,
            "elo": elo,
            "recent_results": playerStats.data.lifetime["Recent Results"],
            "kdr": playerStats.data.lifetime["Average K/D Ratio"],
            "skill_img": fiLevelUrls[result.data.games.csgo.skill_level],
            "best_map": bestMapWinRateFinder(playerStats.data.segments),
            "average_hs": playerStats.data.lifetime["Average Headshots %"],
            "player_id": playerId
               }
    } catch (error) {
        console.error(error)
        return {}
    }
}

export async function getPlayerStats20(playerId){
    // Average Kills
    // Average Headshots
    // Average KD
    // Average K/R
    // Winrates on maps for the last 20 games

    // Process
    // Get last 20 maps and WR's
    const twentyMatches = await getPastMatchesByPlayer(playerId)
    const matchInfos = []
    // Get match stat info & get stat info for specific player

    // let statsPromises = []
    // response.data.items.forEach(match => {
    //     matchIds.push(match.match_id)
    //     statsPromises.push(parseMatchWon(match, playerId))
    // })

    // const listOfResults = await Promise.all(statsPromises)

    const allPlayerMatches = []
    twentyMatches.matchIds.forEach( async (match) => {
        allPlayerMatches.push(getMatchStats(match))
    })

    const twentyPlayerMatchStats = await Promise.all(allPlayerMatches)
    let allPlayerMatchStats = []
    twentyPlayerMatchStats.forEach( result => {
        let teams = result["rounds"][0].teams
        allPlayerMatchStats.push(teams[0]["players"].concat(teams[1]["players"]).find(pl => pl.player_id === playerId).player_stats)
    })
    // Sum together
    let summedDict = {}
    allPlayerMatchStats.forEach(matchPlayerStats => { // Always will be <= 20 matches
        Object.keys(matchPlayerStats).forEach(pStatKey => {
            if (!summedDict.hasOwnProperty(pStatKey)) {
                summedDict[pStatKey] = Number(matchPlayerStats[pStatKey])
            } else {
                summedDict[pStatKey] += Number(matchPlayerStats[pStatKey])
            }
        })
    })
    Object.keys(summedDict).forEach(key => {
        summedDict[key] = summedDict[key]/allPlayerMatchStats.length
    })
    console.log("summed dict")
    console.log(summedDict)
    return summedDict
}

function bestMapWinRateFinder(mapData) {
    let highest = ""
    let highestWR = 0
    mapData.forEach(mD => {
        if (mD.stats["Win Rate %"] > highestWR && mD.stats["Matches"] > 20) {
            highestWR = mD.stats["Win Rate %"]
            highest = mD.label
        }
        })
    return {"map": highest, "mapWR": highestWR}
}

async function matchHandler(matchId) {
    // Match ID Example 1-81792399-81a0-41f4-8cb3-26b789f684a5
    const result = await axios.get("https://open.faceit.com/data/v4/matches/" + matchId)
        .then(response => {
            const teamOne = response.data.teams.faction1.roster
            const teamTwo = response.data.teams.faction2.roster
            // For each player, get json with winrates
            getPastMatchesByPlayer("20dcc7de-c82b-4d12-9bbd-b9c448b63888").then((result) => {
                console.log(result)
            })
            // Send info to discord
        })
        .catch(error => {
            console.log(error)
        })
    return result
}

async function getPastMatchesByPlayer(playerId, numMatches = 20) {
    /* GET /players/{player_id}/history
       Input:
       player_id * string (path) - The id of the player
       game * string (query) - A game on FACEIT
       from integer (query) - The timestamp (Unix time) as lower bound of the query. 1 month ago if not specified
       to integer (query) - The timestamp (Unix time) as higher bound of the query. Current timestamp if not specified
       offset integer (query) - The starting item position
       limit integer (query) - The number of items to return

       Request URL - https://open.faceit.com/data/v4/players/20dcc7de-c82b-4d12-9bbd-b9c448b63888/history?game=csgo&offset=0&limit=20
    */

    const response = await axios.get("https://open.faceit.com/data/v4/players/" + playerId + "/history?game=csgo&offset=0&limit=" + numMatches)
    const playerWinRates = {
        "de_cache": {"won": 0, "lost": 0},
        "de_dust2": {"won": 0, "lost": 0},
        "de_mirage": {"won": 0, "lost": 0},
        "de_nuke": {"won": 0, "lost": 0},
        "de_overpass": {"won": 0, "lost": 0},
        "de_train": {"won": 0, "lost": 0},
        "de_inferno": {"won": 0, "lost": 0},
    }

    let matchIds = []
    let statsPromises = []
    response.data.items.forEach(match => {
        matchIds.push(match.match_id)
        statsPromises.push(parseMatchWon(match, playerId))
    })

    const listOfResults = await Promise.all(statsPromises)
    listOfResults.forEach(mapWL => {
        let map = Object.keys(mapWL)[0]
        playerWinRates[map][mapWL[map]] += 1
    })

    return {"playerWinRates": playerWinRates, "matchIds": matchIds}
}

// TODO: Make version from above where you pass in match_ids instead of player (these already collected)

async function getMatchStats(matchId) {
    /* Input: matchId, playerId
       Output: matchInfo
    */
    // Map needs to be found because it's not in this original json for some reason..
    const result = await axios.get("https://open.faceit.com/data/v4/matches/"+matchId+"/stats") //.then(response => {
    return result.data
    //     resolve(response.data)
    // }).catch(error => {
    //     rej(error)
    //     console.log(error)
    // })

}

// function getMatchStats(matchId) {
//     /* Input: matchId, playerId
//        Output: matchInfo
//     */
//     // Map needs to be found because it's not in this original json for some reason..
//     return new Promise((resolve, rej) => {
//         axios.get("https://open.faceit.com/data/v4/matches/"+matchId+"/stats").then(response => {
//             resolve(response.data)
//         }).catch(error => {
//             rej(error)
//             console.log(error)
//         })
//     })

// }

function parseMatchWon(matchJson, playerId) {
    /* Input: Match as JSON, playerId
       Output: {map: {"win": #wins, "lose": #lost}}
    */
    const matchId = matchJson.match_id
    // Map needs to be found because it's not in this original json for some reason..
    return new Promise((resolve, rej) => {
        axios.get("https://open.faceit.com/data/v4/matches/" + matchId).then(response => {
            const map = response.data.voting.map.pick[0]
            const winningTeam = matchJson.results.winner // check if playerId in faction
            const mapWon = matchJson.teams[winningTeam].players.map(player => player.player_id).includes(playerId)
            resolve({[map]: mapWon ? "won" : "lost"})
        }).catch(error => {
            rej(error)
            console.log(error)
        })
    })

}