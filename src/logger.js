const log4js = require("log4js");

log4js.configure({
    appenders: {
        console: {
          type: 'stdout',
          layout: {
            type: 'pattern', 
            pattern: '%d %p %c %f{2}:%l %m'
          }
        },
        file: { 
            type: 'dateFile', 
            filename: 'output.log', 
            pattern: '.yyyy-MM-dd', 
            daysToKeep: 7,
            layout: {
              type: 'pattern', 
              pattern: '%d %p %c %f{2}:%l %m'
            }
        },
      },
      categories: {
        default: { appenders: ['console', 'file'], level: 'debug', enableCallStack: true }
      }
});

log4js.getLogger().info(``);
log4js.getLogger().info(`-------------- Application Starting ${new Date()} --------------`);
log4js.getLogger().info(``);


module.exports = {
    shutdown: log4js.shutdown
}