const gameConfig = require('./../game/gameConfig.js');

let config = null;
let cfgMsg = null;

async function handle(msg, cmd, arg){
    console.info(`Handling Lobby Command ${msg}, ${cmd}, ${arg}`);
    let result = -1;
    switch(cmd){
        case 'test': 
            result = 1; 
            break;
        case 'fail': 
            result = 0; 
            break;
        case 'err': 
            throw 'example err';

        case 'cfg': 
            if(config == null) config = await gameConfig.creatConfig();
            if(cfgMsg == null) cfgMsg = await msg.channel.send("...");
            if(arg){
                let path = arg.split(' ')[0].split('.');
                const value = arg.substring(arg.split(' ')[0].length + 1);
                console.info(path + ", " + value);
                let o = config;
                for(let k of path) o = o[k];
                
                result = gameConfig.setValue(o, value);
            }else{
                result = 1
            }
            await cfgMsg.edit('```'+gameConfig.renderConfig(config)+'```');
            setTimeout(() => msg.delete(), 1500);
            break;
    }
    return result;
}


module.exports = {
    handle
}