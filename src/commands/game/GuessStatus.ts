import { getLogger } from "log4js";
import { Game, getPlayerDisplayName, saveGame } from "../../DominionsGame";
import { updateGameStatus } from "../../DominionsStatus";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import Util from "../../Util";
import { GameCommand } from "../GameCommandHandler";

const log = getLogger();

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.ANY;
    }
    getName(): string[] {
        return ['guess'];
    }
    getPath(): string {
        return __filename;
    }
    async executeGameCommand(msg: GuildMessage, game: Game, nationID: string) {
        await msg.channel.send(Util.guessStatus(nationID, game.playerStatus)?.name || "miss");
    
        return 0;
    
    }
};