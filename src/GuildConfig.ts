
export class GuildConfig {
    guildID: string;

    commandPrefix: string;

    gamesCategoryName: string;
    serverLobbyID: string;

    serverAdminRoleID: string;
    serverHostID: string;

    constructor(
        guildID: string,
        commandPrefix: string, 
        gamesCategoryName: string, 
        serverLobbyID: string, 
        serverAdminRoleID: string, 
        serverHostID: string)
    {
        this.guildID = guildID;
        this.commandPrefix = commandPrefix;
        this.gamesCategoryName = gamesCategoryName;
        this.serverLobbyID = serverLobbyID;
        this.serverAdminRoleID = serverAdminRoleID;
        this.serverHostID = serverHostID;
    }
}