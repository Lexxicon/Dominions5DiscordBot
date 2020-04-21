const _ = require("lodash");

const config = require("../res/config.json");
const races = require("../res/races.json");
const util = require('./util.js');
const status = require('./dominionsStatus.js');
const domGame = require('./dominionsGame.js');

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
                let roleID = game.discord.playerRoleId;
                if(roleID){
                    msg.guild.roles.fetch(roleID)
                        .then(role => {
                            msg.member.roles.add(role);
                        });
                }

                if(arg){
                    if(game.discord.players[msg.member.id]){
                        //already claimed something
                    }else if(races[game.settings.setup.era][arg]) {
                        for(otherPlayer in game.discord.players){
                            if(game.discord.players[otherPlayer] == arg){
                                msg.channel.send(`Race is already claimed! race: ${races[game.settings.setup.era][arg]}`)
                                break;
                            }
                        }
                        game.discord.players[msg.member.id] = arg;
                        setTimeout(() => {
                            if(game.update) game.update();
                            msg.channel.send(`Joined ${game.getDisplayName(arg)} as ${races[game.settings.setup.era][arg]}`);
                        }, 1000);
                        game.save();
                    }else {
                        //invalid race id
                        msg.channel.send(`Invalid race for given era! era: ${game.settings.setup.era}, arg: ${arg}`)
                    }
                }
                break;
            case 'switch':
                break;
        }
    }
}

module.exports = handleCommand;