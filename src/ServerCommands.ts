import { GuildMessage } from "./global";
import { getLogger } from "log4js";

const log = getLogger();

async function initServer(msg: GuildMessage){
    if(!msg.guild){
        return -1;
    }
    let roles = await msg.guild.roles.fetch()
    if(roles.cache.filter( (v) => v.name == `${process.env.DEFAULT_GAME_MASTER}`).size == 0){
        log.info(`Configuring ${msg.guild?.name}`);
        let role = await roles.create({
                data:{
                    name: `${process.env.DEFAULT_GAME_MASTER}`
                }
            });
        log.info(`adding role`);
        await msg.member.roles.add(role);
        
        log.info(`creating category`);
        let category = await msg.guild?.channels.create(`${process.env.DEFAULT_GAMES_CATEGORY_NAME}`, {
                type: 'category'
            });

        log.info(`creating lobby`);
        category.guild.channels.create(`${process.env.DEFAULT_LOBBY_NAME}`, {
            parent: category
        });
    }
    return 1;
}

async function handleCommand(msg: GuildMessage){
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