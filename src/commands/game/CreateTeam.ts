import { getLogger } from "log4js";
import { Game, saveGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";
import Util from "../../Util";

const log = getLogger();

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.PLAYER;
    }
    getName(): string[] {
        return ['createTeam'];
    }
    getPath(): string {
        return __filename;
    }
    async executeGameCommand(msg: GuildMessage, game: Game, teamName: string): Promise<number> {
        if(game.state.turn != -1){
            return -1;
        }

        if(!game.settings.setup.teams){
            game.settings.setup.teams = {};
        }

        if(game.settings.setup.teams[teamName]){
            await msg.channel.send(`Team ${teamName} already exists!`);
            return -1;
        }
        game.settings.setup.teams[teamName] = [];
        await msg.channel.send(`Created Team ${teamName}!`);
        return 0;
    }
};