
const util = require('./../util.js');

const commandHandlers = [
    require('./lobbyCommands.js'),
    require('./gameCommands.js'),
];

const defaultHandler = require('./generalCommands.js');

async function handleCommand(msg){
    if(!msg.content.startsWith(process.env.COMMAND_PREFIX)) return;
    const input = msg.content.substring(1);
    let split = input.indexOf(' ');
    split = split < 0 ? input.length : split;

    const command = input.substring(0, split);
    const arg = split >= input.length ? '' : input.substring(split + 1);

    let result = 0;
    let err = null;
    let processingReaction = null;
    try{
        processingReaction = await msg.react(util.emoji(':thinking:'))
        let handler = defaultHandler;
    
        for(h of commandHandlers){
            if(h.canHandle(msg)){
                handler = h;
                break;
            }
        }
        result = await handler.handle(msg, command, arg);
    } catch(e) {
        err = e;
    } finally {
        try{
            
            if(err){
                await msg.react(util.emoji(':exploding_head:'));
            }else if(result > 0){
                await msg.react(util.emoji(':thumbsup:'));
            }else{
                await msg.react(util.emoji(':thumbsdown:'));
            }

            if(processingReaction) processingReaction.remove();

            if(err){
                throw err;
            }
        }catch(e){
            if(err) throw err;
            throw e;
        }
    }
}

function init(bot){
    bot.on('message', handleCommand);
}

module.exports = {
    init
}