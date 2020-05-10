const util = require('../util.js');
const pickRandom = util.pickRandom;

const CONSTANTS = require('../constants.js');


function renderConfig(config, parent = ''){
    const display = (value) => {
        return config.display ? config.display(value) : value;
    }
    const pad = 22;
    if(config.type){
        switch(config.type) {
            case 'VALUE':
                return `${parent.padEnd(pad)}: ${display(config.value)}\n`;
            case 'CHOICE': 
                return `${parent.padEnd(pad)}: ${display(config.value)} [${config.options.join(', ')}]\n`;
            case 'LIST': 
                let result = `${parent} [${config.options.join(', ')}]\n`;
                for(key of config.keys()){
                    result += `> [${key.padStart(2)}] ${config.keyDisplay(key)}`.padEnd(pad) + `: ${display(config.valueOf(key))}\n`;
                }
                return result;
            default: 
                return `ERROR [${parent}:${config}]\n`;
        }
    }else{
        let result = '';
        parent = parent ? parent + '.' : '';
        for(key of Object.keys(config)){
            result += renderConfig(config[key], `${parent}${key}`);
        }
        return result
    }
}

function setValue(cfg, value) {
    switch(cfg.type){
        case 'VALUE':
            if(!cfg.valid || cfg.valid(value)){
                cfg.value = value;
                return 1;
            }
            break;
        case 'CHOICE':
            if(cfg.options.includes(value)){
                cfg.value = value;
                return 1;
            }
            break;
        case 'LIST':
            let key = value.split(' ')[0];
            value = value.split(' ')[1];
            if(cfg.keys().includes(key)){
                if(cfg.options.includes(value)){
                    cfg.value[key] = value;
                }else if(!val){
                    delete cfg.value[key];
                }
            }
            return 1;

    }
    return -1;
}

/**
 * type: 
 *      'CATEGORY'  -- use the rest of the key's as parameters
 *      'VALUE'     -- some value. has function 'valid(value) => boolean' to test value
 *      'CHOICE'    -- option from list. has field 'options' array of valid choices
 *      'LIST'      -- list of values
 */

 
async function creatConfig(){
    const races = await require('../nationParser.js').loadNations();
    const getEra = () => {
        switch(cfg.setup.era.value){
            case 'EARLY': return 1;
            case 'MIDDLE': return 2;
            case 'LATE': return 3;
        }
    }
    const cfg = {};
    cfg.admin = {
        masterPass: {
            type: 'VALUE',
            value: util.makeId(10),
            valid: (v) => /^[a-zA-Z0-9]+$/.test(v),
            display: (v) => `${v}`.replace(/./g, '*')
        }
    };
    cfg.turns = {
        quickHost: {
            type: 'CHOICE',
            value: true,
            options: [true, false]
        },
        maxTurnTime: {
            value: '48',
            type: 'VALUE',
            valid: (v) => /^\d+$/
        },
        maxHoldups: {
            value: '2',
            type: 'VALUE',
            valid: (v) => /^\d+$/
        },
    };
    cfg.setup = {
        storyEvents: {
            type: 'CHOICE',
            value: 'ALL',
            options: Object.keys(CONSTANTS.STORY_EVENTS)
        },
        eventRarity: {
            type: 'CHOICE',
            value: 'COMMON',
            options: Object.keys(CONSTANTS.EVENTS)
        }, 
        map: {
            type: 'CHOICE',
            value:'MEDIUM',
            options: Object.keys(CONSTANTS.SIMPLE_RAND_MAP)
        },
        thrones: {
            level_1: {
                type: 'VALUE',
                value: 'AUTO',
                valid: (v) => /^(AUTO)|\d+$/.test(v)
            },
            level_2: {
                type: 'VALUE',
                value: 'AUTO',
                valid: (v) => /^(AUTO)|\d+$/.test(v)
            },
            level_3: {
                type: 'VALUE',
                value: 'AUTO',
                valid: (v) => /^(AUTO)|\d+$/.test(v)
            }
        },
        victoryPoints: {
            type: 'VALUE',
            value: 'AUTO',
            valid: (v) => /^(AUTO)|(0\.\d+)|\d+$/.test(v)
        },
        cataclysm: {
            type: 'VALUE',
            value: 'NONE',
            valid: (v) => /(NONE)|\d+/.test(v)
        },
        era: {
            type: 'CHOICE',
            value: 'RANDOM',
            options: ['RANDOM'].concat(Object.keys(CONSTANTS.ERA))
        },
        slots: {
            type: 'LIST',
            value: {},
            options: Object.keys(CONSTANTS.SLOTS),
            valueOf: (key) => cfg.setup.era.value == 'RANDOM' ? '' : cfg.setup.slots.value[key] ? cfg.setup.slots.value[key] : 'OPEN',
            keys: () => cfg.setup.era.value == 'RANDOM' ? ['<select era>'] : Object.keys(races[getEra()]),
            keyDisplay: (key) => cfg.setup.era.value == 'RANDOM' ? '' : races[getEra()][key].name
        }
    };
    return cfg;
}

async function generateName(){
    for(let i = 0; i < 30; i++){
        let name = pickRandom(CONSTANTS.GAME_NAME_PREFIX)+'-'+pickRandom(CONSTANTS.GAME_NAME_SUFFIX);
        let exists = util.exists(name);
        if(!exists){
            return name;
        }
    }
    throw new 'Failed to create valid name after 30 tries';
}

function startCreation(msg){

}

module.exports = {
    renderDefaultCFG: () => renderConfig(creatConfig()),
    creatConfig,
    renderConfig,
    setValue
}
