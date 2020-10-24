import { getLogger } from "log4js";
import { Game, getPlayerDisplayName, saveGame } from "../../DominionsGame";
import { PlayerStatus, updateGameStatus } from "../../DominionsStatus";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import Util from "../../Util";
import { GameCommand } from "../GameCommandHandler";

const log = getLogger();

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.PLAYER;
    }
    getName(): string[] {
        return ['resign'];
    }
    getPath(): string {
        return __filename;
    }
    async executeGameCommand(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        const roleID = game.discord.playerRoleId;
        if(roleID){
            const role = await msg.guild.roles.fetch(roleID);
            if(role){
                await msg.member.roles.remove(role);
            }
        }
        if(game.discord.players[msg.member.id]){
            const nationID = game.discord.players[msg.member.id];
            const displayName = await getPlayerDisplayName(game, nationID);
            
            if(game.state.turn < 0){
                const currentNation = game.discord.players[msg.member.id];
                const status:PlayerStatus = game.playerStatus[currentNation];
                await Util.deletePretender(game, status.stringId);
            }

            delete game.discord.players[msg.member.id];
            await saveGame(game);
            await msg.channel.send(`Resigned ${displayName} from ${game.playerStatus[nationID]?.name}`);
        }
        await updateGameStatus(game);
        return 0;
    }
};