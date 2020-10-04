import { getLogger } from "log4js";
import * as Constants from "../../Constants";
import { Game, hostGame, saveGame, stopGame } from "../../DominionsGame";
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
        return ['startGame'];
    }
    getPath(): string {
        return __filename;
    }
    async execute(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        let VP = game.settings.setup.victoryPoints;
        if(VP < 0){
            let playerCount = game.playerCount;
            let provPerPlayer = Constants.SIMPLE_RAND_MAP[game.settings.setup.map][1];
            log.info(`playerCount: ${playerCount}, perPlayer ${provPerPlayer}`)
            let provinces = playerCount * provPerPlayer;
            log.info("provinces " + provinces);
            VP = Math.ceil(Math.log(provinces) * 1.3) + Math.floor(provinces / 75);
            game.settings.setup.victoryPoints = VP;
            log.info("VP " + VP)
        }
        if(game.settings.setup.thrones.level1 < 0){
            game.settings.setup.thrones.level1 = Math.ceil(VP * 0.60);
            log.info(`Level 1: ${game.settings.setup.thrones.level1}`);
        }
        if(game.settings.setup.thrones.level2 < 0) {
            game.settings.setup.thrones.level2 = Math.ceil(VP * 0.35);
            log.info(`Level 2: ${game.settings.setup.thrones.level2}`);
        }
        if(game.settings.setup.thrones.level3 < 0){
            game.settings.setup.thrones.level3 = Math.ceil(VP * 0.15);
            log.info(`Level 3: ${game.settings.setup.thrones.level3}`);
        }
        await saveGame(game);
        log.info("Killing")
        let childProcess = game.getProcess ? game.getProcess() : null;
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
        
        await stopGame(game);
    
        return 0;
    }
}