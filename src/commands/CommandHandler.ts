import { getLogger } from "log4js";

const log = getLogger();

export enum CommandType {
    ANYWHERE,
    DIRECT_MESSAGE,
    SERVER_LOBBY,
    GAME_LOBBY,
}