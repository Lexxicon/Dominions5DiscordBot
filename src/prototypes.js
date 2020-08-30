const log = require("log4js").getLogger();

Date.prototype.addHours = function(h) {
    this.setTime(this.getTime() + (h * 60 * 60 * 1000));
    return this;
};

Date.prototype.getSecondsFromNow = function() {
    return Math.floor((this.getTime() - new Date().getTime()) / 1000);
};