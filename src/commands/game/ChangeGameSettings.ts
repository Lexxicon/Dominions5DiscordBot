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

    async executeGameCommand(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        const args = arg ? arg.split(' ') : [];
        if(args.length > 0){
            switch(args[0]) {
                case 'listMods':{
                    const mods = await Util.getAvailableMods();
                    await msg.channel.send(`Available Mods\n${mods.join('\n')}`);
                    return 0;
                }
    
                case 'listAddedMods':
                    await msg.channel.send(`Mods\n${game.settings.setup.mods.join('\n')}`);
                    game.settings.setup.mods.forEach(element => {
                        log.info(element);
                    });
                return 0;
    
                case 'set':{
                    const settingsPath = args[1].split('.');
                    log.debug(`split path ${settingsPath}`);
                    let settings = game;
                    for(let i = 0; i < settingsPath.length - 1; i++){
                        settings = settings[settingsPath[i]];
                    }
                    log.debug(`Result settings: ${JSON.stringify(settings[settingsPath[settingsPath.length - 1]])}`);
                    const raw = args.slice(2).join(' ');
                    let value: any;
                    try{
                        value = JSON.parse(raw);
                    } catch(e){
                        value = raw;
                    }
                    log.debug(`Setting ${value}`);
                    settings[settingsPath[settingsPath.length - 1]] = value;
                    await saveGame(game);
                    await msg.channel.send(`Set ${settingsPath[settingsPath.length - 1]} to ${JSON.stringify(settings[settingsPath[settingsPath.length - 1]])}`);
                    return 0;
                }
                case 'get':{
                    const settingsPath = args[1].split('.');
                    log.debug(`split path ${settingsPath}`);
                    let settings = game;
                    let lastValue = '';
                    for(const p of settingsPath){
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
};