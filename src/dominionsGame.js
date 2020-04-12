
const _ = require("lodash");
const config = require("../res/config.json");
const CONSTANTS = require("./constants.js");
const util = require('./util.js');

function create(name, channel){
    const game = {
        name: name,
        settings: {
            server: {
                port: config.DEFAULT_PORT
            },
            turns:{
                quickHost: true,
                maxTurnTime: 36,
                maxHoldups: 0,
            },
            setup: {
                masterPass: 'RXAYQ',
                era: 'EARLY', //[EARLY=1, MIDDLE=2, LATE=3]
                storyEvents: 'SOME', //[NONE, SOME, ALL]
                eventRarity: 'COMMON', // [common=1, rare=2]
                map: 'MEDIUM', // [SMALL, MEDIUM, LARGE] or name of actual map
                slots: { //nationID: difficulty
                    6: 'EASY', //--easyai 6
                    7: 'NORMAL', //--normai 7
                    8: 'DIFFICULT', //--diffai
                    9: 'MIGHTY', //--mightyai
                    10: 'MASTER', //--masterai
                    11: 'IMPOSSIBLE', //--impai
                    12: 'BANNED' //--closed
                },
                thrones: [3, 2, 0],
                victoryPoints: 0,
                cataclysm: 0
            }
        },
        discord: {
            channel: channel,
            guild: channel.guild,
            players:{
                //playerID : nationID
            }
        }
    };

    return game;
}


function getLaunchArgs(config){
    const server = config.settings.server;
    const turns = config.settings.turns;
    const setup = config.settings.setup;

    const args = [];
    // --- standard launch args ---
    args.push("--nosound");
    args.push("--nosteam");
    args.push("--textonly");

    // --- server settings ---
    args.push("--tcpserver");
    args.push("--port " + server.port);
    args.push("--statusdump");

    // --- turn settings ---
    if(!turns.quickHost) args.push("--noquickhost");
    if(turns.maxTurnTime) args.push("--hours " + turns.maxTurnTime);
    if(turns.maxHoldups) args.push("--maxholdups " + turns.maxHoldups)

    //new game settings
    args.push("--noclientstart");
    args.push("--masterpass " + setup.masterPass);
    args.push("--thrones " + _.join(setup.thrones," " ));
    if(setup.victoryPoints) args.push("--requiredap " + setup.victoryPoints);
    if(setup.cataclysm) args.push("--cataclysm " + setup.cataclysm);
    if(CONSTANTS.SIMPLE_RAND_MAP[setup.map]){
        args.push(CONSTANTS.SIMPLE_RAND_MAP[setup.map]);
    }else{
        args.push("--mapfile " + setup.map);
    }
    args.push(CONSTANTS.ERA[setup.era]);
    args.push(CONSTANTS.STORY_EVENTS[setup.storyEvents]);
    args.push(CONSTANTS.EVENTS[setup.eventRarity]);
    for(k in setup.slots){
        args.push(CONSTANTS.SLOTS[setup.slots[k]].replace('__NATION_ID__', k));
    }
    args.push(config.name);

    return _.join(args, " ");
}

module.exports = {
    create,
    getLaunchArgs
};