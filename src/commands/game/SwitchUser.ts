import { Game, getPlayerDisplayName, saveGame } from "../../DominionsGame";
import { updateGameStatus } from "../../DominionsStatus";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";

const races = require("../../../res/races.json");

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.PLAYER;
    }
    getName(): string[] {
        return ['switch'];
    }
    getPath(): string {
        return __filename;
    }
    async execute(msg: GuildMessage, game: Game, nationID: string): Promise<number> {
        if(!game.discord.players[msg.member.id]){
            await msg.channel.send(`You haven't joined yet!`);
            return -1;
        }else if(races[game.settings.setup.era][nationID]) {
            for(let otherPlayer in game.discord.players){
                if(msg.member.id !== otherPlayer && game.discord.players[otherPlayer] == nationID){
                    await msg.channel.send(`Race is already claimed! race: ${races[game.settings.setup.era][nationID]}`)
                    return -1;
                }
            }
            game.discord.players[msg.member.id] = nationID;
            await saveGame(game);
            let displayName = await getPlayerDisplayName(game, nationID);
            await updateGameStatus(game);
            await msg.channel.send(`Joined ${displayName} as ${races[game.settings.setup.era][nationID]}`);
        }
        return 0;
    }
}