import { getLogger } from "log4js";
import { Game, getPlayerDisplayName, saveGame } from "../../DominionsGame";
import { PlayerStatus, updateGameStatus } from "../../DominionsStatus";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import Util from "../../Util";
import { GameCommand } from "../GameCommandHandler";

const races = require("../../../res/races.json");

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
        let roleID = game.discord.playerRoleId;
        if(roleID){
            let role = await msg.guild.roles.fetch(roleID)
            if(role){
                await msg.member.roles.remove(role);
            }
        }
        if(game.discord.players[msg.member.id]){
            let nationID = game.discord.players[msg.member.id];
            let displayName = await getPlayerDisplayName(game, nationID);
            
            if(game.state.turn < 0){
                let currentNation = game.discord.players[msg.member.id];
                let status:PlayerStatus = game.playerStatus[currentNation];
                Util.deletePretender(game, status.stringId);
            }

            delete game.discord.players[msg.member.id];
            await saveGame(game);
            await updateGameStatus(game);
            await msg.channel.send(`Resigned ${displayName} from ${races[game.settings.setup.era][nationID]}`);
        }
        return 0;
    }
}