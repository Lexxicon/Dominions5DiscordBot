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
        return ['renameTeam'];
    }
    getPath(): string {
        return __filename;
    }
    async executeGameCommand(msg: GuildMessage, game: Game, teamName: string): Promise<number> {
        if(!game.settings.setup.teams){
            game.settings.setup.teams = {};
        }

        if(teamName && game.settings.setup.teams[teamName]){
            await msg.channel.send(`Team ${teamName} already exists!`);
            return -1;
        }
        for(const t in game.settings.setup.teams){
            const team = game.settings.setup.teams[t];
            if(team && team.indexOf(msg.author.id) === 0){
                game.settings.setup.teams[teamName] = game.settings.setup.teams[t];
                delete game.settings.setup.teams[t];
                await msg.channel.send(`Renamed ${t} to ${teamName}`);
                await saveGame(game);
                await updateGameStatus(game);
                return 0;
            }
        }
        
        await msg.channel.send(`Only team captains may rename teams!`);
        await updateGameStatus(game);
        return -1;
    }
};