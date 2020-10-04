const log = require("log4js").getLogger();

declare global {
    interface Date {
        addHours(hours: number): Date;
        addMinutes(minutes: number): Date;
        addSeconds(seconds: number): Date;
        getSecondsFromNow(): number;
    }

    interface PromiseConstructor {
        withTimeout<T> (executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void, millis:number): Promise<T>;
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

async function withTimeout<T>(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void, millis:number): Promise<T> {
    let timeout = null as null | NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((resolve, reject) => {
        timeout = setTimeout(() => reject(`Timed out after ${millis} ms.`), millis);
    });
    return Promise.race([ new Promise<T>((resolve, reject) => {
        executor(resolve, reject);
        if(timeout){
            clearTimeout(timeout);
        }
    }), timeoutPromise ]);
};

Promise.withTimeout = withTimeout;
export {};