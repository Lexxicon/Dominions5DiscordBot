
export const EMOJI = {
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
        ":clock3:":     "🕒",
        ":turtle:":     "🐢",
        ":checkBox:":   "☑️",
        ":x:":          "❌",
        ":no_entry_sign:": "🚫",
        ":thinking:":   "🤔",
        ":spy:":        "🕵️",
        ":save:":       "💾",
        ":sleeping:":   "😴",
    };
export const ERA = {
        "EARLY": ["--era","1"],
        "MIDDLE": ["--era","2"],
        "LATE": ["--era","3"]
    };
export const STORY_EVENTS = {
        "NONE": "--nostoryevents",
        "SOME": "--storyevents",
        "ALL": "--allstoryevents"
    };
export const EVENTS = {
        "COMMON": ["--eventrarity","1"],
        "RARE": ["--eventrarity","2"]
    };
export const SLOTS = {
        "BANNED": "--closed",
        "EASY": "--easyai",
        "NORMAL": "--normai",
        "DIFFICULT": "--diffai",
        "MIGHTY": "--mightyai",
        "MASTER": "--masterai",
        "IMPOSSIBLE": "--impai"
    };
export const SIMPLE_RAND_MAP = {
        "SMALL": ["--randmap", "10", "--vwrap"],
        "MEDIUM": ["--randmap", "15", "--vwrap"],
        "LARGE": ["--randmap", "20", "--vwrap"]
    };
export const PLAYER_STATUS = {
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
    };
export const AI_DIFFICULTY = {
        "0" : `Human`,
        "1" : `${EMOJI[":robot:"]} Easy`,
        "2" : `${EMOJI[":robot:"]} Normal`,
        "3" : `${EMOJI[":robot:"]} Difficult`,
        "4" : `${EMOJI[":robot:"]} Mighty`,
        "5" : `${EMOJI[":robot:"]} Master`,
        "6" : `${EMOJI[":robot:"]} Impossible`
    };
export const TURN_STATE = {
        "0": {
            id: 0,
            ready: false,
            display: "Waiting",
            short: EMOJI[":clock3:"]
        },
        "1": {
            id: 1,
            ready: false,
            display: "Partial",
            short: EMOJI[":turtle:"]
        },
        "2": {
            id: 2,
            ready: true,
            display: "Done",
            short: EMOJI[":checkBox:"]
        },
        "9": { //lobby?
            id: 9,
            ready: false,
            display: "-",
            short: ""
        }
    };