import { getLogger } from "log4js";
import { Game, saveGame } from "../../DominionsGame";
import { GuildMessage } from "../../global";
import { Permission } from "../../Permissions";
import { GameCommand } from "../GameCommandHandler";
import AsciiTable from 'ascii-table';
import AsciiChart from 'asciichart';
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
            let result = {wins: 0, losses: 0, values: [] as number[]};
            let count = 0;
            let sum = 0;
            while(count++ < 1000){
                let atkDrn = this.drn(0) + this.drn(0) + atk;
                let defDrn = this.drn(0) + this.drn(0) + def;
                let roll = atkDrn - defDrn;
                sum += roll;
                result.values.push(roll);
                if(roll > 0){
                    result.wins++;
                }else{
                    result.losses++;
                }
            }
            result.values = result.values.sort((a, b) => a - b);
            let rolls = result.wins + result.losses;
            
            let ones: number[] = [];
            let breakdown: number[] = [];
            let granularity = 30;
            for(let i = 0; i < granularity; i++){
                ones[i] = 1;
                let index = Math.floor((i/granularity) * result.values.length);
                //exclude the lowest and highest rolls
                index = Math.max(10, Math.min(result.values.length - 10, index));
                breakdown[i] = result.values[index];
            }
            
            let table = new AsciiTable(`${atk} vs ${def}`);
            table.addRow('Rolls', rolls);
            table.addRow('Wins', result.wins);
            table.addRow('Losses', result.losses);
            table.addRow('Avg', (sum/count).toFixed(2));
            table.addRow('Win %', ((result.wins/rolls)*100).toFixed(2));

            let tableStr = table.toString().split('\n') as string[];
            let graph = AsciiChart.plot([ones, breakdown], {height: tableStr.length}).split('\n') as string[];
            let output: string[] = [];
            output.push('```');
            for(let i = 0; i < tableStr.length; i++){
                output.push(`${tableStr[i]} ${graph[i]}`);
            }
            output.push('```');
            await msg.channel.send(`${output.join('\n')}`);
        }
        return 0;
    }
}