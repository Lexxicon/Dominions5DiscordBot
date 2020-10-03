import { Game } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";

const races = require("../../../res/races.json");

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
    async execute(msg: GuildMessage, game: Game, nationID: string) {
        let roleID = game.discord.playerRoleId;
        if(roleID){
            let role = await msg.guild.roles.fetch(roleID);

            if(role){
                await msg.member!.roles.add(role);
                return 1;
            }else{
                throw `failed to find player role! ${game.name} ${roleID}`
            }
        }

        if(nationID){
            if(game.discord.players[msg.member.id]){
                await msg.channel.send(`You've already joined!: ${races[game.settings.setup.era][game.discord.players[msg.member.id]]}`);
            }else if(races[game.settings.setup.era][nationID]) {
                for(let otherPlayer in game.discord.players){
                    if(game.discord.players[otherPlayer] == nationID){
                        await msg.channel.send(`Race is already claimed! race: ${races[game.settings.setup.era][nationID]}`)
                        return -1;
                    }
                }
                game.discord.players[msg.member.id] = nationID;
                setTimeout(() => {
                    if(game.update) game.update();
                    msg.channel.send(`Joined ${game.getDisplayName(nationID)} as ${races[game.settings.setup.era][nationID]}`);
                }, 1000);
            }else {
                await msg.channel.send(`Invalid race for given era! era: ${game.settings.setup.era}, nationID: ${nationID}`)
                return -1;
            }
        }
    
        return 0;
    
    }
}