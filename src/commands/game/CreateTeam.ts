import { getLogger } from "log4js";
import { Game, saveGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";
import Util from "../../Util";
import { updateGameStatus } from "../../DominionsStatus";

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
        if(!game.settings.setup.teams){
            game.settings.setup.teams = {};
        }

        if(game.settings.setup.teams[teamName]){
            await msg.channel.send(`Team ${teamName} already exists!`);
            return -1;
        }
        for(const t in game.settings.setup.teams){
            const team = game.settings.setup.teams[t];
            if(team && team.indexOf(msg.author.id) != -1){
                team.splice(team.indexOf(msg.author.id), 1);
                if(team?.length == 0){
                    delete game.settings.setup.teams[t];
                }
            }
        }

        game.settings.setup.teams[teamName] = [msg.author.id];
        await saveGame(game);
        await msg.channel.send(`Created Team ${teamName}!`);
        await updateGameStatus(game);
        return 0;
    }
};