import path from "path";
import fs from "fs";

const registry:{[index: string]: Command} = {};
const loadingErrors:string[] = [];

async function* walk(dir) {
    for await (const d of await fs.promises.opendir(dir)) {
        const entry = path.join(dir, d.name);
        if (d.isDirectory()) yield* walk(entry);
        else if (d.isFile()) yield entry;
    }
}


async function load() {
    for await (const p of walk(__dirname) as string){
        console.log(p)
        if(p.endsWith('.js')){
            require(p);
        }
    }
}

export abstract class Command {
    
    public get value() : {} {
        return registry;
    }

    constructor(){
        if(registry[this.getName()]){
            loadingErrors.push(`Duplicate command! ${this.getName()} ${this.getPath()}`);
        }
        this.value[this.getName()] = this;
    }

    abstract getName(): string;
    abstract getPath(): string;
    abstract async execute(): Promise<number>;
}

export {registry}

load()
.then( () => {
    if(loadingErrors.length > 0){
        throw `Errors registering commands ${loadingErrors}`;
    }

    for(let cmd in registry){
        registry[cmd].execute().then(v => console.log(v));
    }
    console.log(JSON.stringify(registry));
}).catch(e => console.log(e));