import { getLogger } from "log4js";
import {Command, registry} from "../commandLoader";


console.info("loaded");

new class extends Command{
    async execute(): Promise<number> {
        await new Promise( r => setTimeout(r, 1000));
        return 5;
    }
    getName(): string {
        return 'ExampleCommand';
    }
    getPath(): string {
        return __filename;
    }
}