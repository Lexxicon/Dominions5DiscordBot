const _ = require("lodash");

const config = require("../res/config.json");
const races = require("../res/races.json");
const util = require('./util.js');
const status = require('./dominionsStatus.js');
const domGame = require('./dominionsGame.js');
const constants = require('./constants.js');

function joinUser(msg, game, nationID){
    let roleID = game.discord.playerRoleId;
    if(roleID){
        msg.guild.roles.fetch(roleID)
            .then(role => {
                msg.member.roles.add(role);
            });
    }

    if(nationID){
        if(game.discord.players[msg.member.id]){
            msg.channel.send(`You've already joined!: ${races[game.settings.setup.era][game.discord.players[msg.member.id]]}`);
        }else if(races[game.settings.setup.era][nationID]) {
            for(otherPlayer in game.discord.players){
                if(game.discord.players[otherPlayer] == nationID){
                    msg.channel.send(`Race is already claimed! race: ${races[game.settings.setup.era][nationID]}`)
                    return -1;
                }
            }
            game.discord.players[msg.member.id] = nationID;
            setTimeout(() => {
                if(game.update) game.update();
                msg.channel.send(`Joined ${game.getDisplayName(nationID)} as ${races[game.settings.setup.era][nationID]}`);
            }, 1000);
            game.save();
        }else {
            //invalid race id
            msg.channel.send(`Invalid race for given era! era: ${game.settings.setup.era}, nationID: ${nationID}`)
            return -1;
        }
    }

    return 0;
}

function switchUser(msg, game, nationID){
    if(!game.discord.players[msg.member.id]){
        msg.channel.send(`You haven't joined yet!`);
        return -1;
    }else if(races[game.settings.setup.era][nationID]) {
        for(otherPlayer in game.discord.players){
            if(msg.member.id !== otherPlayer && game.discord.players[otherPlayer] == nationID){
                msg.channel.send(`Race is already claimed! race: ${races[game.settings.setup.era][nationID]}`)
                return -1;
            }
        }
        game.discord.players[msg.member.id] = nationID;
        setTimeout(() => {
            if(game.update) game.update();
            msg.channel.send(`Joined ${game.getDisplayName(nationID)} as ${races[game.settings.setup.era][nationID]}`);
        }, 1000);
        game.save();
    }
    return 0;
}

function delayTurn(msg, game, arg) {
    if(!msg.member.roles.cache.find(r => r.name === "Dominions Master")){
        return -1;
    }

    let seconds = util.getSeconds(arg);

    game.state.nextTurnStartTime = new Date(game.state.nextTurnStartTime + (seconds * 1000));
    console.info(`Next turn for ${game.name} scheduled at ${game.state.nextTurnStartTime}`);
    util.domcmd.startGame(game, game.state.nextTurnStartTime.getSecondsFromNow());

    msg.channel.send(`Turn delayed until ${game.state.nextTurnStartTime}`);

    return 0;
}

function deleteGame(msg, game, arg) {
    if(!msg.member.roles.cache.find(r => r.name === "Dominions Master")){
        return -1;
    }
    
    domGame.deleteGame(game);
}

function startGame(msg, game, arg) {
    if(!msg.member.roles.cache.find(r => r.name === "Dominions Master")){
        return -1;
    }
    let playerCount = game.playerCount;
    let provPerPlayer = constants.SIMPLE_RAND_MAP[game.settings.setup.map][1];

    let provinces = playerCount * provPerPlayer;
    console.info("provinces " + provinces);
    let VP =  Math.ceil(Math.log(provinces) * 1.3) + Math.floor(provinces / 75);
    game.settings.setup.victoryPoints = VP;
    console.info("VP " + VP)
    game.settings.setup.thrones = [];
    game.settings.setup.thrones[0] = Math.ceil(VP * 0.60);
    game.settings.setup.thrones[1] = Math.ceil(VP * 0.35);
    game.settings.setup.thrones[2] = Math.ceil(VP * 0.15);
    console.info(game.settings.setup.thrones);
    domGame.saveGame(game);
    console.info("Killing")
    domGame.stopGame(game);
    //wait 2 seconds for game to close
    setTimeout(() => {
        console.info("Spawning")
        domGame.hostGame(game);
        util.domcmd.startGame({name: game.name});
    }, 2000);

    return 0;
}

function handleCommand(msg){
    const input = msg.content.substring(1);

    let split = input.indexOf(' ');
    split = split < 0 ? input.length : split;

    const command = input.substring(0, split);
    const arg = split >= input.length ? '' : input.substring(split + 1);

    let games = domGame.getGames();
    for(gameKey in games){
        let game = games[gameKey];

        if(msg.channel.id != game.discord.gameLobbyChannelId){
            continue;
        }

        switch(command){
            case 'join':
                return joinUser(msg, game, arg);
            case 'switch':
                return switchUser(msg, game, arg);
            case 'delete':
                return deleteGame(msg, game, arg);
            case 'delay':
                return delayTurn(msg, game, arg);
            case 'start':
                return startGame(msg, game, arg);
            default: 
                return -1;
        }
    }
    return -1;
}

module.exports = handleCommand;