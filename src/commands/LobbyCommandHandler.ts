

import { Game } from '../DominionsGame';
import { GuildMessage } from '../global';


const registry:{[index: string]: LobbyCommand} = {};
const loadingErrors:string[] = [];

export abstract class LobbyCommand {
    
    public get value() : {} {
        return registry;
    }

    constructor(){
        for(let name of this.getName()){
            if(registry[name]){
                loadingErrors.push(`Duplicate command! ${this.getName()} ${this.getPath()}`);
            }else{
                this.value[name] = this;
            }
        }
    }

    abstract getName(): string[];
    abstract getPath(): string;
    abstract async execute(msg: GuildMessage, game: Game, args: string): Promise<number>;
}
