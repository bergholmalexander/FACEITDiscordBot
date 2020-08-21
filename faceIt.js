const axios = require("axios")
const config = require("./config.json")
axios.defaults.headers.common = {'Authorization': `bearer ${config.fci}`}

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
    const playerWinrates = {
        "de_cache": {"won": 0, "lost": 0},
        "de_dust2": {"won": 0, "lost": 0},
        "de_mirage": {"won": 0, "lost": 0},
        "de_nuke": {"won": 0, "lost": 0},
        "de_overpass": {"won": 0, "lost": 0},
        "de_train": {"won": 0, "lost": 0},
        "de_inferno": {"won": 0, "lost": 0},
    }

    let statsPromises = []
    response.data.items.forEach(match => {
        statsPromises.push(parseMatchWon(match, "20dcc7de-c82b-4d12-9bbd-b9c448b63888"))
    })

    const listOfResults = await Promise.all(statsPromises)
    listOfResults.forEach(mapWL => {
        let map = Object.keys(mapWL)[0]
        playerWinrates[map][mapWL[map]] += 1
    })

    return playerWinrates
}

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

exports.matchHandler = matchHandler