import path from "path";
import fs from "fs";

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
        if(p.endsWith('.js')){
            try{
                require(p);
            }catch(e){
                loadingErrors.push(e);
            }
        }
    }
}
export function loadAllCommands() {
    load()
    .then( () => {
        if(loadingErrors.length > 0){
            throw `Errors registering commands ${loadingErrors}`;
        }
    }).catch(e => console.log(e));
}
