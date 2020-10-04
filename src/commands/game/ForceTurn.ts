import { getLogger } from "log4js";
import { Game } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import Util from "../../Util";
import { GameCommand } from "../GameCommandHandler";

const log = getLogger();

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.GAME_ADMIN;
    }
    getName(): string[] {
        return ['forceTurn'];
    }
    getPath(): string {
        return __filename;
    }
    async execute(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        log.debug(`forcing turn with arg ${arg? arg : 'default'}`)
        let time = Util.getSeconds(arg || '15s');
        game.state.nextTurnStartTime = new Date().addSeconds(time);
        await Util.domcmd.startGame({name: game.name}, time);
        await msg.channel.send(`Ending turn in ${time} seconds!`);
        return 0;
    }
}