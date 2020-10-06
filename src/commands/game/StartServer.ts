import { getLogger } from "log4js";
import { Game, hostGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";

const log = getLogger();

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.GAME_ADMIN;
    }
    getName(): string[] {
        return ['startServer'];
    }
    getPath(): string {
        return __filename;
    }
    async executeGameCommand(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        log.info(`Starting ${game.name}`);
        await hostGame(game);
    
        return 0;
    }
}