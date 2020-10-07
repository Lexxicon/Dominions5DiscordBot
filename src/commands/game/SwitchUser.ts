import { Game, getPlayerDisplayName, saveGame } from "../../DominionsGame";
import { PlayerStatus, updateGameStatus } from "../../DominionsStatus";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import Util from "../../Util";
import { GameCommand } from "../GameCommandHandler";

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
    async executeGameCommand(msg: GuildMessage, game: Game, nationID: string): Promise<number> {
        if(!game.discord.players[msg.member.id]){
            await msg.channel.send(`You haven't joined yet!`);
            return -1;
        }
        
        let nation = Util.guessStatus(nationID, game.playerStatus);
        
        if(nation) {
            for(let otherPlayer in game.discord.players){
                if(msg.member.id !== otherPlayer && game.discord.players[otherPlayer] == `${nation.nationId}`){
                    await msg.channel.send(`Race is already claimed! race: ${nation.name}`)
                    return -1;
                }
            }

            if(game.state.turn < 0){
                let currentNation = game.discord.players[msg.member.id];
                let status:PlayerStatus = game.playerStatus[currentNation];
                Util.deletePretender(game, status.stringId);
            }
            
            game.discord.players[msg.member.id] = `${nation.nationId}`;
            await saveGame(game);
            let displayName = await getPlayerDisplayName(game, `${nation.nationId}`);
            await updateGameStatus(game);
            await msg.channel.send(`Joined ${displayName} as ${nation.name}`);
        }
        return 0;
    }
}