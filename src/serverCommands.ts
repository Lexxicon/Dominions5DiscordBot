import { Message } from "discord.js";
import { getLogger } from "log4js";
import { GuildMessage } from "./global";

const log = getLogger();

function initServer(msg: GuildMessage){
    if(!msg.guild){
        return -1;
    }
    msg.guild.roles.fetch()
        .then(roles => {
            if(roles.cache.filter( (v) => v.name == `${process.env.DEFAULT_GAME_MASTER}`).size == 0){
                log.info(`Configuring ${msg.guild?.name}`);
                roles.create({
                    data:{
                        name: `${process.env.DEFAULT_GAME_MASTER}`
                    }
                }).then( role => {
                    msg.member?.roles.add(role);
                }).then(() => {
                    msg.guild?.channels.create(`${process.env.DEFAULT_GAMES_CATEGORY_NAME}`, {
                        type: 'category'
                    }).then(category => {
                        category.guild.channels.create(`${process.env.DEFAULT_LOBBY_NAME}`, {
                           parent: category
                       });
                    })
                }).catch(console.error);
            }
        })
        .catch(console.error);
    return 1;
}

function handleCommand(msg: GuildMessage){
    const input = msg.content.substring(1);

    let split = input.indexOf(' ');
    split = split < 0 ? input.length : split;

    const command = input.substring(0, split);
    const arg = split >= input.length ? '' : input.substring(split + 1);

    switch(command){
        case 'init':
            return initServer(msg);
        default: 
            return -1;
    }
}

export = handleCommand;