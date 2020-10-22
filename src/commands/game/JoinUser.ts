import { getLogger } from "log4js";
import { Game, getPlayerDisplayName, saveGame } from "../../DominionsGame";
import { updateGameStatus } from "../../DominionsStatus";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import Util from "../../Util";
import { GameCommand } from "../GameCommandHandler";

const log = getLogger();

new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.ANY;
    }
    getName(): string[] {
        return ['join', 'claim'];
    }
    getPath(): string {
        return __filename;
    }
    async executeGameCommand(msg: GuildMessage, game: Game, nationID: string) {
        const roleID = game.discord.playerRoleId;
        let addedRole = false;
        if(roleID){
            const role = await msg.guild.roles.fetch(roleID);

            if(role){
                if(msg.member.roles.cache.find(r => r.id == role.id) == null){
                    await msg.member!.roles.add(role);
                    addedRole = true;
                }
            }else{
                throw new Error(`failed to find player role! ${game.name} ${roleID}`);
            }
        }

        const nation = Util.guessStatus(nationID, game.playerStatus);

        if(nation){
            if(game.discord.players[msg.member.id]){
                await msg.channel.send(`You've already joined!: ${game.playerStatus[game.discord.players[msg.member.id]]?.name}`);
                return 0;
            }
            
            for(const otherPlayer in game.discord.players){
                if(game.discord.players[otherPlayer] == nationID){
                    await msg.channel.send(`Race is already claimed! race: ${game.playerStatus[nationID]?.name}`);
                    return -1;
                }
            }
            game.discord.players[msg.member.id] = `${nation.nationId}`;
            await saveGame(game);
            const name = await getPlayerDisplayName(game, `${nation.nationId}`);
            log.info(`Joined ${name} as [${nation.nationId}]${nation.name} `);
            await updateGameStatus(game);
            await msg.channel.send(`Joined ${name} as ${nation.name}`);

        }else if(addedRole){
            await msg.channel.send(`Joined game without nation!`);
            return 1;
        }else{
            await msg.channel.send(`Failed to find nation! ${nationID}`);
            return -1;
        }
    
        return 0;
    
    }
};