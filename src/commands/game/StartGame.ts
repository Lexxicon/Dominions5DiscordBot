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
        return ['startGame'];
    }
    getPath(): string {
        return __filename;
    }
    async execute(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        let playerCount = game.playerCount;
        let provPerPlayer = Constants.SIMPLE_RAND_MAP[game.settings.setup.map][1];
        log.info(`playerCount: ${playerCount}, perPlayer ${provPerPlayer}`)
        let provinces = playerCount * provPerPlayer;
        log.info("provinces " + provinces);
        let VP =  Math.ceil(Math.log(provinces) * 1.3) + Math.floor(provinces / 75);
        game.settings.setup.victoryPoints = VP;
        log.info("VP " + VP)
        game.settings.setup.thrones = [];
        game.settings.setup.thrones[0] = Math.ceil(VP * 0.60);
        game.settings.setup.thrones[1] = Math.ceil(VP * 0.35);
        game.settings.setup.thrones[2] = Math.ceil(VP * 0.15);
        log.info(game.settings.setup.thrones);
        saveGame(game);
        log.info("Killing")
        let childProcess = game.getProcess ? game.getProcess() : null;
        stopGame(game);
        let start = () => {
            log.info("Spawning")
            hostGame(game);
            Util.domcmd.startGame({name: game.name});
        };
    
        if(!childProcess){
            //wait for game to close
            setTimeout(start, 10000);
        }else{
            childProcess.on('exit', start);
        }
    
        return 0;
    }
}