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
    async executeGameCommand(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        let targetVP = game.settings.setup.victoryPoints;
        if(targetVP < 0){
            const playerCount = game.playerCount;
            const provPerPlayer = Constants.SIMPLE_RAND_MAP[game.settings.setup.map][1];
            log.info(`playerCount: ${playerCount}, perPlayer ${provPerPlayer}`);
            const provinces = playerCount * provPerPlayer;
            log.info("provinces " + provinces);
            targetVP = Math.log(provinces) * 1.3 + (provinces / 75);
            log.info(`Target VP: ${targetVP}`);
        }
        if(game.settings.setup.thrones.level1 < 0){
            game.settings.setup.thrones.level1 = Math.max(1, Math.round(targetVP * 0.60));
            log.info(`Level 1: ${game.settings.setup.thrones.level1}`);
        }
        if(game.settings.setup.thrones.level2 < 0) {
            game.settings.setup.thrones.level2 = Math.max(1, Math.round(targetVP * 0.35));
            log.info(`Level 2: ${game.settings.setup.thrones.level2}`);
        }
        if(game.settings.setup.thrones.level3 < 0){
            game.settings.setup.thrones.level3 = Math.round(targetVP * 0.15);
            log.info(`Level 3: ${game.settings.setup.thrones.level3}`);
        }
        if(game.settings.setup.victoryPoints < 0){
            game.settings.setup.victoryPoints = Math.ceil((
                game.settings.setup.thrones.level1 * 1 
                + game.settings.setup.thrones.level2 * 2
                + game.settings.setup.thrones.level3 * 3
            ) * 0.6);
        }
        log.info(`VP: ${game.settings.setup.victoryPoints}`);
        await saveGame(game);

        log.info("Killing");
        await stopGame(game);

        log.info("Spawning");
        await hostGame(game);
        await Util.domcmd.startGame({name: game.name});
    
        return 0;
    }
};