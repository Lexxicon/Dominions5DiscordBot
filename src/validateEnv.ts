import fs from "fs";

const log = require("log4js").getLogger();

let shouldThrow = false;
let keyRegex = /^(\S+)=.*/;
let error = '';

function validateKeys(line: string){
    let key = line.match(keyRegex) as any;
    if(key && key['1'] && !process.env[key[1]]){
        shouldThrow = true;
        let er = `Failed to find binding for ${key[1]} - ${process.env[key[1]]}`
        log.error(er);
        error = `${error}${er}\n`;
    }
}

fs.readFileSync('.env.example', { encoding: 'utf-8' })
    .split('\n')
    .forEach(validateKeys);

if(shouldThrow){
    throw error;
}