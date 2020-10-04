import { getLogger } from "log4js";
import { deleteGame, Game, saveGame, stopGame, hostGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";
import * as Constants from "../../Constants";
import Util from "../../Util";

const log = getLogger();

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.GAME_ADMIN;
    }
    getName(): string[] {
        return ['restartServer'];
    }
    getPath(): string {
        return __filename;
    }
    async execute(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        log.info(`Killing ${game.name} ${game.pid}`);
        await stopGame(game);
        log.info("Spawning")
        await hostGame(game);
        return 0;
    }
}