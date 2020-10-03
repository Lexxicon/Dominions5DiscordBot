const log = require("log4js").getLogger();

declare global {
    interface Date {
        addHours(hours: number): Date;
        addMinutes(minutes: number): Date;
        addSeconds(seconds: number): Date;
        getSecondsFromNow(): number;
    }
}

Date.prototype.addHours = function(h) {
    return this.addMinutes(h * 60);
};

Date.prototype.addMinutes = function(m) {
    return this.addSeconds(m * 60);
}

Date.prototype.addSeconds = function(m) {
    this.setTime(this.getTime() + (m * 1000));
    return this;
}

Date.prototype.getSecondsFromNow = function() {
    return Math.floor((this.getTime() - new Date().getTime()) / 1000);
};

export {};