import { getLogger } from "log4js";
import { Game, saveGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";
import Util from "../../Util";

const log = getLogger();

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.GAME_ADMIN;
    }
    getName(): string[] {
        return ['addMod'];
    }
    getPath(): string {
        return __filename;
    }
    async executeGameCommand(msg: GuildMessage, game: Game, mod: string): Promise<number> {
        if(game.state.turn != -1){
            return -1;
        }
        const mods = await Util.getAvailableMods();
        for(const f of mods){
            if( f.includes(mod) && !game.settings.setup.mods.includes(mod))  {
                log.info("added mod!");
                game.settings.setup.mods.push(mod);
                await saveGame(game);
                await msg.channel.send(`Added Mod: ${mod}`);
                return 1;
            }else {
                log.warn(`Failed to add ${mod}`);
                return -1;
            }
        }
        return 0;
    }
};