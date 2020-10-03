import { getLogger } from "log4js";
import { Game } from "../../DominionsGame";
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
        return ['delay', 'delayTurn'];
    }
    getPath(): string {
        return __filename;
    }
    async execute(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        let seconds = Util.getSeconds(arg);

        game.state.nextTurnStartTime = new Date(game.state.nextTurnStartTime.getTime() + (seconds * 1000));
        log.info(`Next turn for ${game.name} scheduled at ${game.state.nextTurnStartTime}`);
        Util.domcmd.startGame(game, game.state.nextTurnStartTime.getSecondsFromNow());
    
        await msg.channel.send(`Turn delayed until ${game.state.nextTurnStartTime}`);
    
        return 0;
    }
}