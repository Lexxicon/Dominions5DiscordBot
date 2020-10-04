import path from "path";
import fs from "fs";

const loadingErrors:string[] = [];

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
                loadingErrors.push(e);
            }
        }
    }
}
export async function loadAllCommands() {
    await load();
    if(loadingErrors.length > 0){
        throw `Errors registering commands ${loadingErrors}`;
    }
}
