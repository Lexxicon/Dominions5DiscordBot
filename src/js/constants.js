module.exports = {
    EMOJI: {
        ":thumbsup:":   "👍",
        ":thumbsdown:":  "👎",
        ":robot:":      "🤖",
        ":zero:":       "0️⃣",
        ":one:":        "1️⃣",
        ":two:":        "2️⃣",
        ":three:":      "3️⃣",
        ":four:":       "4️⃣",
        ":five:":       "5️⃣",
        ":six:":        "6️⃣",
        ":seven:":      "7️⃣",
        ":eight:":      "8️⃣",
        ":nine:":       "9️⃣",
        ":ten:":        "🔟",
        ":x:":          "❌",
        ":no_entry_sign:": "🚫",
        ":thinking:":   "🤔",
        ":exploding_head:": "🤯"
    },
    ERA: {
        "EARLY": ["--era","1"],
        "MIDDLE": ["--era","2"],
        "LATE": ["--era","3"]
    },
    STORY_EVENTS: {
        "NONE": "--nostoryevents",
        "SOME": "--storyevents",
        "ALL": "--allstoryevents"
    },
    EVENTS: {
        "COMMON": ["--eventrarity","1"],
        "RARE": ["--eventrarity","2"]
    },
    SLOTS: {
        "BANNED": "--closed",
        "OPEN": "",
        "EASY": "--easyai",
        "NORMAL": "--normai",
        "DIFFICULT": "--diffai",
        "MIGHTY": "--mightyai",
        "MASTER": "--masterai",
        "IMPOSSIBLE": "--impai"
    },
    SIMPLE_RAND_MAP: {
        "SMALL": ["--randmap", "10", "--vwrap"],
        "MEDIUM": ["--randmap", "15", "--vwrap"],
        "LARGE": ["--randmap", "20", "--vwrap"],
        "XLARGE": ["--randmap", "25", "--vwrap"]
    },
    PLAYER_STATUS: {
        "-2": {
            id: -2,
            canBlock: false,
            display: "Defeated this turn"
        },
        "-1": {
            id: -1,
            canBlock: false,
            display: "Defeated"
        },
        "0": {
            id: 0,
            canBlock: false,
            display: "-"
        },
        "1": {
            id: 1,
            canBlock: true,
            display: "Player"
        },
        "2": {
            id: 2,
            canBlock: false,
            display: "AI"
        }
    },
    AI_DIFFICULTY: {
        "0" : "Human",
        "1" : "[bot] Easy",
        "2" : "[bot] Normal",
        "3" : "[bot] Difficult",
        "4" : "[bot] Mighty",
        "5" : "[bot] Master",
        "6" : "[bot] Impossible"
    },
    TURN_STATE: {
        "0": {
            ready: false,
            display: "Waiting"
        },
        "1": {
            ready: false,
            display: "Waiting (Partial)"
        },
        "2": {
            ready: true,
            display: "Done"
        },
        "9": { //lobby?
            ready: false,
            display: "-"
        }
    },
    GAME_NAME_PREFIX: [
        "Acrid",
        "Brave", 
        "Calm", 
        "Dark", 
        "Epic", 
        "Fiery", 
        "Grim", 
        "Heroic", 
        "Icy", 
        "Joyous", 
        "Kindly",
        "Lost",
        "Magic",
        "Nasty",
        "Old",
        "Petty",
        "Quiet",
        "Regal",
        "Sacred",
        "Tense",
        "Upset",
        "Vain",
        "Wicked",
        "Xeric",
        "Young",
        "Zesty"],
    GAME_NAME_SUFFIX:[
        "Atoll",
        "Brand", 
        "Cave", 
        "Desert", 
        "Expanse", 
        "Fort", 
        "Glade", 
        "Hills", 
        "Inn", 
        "Jarl", 
        "Kettle",
        "Lands",
        "Mask",
        "Nation",
        "Oasis",
        "Parish",
        "Quest",
        "Relic",
        "Sanctum",
        "Tunnel",
        "Utopia",
        "Volcano",
        "Wilds",
        "Xenolith",
        "Yurt",
        "Zenith"
    ]
}