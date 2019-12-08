const path = require('path');
const fs = require('fs');
const sqLite = require('sqlite3').verbose();

const Appender = function(file, layout, logSize, options, timezoneOffset){
    this.file = file;
    this.layout = layout;
    this.logSize = logSize;
    this.options = options;
    this.timezoneOffset = timezoneOffset;
}

Appender.prototype._runCommand = async function(database, sqlCommand, parameters) {
    return new Promise((resolve, reject) => {
        database.run(sqlCommand, parameters, function(err){
            if(err){
                reject(err);
                return;
            }
            resolve();
        });
    });
}

Appender.prototype._getTableName = function(){
    let name = this.config.table;
    if(name == null || name.trim() == ''){
        name = 'log';
    }
    return name;
}

Appender.prototype._getTableCreationSql = function(){
    const col = function(name,type, isNullable = false){
        return `"${name}" ${type} ${isNullable ? '' : ' NOT NULL,'}`
    }
    const columns = [
        // We'll store the time as an epoch timestamp
        col('time', 'INTEGER'),
        col('data', 'TEXT'),
        col('level', 'TEXT'),
        col('category', 'TEXT')
    ];
    if(this.config != null && this.additionalFields != null){
        this.additionalFields.forEach(x=>{
            columns.push(col(x.name, x.type));
        });
    }
    const name = this._getTableName();
    let sql = `CREATE TABLE "${name}" (\n`;
    columns.forEach(x=>sql += x);
    // now trim off trailing comma
    sql = sql.substr(0,sql.length-1);
    sql += '\n);\n';
    sql += `CREATE INDEX "timeIndex" on "${name}"("time");`;
    return sql;
}

Appender.prototype.ensureSqLiteDbExists = async function(){
    const self = this;
    const openDb = function () {
        return new sqLite.Database(self.file);
    }
    if(!fs.existsSync(this.file)){
        const db = openDb();
        await self._runCommand(db, this._getTableCreationSql());
        return db;
    }
    return openDb();
}

Appender.prototype.writeToLog = async function(logData){
    console.log('stubbed writeToLog...');
}

/**
 * File Appender writing the logs to a text file. Supports rolling of logs by size.
 *
 * @param file file log messages will be written to
 * @param layout a function that takes a logEvent and returns a string
 *   (defaults to basicLayout).
 * @param logSize - the maximum size (in bytes) for a log file,
 *   if not provided then logs won't be rotated.
 * @param options - options to be passed to the underlying stream
 * @param timezoneOffset - optional timezone offset in minutes (default system local)
 */
async function createAppender(file, layout, logSize, options, timezoneOffset) {
    const logDbFullPath = path.normalize(file);
    const appender = new Appender(logDbFullPath, layout, logSize, options, timezoneOffset);
    await appender.ensureSqLiteDbExists();

    let canWrite = false;
    let buffer = [];

    function emptyBuffer() {
        let evt;
        /* eslint no-cond-assign:0 */
        while ((evt = buffer.shift())) {
            appender.writeToLog(evt);
        }
    }

    const app = function (loggingEvent) {
        // if (!writer.write(layout(loggingEvent, timezoneOffset) + eol, "utf8")) {
        //     process.emit('log4js:pause', true);
        // }
        if(canWrite){
            appender.writeToLog(loggingEvent);
        }
        else{
            // TODO: look at how https://github.com/log4js-node/log4js-node/blob/master/lib/appenders/tcp.js does this...
            buffer.push(loggingEvent);
        }
        console.log(loggingEvent);
    };

    app.reopen = function () {
        console.log('reopen');
        //writer.end(() => { writer = openTheStream(file, logSize, numBackups, options); });
    };

    app.sighupHandler = function () {
        debug('SIGHUP handler called.');
        app.reopen();
    };

    app.shutdown = function (complete) {
        process.removeListener('SIGHUP', app.sighupHandler);
        console.log('shutdown');
        //writer.end('', 'utf-8', complete);
    };

    // On SIGHUP, close and reopen all files. This allows this Appender to work with
    // logrotate. Note that if you are using logrotate, you should not set
    // `logSize`.
    process.on('SIGHUP', app.sighupHandler);

    return app;
}


function configure(config, layouts) {
    let layout = layouts.basicLayout;
    if (config.layout) {
        layout = layouts.layout(config.layout.type, config.layout);
    }

    return createAppender(
        config.filename,
        layout,
        config.maxLogSize,
        config,
        config.timezoneOffset
    );
}

module.exports.configure = configure;