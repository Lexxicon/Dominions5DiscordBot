import { getLogger } from "log4js";
import { Game } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
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
    async executeGameCommand(msg: GuildMessage, game: Game, mod: string): Promise<number> {
        await msg.channel.send(`Mods\n${game.settings.setup.mods.join('\n')}`);
        game.settings.setup.mods.forEach(element => {
            log.info(element);
        });
        return 0;
    }
};