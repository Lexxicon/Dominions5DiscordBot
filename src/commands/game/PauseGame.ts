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
        return ['pause'];
    }
    getPath(): string {
        return __filename;
    }
    async execute(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        game.settings.turns.paused = true;
        await Util.domcmd.setInterval(game, 0);
        await saveGame(game);
        await msg.channel.send(`Game Paused`);
        log.info(`Paused ${game.name}`);
    
        return 0;
    }
}