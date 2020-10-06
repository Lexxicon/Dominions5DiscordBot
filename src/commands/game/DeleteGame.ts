import { getLogger } from "log4js";
import { deleteGame, Game } from "../../DominionsGame";
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
        return ['deleteGame'];
    }
    getPath(): string {
        return __filename;
    }
    async executeGameCommand(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        await deleteGame(game);
        return 0;
    }
}