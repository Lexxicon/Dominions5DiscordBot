
require('dotenv').config();

const Discord = require('discord.js');
const commandHandler = require('./src/js/commands/commandHandler.js');
const util = require('./src/js/util.js');

const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;

function cleanup(){
    console.info('Goodbye');
}

process.on('cleanup',cleanup);

// do app specific cleaning before exiting
process.on('exit', function () {
  process.emit('cleanup');
});

// catch ctrl+c event and exit normally
process.on('SIGINT', function () {
  console.log('Ctrl-C...');
  process.exit(2);
});

//catch uncaught exceptions, trace, then exit normally
process.on('uncaughtException', function(e) {
  console.log(`Uncaught Exception: ${e.name}:${e.description}`);
  console.log(e.stack);
  process.exit(99);
});

// bot.login(TOKEN).then(s => {
//   console.info(`Logged in as ${bot.user.tag}!`);
//   commandHandler.init(bot);
// }).catch(err => {
//     console.error(err);
//     throw err;
// });
require('./src/js/nationParser.js').loadNations().then(console.log);
