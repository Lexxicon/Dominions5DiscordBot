const GAME_CONFIGS = {
    "dom5":{
        "name" : "Dominions 5",
        "installDir": `${process.env.DOMINION_INSTALL_PATH}`,
        "appID": 722060
    }
};

async function update(cfg) {
    const args = [];
    args.push(`+login ${process.env.STEAM_CMD_USER}`);
    args.push(`+force_install_dir ${cfg.installDir}`);
    args.push(`+app_update ${cfg.appID} validate`);
    args.push(`+quit`);
    const p = require('child_process').spawn(process.env.STEAM_CMD, args);
    console.log(`Updating ${cfg.name} [${cfg.appID}]`);
    const exitCode = await new Promise( (resolve, reject) => {
        p.on('close', resolve);
    });
    if( exitCode) {
        console.error(`Error updating ${cfg.name} [${cfg.appID}]`);
        throw new Error( `subprocess error exit ${exitCode}, ${error}`);
    }
    console.log(`Updated ${cfg.name} [${cfg.appID}]`);
}

update(GAME_CONFIGS.dom5).catch(console.error);

module.exports = {
    update
};