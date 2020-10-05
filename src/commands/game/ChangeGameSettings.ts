import { getLogger } from "log4js";
import { Game, saveGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import Util from "../../Util";
import { GameCommand } from "../GameCommandHandler";

const log = getLogger();

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.MASTER;
    }
    getName(): string[] {
        return ['config'];
    }
    getPath(): string {
        return __filename;
    }

    async execute(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        let args = arg ? arg.split(' ') : [];
        if(args.length > 0){
            switch(args[0]) {
                case 'listMods':
                    Util.getAvailableMods(f => msg.channel.send(`Available Mods\n${f.join('\n')}`));
                return 0;
    
                case 'listAddedMods':
                    msg.channel.send(`Mods\n${game.settings.setup.mods.join('\n')}`);
                    game.settings.setup.mods.forEach(element => {
                        log.info(element);
                    });
                return 0;
    
                case 'set':{
                    let settingsPath = args[1].split('.');
                    log.debug(`split path ${settingsPath}`);
                    let settings = game;
                    for(let i = 0; i < settingsPath.length - 1; i++){
                        settings = settings[settingsPath[i]];
                    }
                    log.debug(`Result settings: ${settings}`);
                   
                    settings[settingsPath[settingsPath.length - 1]] = JSON.parse(args.slice(2).join(' '));
                    await saveGame(game);
                    return 0;
                }
                case 'get':{
                    let settingsPath = args[1].split('.');
                    log.debug(`split path ${settingsPath}`);
                    let settings = game;
                    let lastValue = '';
                    for(let p of settingsPath){
                        lastValue = p;
                        settings = settings[p];
                    }
                    await msg.channel.send(`Value of ${lastValue}=${JSON.stringify(settings)}`);
                    return 0;
                }
                default: 
                    return -1;
            }
        }
        return -1;
    }
}