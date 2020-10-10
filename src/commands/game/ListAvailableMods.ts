import { getLogger } from "log4js";
import { Game } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import Util from "../../Util";
import { GameCommand } from "../GameCommandHandler";

const log = getLogger();

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.PLAYER;
    }
    getName(): string[] {
        return ['listAddedMods'];
    }
    getPath(): string {
        return __filename;
    }
    async executeGameCommand(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        await Util.getAvailableMods().then(f => msg.channel.send(`Available Mods\n${f.join('\n')}`));
        return 0;
    }
};