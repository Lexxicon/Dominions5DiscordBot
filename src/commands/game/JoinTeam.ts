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
        return ['joinTeam'];
    }
    getPath(): string {
        return __filename;
    }
    async executeGameCommand(msg: GuildMessage, game: Game, teamName: string): Promise<number> {
        if(!game.settings.setup.teams){
            game.settings.setup.teams = {};
        }

        if(teamName && !game.settings.setup.teams[teamName]){
            await msg.channel.send(`Team ${teamName} doesn't exists!`);
            return -1;
        }
        
        for(const t in game.settings.setup.teams){
            const team = game.settings.setup.teams[t];
            if(team && team.indexOf(msg.author.id) != -1){
                team.splice(team.indexOf(msg.author.id), 1);
                await msg.channel.send(`Removed ${msg.member.displayName} from ${t}`);
            }
        }
        if(teamName){
            game.settings.setup.teams[teamName]?.push(msg.author.id);
            await msg.channel.send(`Joined ${msg.member.displayName} to Team ${teamName}!`);
        }
        await saveGame(game);
        await updateGameStatus(game);
        return 0;
    }
};