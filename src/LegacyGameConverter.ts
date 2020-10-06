import { getLogger } from "log4js";

const log = getLogger();

export function adaptGame(rawGame: any){
    let savedVersion:number = rawGame.version || 0;
    while(savedVersion < GAME_BINARY_VERSION){
        log.info(`Updating ${rawGame.name} from version ${savedVersion}`);
        if(BINARY_CONVERTERS[savedVersion]){
            rawGame = BINARY_CONVERTERS[savedVersion](rawGame);
        }
        savedVersion++;
        rawGame.version = savedVersion;
    }
    return rawGame;
}

export const GAME_BINARY_VERSION = 2;

const INDEXED_NATIONS = 1;
const ORIGINAL_VERSION = 0;

const BINARY_CONVERTERS: Array<(raw: any) => object> = [];

BINARY_CONVERTERS[INDEXED_NATIONS] = (raw) => {
    if(raw.playerStatus && raw.playerStatus.length){
        let index: any[] = [];
        for(let nation of raw.playerStatus){
            index[Number(nation.nationID)] = nation;
        }
        raw.playerStatus = index;
    }
    return raw;
}

BINARY_CONVERTERS[ORIGINAL_VERSION] = (raw) =>{

    raw.settings.server.masterPass = raw.settings.setup.masterPass;
    delete raw.settings.setup.masterPass;

    raw.settings.turns.maxHoldUps = 2;
    let thrones = {
        level1: raw.settings.setup.thrones[0],
        level2: raw.settings.setup.thrones[1],
        level3: raw.settings.setup.thrones[2]
    }
    raw.settings.setup.thrones = thrones;

    delete raw.discord.gameLobbyChannelId;
    
    return raw;
}