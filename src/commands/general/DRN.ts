import { getLogger } from "log4js";
import { Game, saveGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";
import AsciiTable from 'ascii-table';
import AsciiChart from 'asciichart';
import Util from "../../Util";
import { GeneralCommand, CommandLocation } from "../CommandHandler";
import { Message } from "discord.js";

function logBase(x, y){
    return Math.log(y) / Math.log(x);
}

const log = getLogger();
const VAL_REGEX = /(?<ATK>\d+)\s*vs?\s*(?<DEF>\d+)/;
new class extends GeneralCommand{
    getNeededPermission(): Permission {
        return Permission.ANY;
    }
    getCommandType() {
        return CommandLocation.ANYWHERE;
    }
    getName(): string[] {
        return ['drn'];
    }
    getPath(): string {
        return __filename;
    }

    drn(depth: number){
        if(depth > 20) return 10000;
        const roll = Math.ceil(Math.random() * 6);
        if(roll == 6){
            return 5 + this.drn(depth++);
        }
        return roll;
    }

    async execute(msg: Message, arg: string): Promise<number> {
        const match = VAL_REGEX.exec(arg);
        if(match && match?.groups){
            const atk = Number(match.groups['ATK']);
            const def = Number(match.groups['DEF']);
            const result = {wins: 0, losses: 0, values: [] as number[]};
            let count = 0;
            let sum = 0;
            while(count++ < 1000){
                const atkDrn = this.drn(0) + this.drn(0) + atk;
                const defDrn = this.drn(0) + this.drn(0) + def;
                const roll = atkDrn - defDrn;
                sum += roll;
                result.values.push(roll);
                if(roll > 0){
                    result.wins++;
                }else{
                    result.losses++;
                }
            }
            result.values = result.values.sort((a, b) => a - b);
            const rolls = result.wins + result.losses;
            
            const zero: number[] = [];
            const breakdown: number[] = [];
            const granularity = 30;
            for(let i = 0; i < granularity; i++){
                zero[i] = 0;
                let index = Math.floor((i/granularity) * result.values.length);
                //exclude the lowest and highest rolls
                index = Math.max(10, Math.min(result.values.length - 10, index));
                breakdown[i] = result.values[index];
            }
            
            const table = new AsciiTable(`${atk} vs ${def}`);
            table.addRow('Avg', (sum/count).toFixed(2));
            table.addRow('Win %', ((result.wins/rolls)*100).toFixed(2));
            table.addRow('50% win',Math.ceil(logBase(.5, (result.wins / rolls))));
            table.addRow('75% win',Math.ceil(logBase(.75, (result.wins / rolls))));
            table.addRow('90% win',Math.ceil(logBase(.9, (result.wins / rolls))));
            table.addRow('95% win',Math.ceil(logBase(.95, (result.wins / rolls))));

            const tableStr = table.toString().split('\n') as string[];
            const graph = AsciiChart.plot([zero, breakdown], {height: tableStr.length}).split('\n') as string[];
            const output: string[] = [];
            output.push('```');
            for(let i = 0; i < tableStr.length; i++){
                output.push(`${tableStr[i]} ${graph[i]}`);
            }
            output.push('```');
            await msg.channel.send(`${output.join('\n')}`);
        }
        return 0;
    }
};