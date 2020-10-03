import { getLogger } from "log4js";
import { deleteGame, Game, saveGame, stopGame, hostGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";
import * as Constants from "../../Constants";
import Util from "../../Util";

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
    async execute(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        let roleID = game.discord.playerRoleId;
        if(roleID){
            let role = await msg.guild.roles.fetch(roleID)
            if(role){
                msg.member.roles.remove(role);
            }
        }
        if(game.discord.players[msg.member.id]){
            let nationID = game.discord.players[msg.member.id];
            let displayName = `${game.getDisplayName(nationID)}`;
            delete game.discord.players[msg.member.id];
            setTimeout(() => {
                if(game.update) game.update();
                msg.channel.send(`Resigned ${displayName} from ${races[game.settings.setup.era][nationID]}`);
            }, 1000);
            game.save();
        }
        return 0;
    }
}