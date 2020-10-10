import { getLogger } from "log4js";
import { Game } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";
import Util from "../../Util";
import { updateGameStatus } from "../../DominionsStatus";

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
    async executeGameCommand(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        const seconds = Util.getSeconds(arg);
        game.state.nextTurnStartTime = new Date(game.state.nextTurnStartTime.getTime() + (seconds * 1000));
        await Util.domcmd.startGame(game, game.state.nextTurnStartTime.getSecondsFromNow());
        await updateGameStatus(game);
        await msg.channel.send(`Turn delayed until ${game.state.nextTurnStartTime}`);
        log.info(`Next turn for ${game.name} scheduled at ${game.state.nextTurnStartTime}`);
        return 0;
    }
};