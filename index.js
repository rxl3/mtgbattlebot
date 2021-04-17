const Discord = require("discord.js");
const config = require("./config.json");
const client = new Discord.Client();
const leagueData = require('./data.json');
const {table} = require('table');
const { DateTime } = require("luxon");
const fs = require('fs');

const tableConfig = {
};

const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const prefix = "!";

let commandToConfirm = "";
let commandParams = [];
let startCheckInterval = null;
let endOfWeekInterval = null;

let channel;
// const channelId = '829701034456383521'; // #general
const channelId = '832773001513664523'; // #test


client.once('ready', () => {
    if (leagueData.week === 0) {
        startCheckInterval = setInterval(checkLeagueStart, 3600000);
    }
    channel = client.channels.cache.get(channelId);
});

client.on("message", message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;
  
    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();

    switch(command) {
        case "battlebot":
            message.reply(listAllCommands());
            break;
        // Add a player to the league
        case "add":
            if (args.length === 1) {
                leagueData.players.push({
                    name: args[1].toLowerCase(),
                    score: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0
                });
            } else {
                message.reply('Usage: !add <player_name>');
            }
            break;
        // Remove a player from the league - needs confirm
        case "remove":
            if (args.length === 1) {
                const player = leagueData.players.find(p => p.name === args[0]);
                if (player) {
                    message.reply(`Reply "!confirm" to remove ${args[1]}.`);
                    commandToConfirm = "remove";
                    commandParams.push(args[0]);
                } else {
                    message.reply(`Player ${args[0]} not found.`);
                }
            } else {
                message.reply('Usage: !remove <player_name>');
            }
            break;
        // Completely reset the league - needs confirm
        case "reset":
            if (args.length === 0) {
                message.reply(`Reply "!confirm" to reset the league (THIS IS NOT REVERSIBLE).`);
                commandToConfirm = "reset";
            }
            break;
        // Start the league - requires a start day in the next week - needs confirm
        case "start":
            if (args.length === 1) {
                message.reply('Reply !confirm to start the league.');
                commandToConfirm = "start";
                commandParams.push(args[0]);
            } else {
                message.reply('Usage: !start <day_of_week>');
            }
            break;
        // Force next week - needs confirm
        case "endweek":
            if (args.length === 0) {
                message.reply('Reply !confirm to end the current league week early (This will not change the next week\'s end day).');
                commandToConfirm = "endweek";
            }
            break;
        // List match pairings for the week
        case "matches":
            if (args.length === 0) {
                const embed = new Discord.MessageEmbed().setDescription(getWeeklyMatches());
                channel.send(embed);
            }
            break;
        // Record winner of match
        case "winner":
            if (args.length === 2) {
                const player = leagueData.players.find(p => p.name === args[0].toLowerCase());
                const opponent = leagueData.players.find(p => p.name === args[1].toLowerCase());
                if (player && player.weeklyMatches.length > 0) {
                    player.wins++;
                    player.historicalMatches.splice(player.historicalMatches.indexOf(opponent.name), 1);
                }
            } else {
                message.reply('Usage: !winner <player_name> <opponent_name>');
            }
            break;
        // Return League Stats
        case "stats":
            if (args.length === 0) {
                //message.reply(getLeagueStats());
                // const channel = client.channels.cache.get('832773001513664523');
                const embed = new Discord.MessageEmbed().setDescription(getLeagueStats());
                channel.send(embed);
            }
            break;
        // Manually generate new matches for the week
        case 'generate':
            if (args.length === 0) {
                leagueData.players.forEach(player => {
                    player.weeklyMatches = [];
                });
                generateMatches();
                channel.send('New weekly matches generated. Type !matches to see them!');
            }
            break;
        // Manually add win
        case "addwin":
            if (args.length === 1) {
                const player = leagueData.players.find(p => p.name === args[0].toLowerCase());
                if (player) {
                    player.wins++;
                }
            } else {
                message.reply('Usage: !addwin <player_name>');
            }
            break;
        // Manually add loss
        case "addloss":
            if (args.length === 1) {
                const player = leagueData.players.find(p => p.name === args[0].toLowerCase());
                if (player) {
                    player.losses++;
                }
            } else {
                message.reply('Usage: !addloss <player_name>');
            }
            break;
        // Manually add draw
        case "adddraw":
            if (args.length === 1) {
                const player = leagueData.players.find(p => p.name === args[0].toLowerCase());
                if (player) {
                    player.draws++;
                }
            } else {
                message.reply('Usage: !adddraw <player_name>');
            }
            break;
        // Manually remove win
        case "removewin":
            if (args.length === 1) {
                const player = leagueData.players.find(p => p.name === args[0].toLowerCase());
                if (player) {
                    player.wins--;
                }
            } else {
                message.reply('Usage: !removewin <player_name>');
            }
            break;
        // Manually remove loss
        case "removeloss":
            if (args.length === 1) {
                const player = leagueData.players.find(p => p.name === args[0].toLowerCase());
                if (player) {
                    player.losses--;
                }
            } else {
                message.reply('Usage: !removeloss <player_name>');
            }
            break;
        // Manually remove draw
        case "removedraw":
            if (args.length === 1) {
                const player = leagueData.players.find(p => p.name === args[0].toLowerCase());
                if (player) {
                    player.draws--;
                }
            } else {
                message.reply('Usage: !removedraw <player_name>');
            }
            break;
        case "confirm":
            switch (commandToConfirm) {
                case "start":
                    const today = new DateTime();
                    if (commandParams.length === 1 && commandParams[0].toLowerCase() === 'today') {
                        leagueData.startDate = today.startOf('day').toString();
                        leagueData.week = 1;
                        generateMatches();
                        message.reply('Week 1 starts now!');
                        message.reply('Use !matches to see the pairings for this week.');
                        endOfWeekInterval = setInterval(checkEndOfWeek, 3600000);
                    } else if (commandParams.length === 1 && daysOfWeek.indexOf(commandParams[0]) > -1) {
                        const indexOfStart = daysOfWeek.indexOf(commandParams[0]);
                        const indexOfToday = +today.toFormat('E');
                        const diff = indexOfStart > indexOfToday ? indexOfStart - indexOfToday : indexOfStart - indexOfToday + 7; // today is 1-7 (mon-sun), start is 0-6

                        startDate = today.startOf('day').plus({days: diff}).toString();
                    }
                    break;
                case "endweek":
                    // TODO
                    break;
                case "reset":
                    leagueData.week = 0;
                    leagueData.startDate = null;
                    leagueData.players.forEach(player => {
                        player.score = 0;
                        player.draws = 0;
                        player.wins = 0;
                        player.losses = 0;
                        player.historicalMatches = [];
                        player.weeklyMatches = [];
                    });
                    clearInterval(endOfWeekInterval);
                    endOfWeekInterval = null;
                    message.reply('League reset.');
                    break;
                case "remove":
                    if (commandParams.length === 1) {
                        for (let i = leagueData.players.length - 1; i >= 0; i--) {
                            if (leagueData.players[i].name === commandParams[0].toLowerCase()) {
                                leagueData.players.splice(i, 1);
                            }
                        }
                    }
                    break;
                default:
                    break;
            }
            break;
        default:
            break;
    }
  });
  

client.login(config.BOT_TOKEN);

function listAllCommands() {
    const commands = 
        `\n!help - show this menu
!add - add a player to the league
!remove - remove a player from the league
!reset - reset the league points and pause the league
!start - start the league
!endweek - forcibly end the current league week
!matches - list all the remaining matches for this week
!winner - record the winner of a league match
!stats - show the current player stats for the league
!generate - manually generate random new matches for the week`;
        return commands;
}

function checkLeagueStart() {
    const today = new DateTime();
    const startDate = DateTime.fromISO(leagueData.startDate);
    if (startDate.hasSame(today, 'day')) {
        //week.
        generateMatches();
        // const channel = client.channels.cache.get('829701034456383521');
        channel.send('Week 1 starts now!');
        channel.send('Use !matches to see the pairings for this week.');
        clearInterval(startCheckInterval);
        startCheckInterval = null;
    }
}

function checkEndOfWeek() {
    const today = new DateTime();
    const startDate = DateTime.fromISO(leagueData.startDate);
    const diff = today.diff(startDate, 'day');
    if (diff.as('days') / 7.0 >= leagueData.week) {
        // It's a new week!
        leagueData.week++;
        generateMatches();
        // const channel = client.channels.cache.get('829701034456383521');
        channel.send(`Week ${leagueData.week} starts now!`);
        channel.send('Use !matches to see the pairings for this week.');
    }
}

function getWeeklyMatches() {
    let strTable = [[
        'Player', 'Match 1', 'Match 2', 'Match 3'
    ]];
    leagueData.players.forEach(player => {
        let row = [];
        const formattedWeeklyMatches = player.weeklyMatches.map(m => toTitleCase(m));
        row.push(toTitleCase(player.name));
        for (let i = 0; i < 3; i++) {
            if (formattedWeeklyMatches.length > i) {
                row.push(formattedWeeklyMatches[i]);
            } else {
                row.push('');
            }
        }
        strTable.push(row);
    });
    return '```' + table(strTable, tableConfig) + '```';
}

function generateMatches() {
    leagueData.players.forEach(player => {
        const lastWeeksMatches = player.weeklyMatches.slice();
        if (leagueData.week > 1) {
            player.historicalMatches.push(lastWeeksMatches);
        }
        player.weeklyMatches = [];
        
        const opponents = shuffle(leagueData.players.filter(p => p.name !== player.name));
        opponents.forEach(opponent => {
            let hasNotPlayedYet = true;
            opponent.historicalMatches.forEach(m => {
                if (m.includes(player.name)) {
                    hasNotPlayedYet = false;
                }
            });
            if (hasNotPlayedYet && player.weeklyMatches.length < 3 && opponent.weeklyMatches.length < 3) {
                player.weeklyMatches.push(opponent.name);
                opponent.weeklyMatches.push(player.name);
            }
        });

        while(player.weeklyMatches.length < 3) {
            const index = Math.floor(Math.random() * leagueData.players.length);
            const match = leagueData.players[index].name;
            player.weeklyMatches.push(match);
        }
    });
    fs.writeFileSync('./data.json', JSON.stringify(leagueData, null, 4));
}

function getLeagueStats() {
    let strTable = [[
        'Player', 'Win', 'Loss', 'Draw', 'Points'
    ]];
    leagueData.players.forEach(player => {
        strTable.push([
            player.name,
            player.wins, player.losses, player.draws,
            player.score
        ]);
    });

    return '```' + table(strTable, tableConfig) + '```';
}

function toTitleCase(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
}
  