
const ERA_REGEX = /^-{5}\s+Era\s+(?<ERA>\d+)\s+-{5}$/;
const NATION_REGEX = /^\s*(?<ID>\d+)\s+(?<FULL_NAME>(?<NAME>.*),.*)$/;

async function loadNations(){
    const p = require('child_process').spawn(process.env.DOMINION_EXEC_PATH, ['--listnations']);
    p.stdout.setEncoding('utf8');
    let data = '';
    for await (const chunk of p.stdout) {
        data += chunk;
    }
    const exitCode = await new Promise( (resolve, reject) => {
        p.on('close', resolve);
    });
    if( exitCode) {
        throw new Error( `subprocess error exit ${exitCode}, ${error}`);
    }
    return parse(data);
}

function removeSpecialCharacters(value){
    return value.normalize("NFD").toLowerCase().replace(/[^\w]|[\u0300-\u036f]/g, '');
}

function parse(input){
    let result = {};
    let era = null;
    let eraPrefix = null;

    const toFileName = (name) => `${eraPrefix}_${removeSpecialCharacters(name)}`;

    for(let line of input.split('\n')){
        line = line.replace(/[\r\n]/g,'');
        if(ERA_REGEX.test(line)){
            era = Number(line.match(ERA_REGEX).groups.ERA);
            switch(era){
                case 1: eraPrefix = 'early'; break;
                case 2: eraPrefix = 'mid'; break;
                case 3: eraPrefix = 'late'; break;
                default: throw new Error(`Unsupported era! Era: ${era}`);
            }
        }else if(NATION_REGEX.test(line)){
            if(era === null) throw new Error('Invalid input! Missing Era!');
            if(!result[era]) result[era] = {};

            let groups = line.match(NATION_REGEX).groups;
            let nationData = {
                id: Number(groups.ID),
                name: groups.NAME,
                fullName: groups.FULL_NAME,
                cleanName: removeSpecialCharacters(groups.NAME),
                file: toFileName(groups.NAME)
            };
            result[era][nationData.id] = nationData;
        }
    }

    return result;
}

module.exports = {
    loadNations
}