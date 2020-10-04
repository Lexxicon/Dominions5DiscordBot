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
        return ['setTurnLength'];
    }
    getPath(): string {
        return __filename;
    }
    async execute(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        let seconds = Util.getSeconds(arg);
        game.settings.turns.maxTurnTimeMinutes = Math.floor(seconds/60);
        await saveGame(game);
        await Util.domcmd.setInterval(game, game.settings.turns.maxTurnTimeMinutes);
        await msg.channel.send(`Game Turn Interval ${game.settings.turns.maxTurnTimeMinutes} minutes`);
        log.info(`Updated ${game.name} turn interval ${game.settings.turns.maxTurnTimeMinutes}`);
    
        return 0;
    }
}