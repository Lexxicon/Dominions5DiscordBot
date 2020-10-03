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
        let gameProcess = game.getProcess ? game.getProcess() : null;
        stopGame(game);
        let host = () => {
            log.info("Spawning")
            hostGame(game);
        };
        if(!gameProcess){
            log.debug("Process not found. Waiting instead");
            //wait for game to close
            setTimeout(host, 10000);
        }else{
            log.debug("Hooking exit");
            gameProcess.on('exit', () => setTimeout(host, 1000));
        }
        return 0;
    }
}