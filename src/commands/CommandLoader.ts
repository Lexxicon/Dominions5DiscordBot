import path from "path";
import fs from "fs";
import {loadingErrors} from './CommandHandler';

const loadingExceptions:Error[] = [];

async function* walk(dir: string) {
    for await (const d of await fs.promises.opendir(dir)) {
        const entry = path.join(dir, d.name);
        if (d.isDirectory()) yield* walk(entry);
        else if (d.isFile()) yield entry;
    }
}

async function load() {
    for await (const p of walk(__dirname) as string){
        if(p.endsWith('.js')){
            try{
                require(p);
            }catch(e){
                loadingExceptions.push(new Error(e));
            }
        }
    }
}
export async function loadAllCommands() {
    await load();
    if(loadingExceptions.length > 0){
        throw `Errors registering commands\n${loadingExceptions.map(e => `${e.name} ${e.stack}`).join('\n')}\n${loadingErrors}`;
    }
}
