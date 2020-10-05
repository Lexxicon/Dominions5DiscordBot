import { getLogger } from "log4js";
import { Game, saveGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";
import AsciiTable from 'ascii-table';
import Util from "../../Util";

const log = getLogger();
const VAL_REGEX = /(?<ATK>\d+)\s*vs?\s*(?<DEF>\d+)/;
new class extends GameCommand{
    getNeededPermission(): Permission {
        return Permission.PLAYER;
    }
    getName(): string[] {
        return ['drn'];
    }
    getPath(): string {
        return __filename;
    }

    drn(depth: number){
        if(depth > 20) return 10000;
        let roll = Math.ceil(Math.random() * 6);
        if(roll == 6){
            return 5 + this.drn(depth++);
        }
        return roll;
    }

    async execute(msg: GuildMessage, game: Game, arg: string): Promise<number> {
        let match = VAL_REGEX.exec(arg);
        if(match && match?.groups){
            let atk = Number(match.groups['ATK']);
            let def = Number(match.groups['DEF']);
            let result: {
                wins: number,
                losses: number,
                [k : number]: number;
            } = {wins: 0, losses: 0};
            let count = 0;
            while(count++ < 1000){
                let atkDrn = this.drn(0) + this.drn(0) + atk;
                let defDrn = this.drn(0) + this.drn(0) + def;
                result[atkDrn - defDrn] = (result[atkDrn - defDrn] || 0) + 1;
                if(atkDrn > defDrn){
                    result.wins++;
                }else{
                    result.losses++;
                }
            }

            let rolls = result.wins + result.losses;
            let table = new AsciiTable(`${atk} vs ${def}`);
            table.addRow('Rolls', rolls);
            table.addRow('Wins', result.wins);
            table.addRow('Losses', result.losses);
            table.addRow('Win %', ((result.wins/rolls)*100).toFixed(2));

            await msg.channel.send(`\`\`\`\n${table.toString()}\`\`\``);
        }
        return 0;
    }
}