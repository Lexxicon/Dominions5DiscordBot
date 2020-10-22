import { Message } from "discord.js";
import { getLogger } from "log4js";
import { Permission } from "../../Permissions";
import Util from "../../Util";
import { GeneralCommand, CommandLocation } from "../CommandHandler";

const log = getLogger();
const VAL_REGEX = /(?<ATK>\d+)\s*vs?\s*(?<DEF>\d+)/;
new class extends GeneralCommand{
    getNeededPermission(): Permission {
        return Permission.ANY;
    }
    getCommandType() {
        return CommandLocation.ANYWHERE;
    }
    getName(): string[] {
        return ['tip'];
    }
    getPath(): string {
        return __filename;
    }
    async execute(msg: Message, arg: string): Promise<number> {
        await msg.channel.send(Util.getRandomTip());
        return 0;
    }
};