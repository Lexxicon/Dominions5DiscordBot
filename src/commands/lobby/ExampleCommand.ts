import { getLogger } from "log4js";
import {LobbyCommand} from "../LobbyCommandHandler";


console.info("loaded");

new class extends LobbyCommand{
    async execute() {
        await new Promise( r => setTimeout(r, 1000));
        return 5;
    }
    getName() {
        return ['ExampleCommand'];
    }
    getPath() {
        return __filename;
    }
}