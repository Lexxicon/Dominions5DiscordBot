import { LobbyCommand } from "../LobbyCommandHandler";

new class extends LobbyCommand{
    getName(): string[] {
        return ['join', 'claim'];
    }
    getPath(): string {
        return __filename;
    }
    execute(): Promise<number> {
        throw new Error("Method not implemented.");
    }
}