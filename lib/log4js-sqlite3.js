const path = require('path');
const fs = require('fs');
const sqLite = require('sqlite3').verbose();
const util = require('util');
const debug = require('debug')('log4js-sqlite3');

const Appender = function(config){
    this.file = path.normalize(config.file);
    this.maxRecordCount = config.maxRecordCount;
    this.table = config.table;
    if(this.table == null || this.table.trim() == ''){
        this.table = 'log';
    }
    this.database = null;
    this.buffer = [];
    // If we're in the middle of a write, we'll store that promise here so
    // that we can keep track of outstanding writes and finish up gracefully when
    // shutdown is called.
    this.currentWrite = null;
    const col = function(name,type, isNullable = false, value = null){
        return { name, type, isNullable, value};
    };
    this.columns =  [
        // We'll store the time as an epoch timestamp
        col('time', 'INTEGER'),
        // The formatted text of the log entry.
        col('data', 'TEXT'),
        // An integer representation of the logging level, with trace < debug < info < warn < error
        col('level', 'INTEGER'),
        // The name of the logging level, such as debug or error.
        col( 'levelName', 'TEXT'),
        // The category that the log entry belongs to, as defined in the log4js logging config.
        col('category', 'TEXT')
    ];
    this.userDefinedColumns = [];
    if(config.additionalFields != null){
        config.additionalFields.forEach(x=>{
            const column = col(x.name, x.type, false, x.value);
            this.columns.push(column);
            this.userDefinedColumns.push(column);
        });
    }
    this.insertSql = this._getInsertSql()
    this._ensureSqLiteDbExists();
};

Appender.prototype.canWrite = function(){
    return this.database != null;
};

Appender.prototype._runCommand = async function(sqlCommand, parameters) {
    return new Promise((resolve, reject) => {
        this.database.run(sqlCommand, parameters, function(err){
            if(err){
                reject(err);
                return;
            }
            resolve();
        });
    });
};

Appender.prototype._getTableCreationSql = function(){
    let sql = `CREATE TABLE "${this.table}" (\n`;
    sql +=
        this.columns.map(x=> `"${x.name}" ${x.type} ${x.isNullable ? '' : ' NOT NULL'}`)
            .join(',\n');
    sql += '\n);\n';
    sql += `CREATE INDEX "timeIndex" on "${this.table}"("time");`;
    return sql;
};

Appender.prototype._getInsertSql = function(){
    const colNames = this.columns.map(x=>x.name).join(', ');
    const placeholders = this.columns.map(() => '?').join(', ');
    return`INSERT INTO  ${this.table} (${colNames}) VALUES(${placeholders});`;
};

Appender.prototype._ensureSqLiteDbExists = async function(){
    debug('Initializing db connection.');
    const self = this;

    const openDb = async function () {
        let newDb = null;
        return await new Promise((resolve, reject)=> {
            debug('opening db', self.file);
            newDb = new sqLite.Database(self.file, (err)=>{
                if(err){
                    console.error('FAILED TO OPEN DB', err);
                    reject(err);
                }
                else{
                    resolve(newDb);
                }
            });
        });
    };
    const isNewDb = !fs.existsSync(this.file);
    this.database = await openDb();
    if(isNewDb){
        debug('Initializing new db');
        await self._runCommand(this._getTableCreationSql());
    }
    debug('Initialized database connection.');
    await this._emptyBuffer();
    debug('Done initializing db.');
    return this.database;
};

Appender.prototype._writeToLog = async function(logData){
    if(this.canWrite()){
        debug('stubbed _writeToLog...', logData);
    }
    else{
        console.warn('Missed write: database was already closed.', logData)
    }

    const formattedData = util.format(...logData.data);
    const sqlArgs = [logData.startTime.getTime(), formattedData, logData.level.level, logData.level.levelStr, logData.categoryName];
    this.userDefinedColumns.forEach(x => sqlArgs.push(x.value));
    await this._runCommand(this.insertSql, sqlArgs);
};

Appender.prototype._emptyBuffer = async function(){
    debug('called _emptyBuffer.  Found', this.buffer.length, 'queued entries.');
    let evt;
    while ((evt = this.buffer.shift())) {
        await this._writeToLog(evt);
    }
    debug('Finished emptying buffer.')
};

Appender.prototype.writeToLog = async function(logEvent){
    debug('called writeToLog');
    if(this.currentWrite != null){
        await this.currentWrite;
    }
    this.buffer.push(logEvent);
    if(this.canWrite()){
        this.currentWrite = this._emptyBuffer();
    }
    else{
        debug('Still can\'t write to db: just adding to buffer.');
    }
    await this.currentWrite;
};

Appender.prototype.shutDown = async function(){
    let remainingSeconds = 15;
    let writesRemaining = this.buffer.length;

    while(writesRemaining > 0 && remainingSeconds > 0 ){
        await new Promise((resolve)=> {
            setTimeout(resolve, 1000);
        });
        // As long as we're going in the right direction, we'll
        // keep writing.  Otherwise, we'll keep counting down
        if(this.buffer.length >= writesRemaining){
            remainingSeconds--;
        }
        writesRemaining = this.buffer.length;
    }
    if(writesRemaining > 0){
        console.warn('Forcing log4js logger shutdown with', writesRemaining, 'unwritten.');
    }
    const db = this.database;
    // Null out the db reference so that any of our methods can see that it's time to quit now that we're shutting down.
    this.database = null;
    await new Promise((resolve, reject) => {
        db.close((err)=> {
            if(err){
                reject(err);
            }
            else{
                resolve();
            }
        })
    })
};

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
 * @param table - the name of the table that we'll write logs to.
 */
function createAppender(config) {
    const appender = new Appender(config);

    const app = function (loggingEvent) {
        debug('Writing entry to log.', loggingEvent);
        appender.writeToLog(loggingEvent);
    };

    app.reopen = function () {
        debug('reopen');
    };

    app.sighupHandler = function () {
        debug('SIGHUP handler called.');
        app.reopen();
    };

    app.shutdown = async function (complete) {
        await appender.shutDown();
        process.removeListener('SIGHUP', app.sighupHandler);
        debug('shutdown');
        complete();
    };

    // On SIGHUP, close and reopen all files. This allows this Appender to work with
    // logrotate. Note that if you are using logrotate, you should not set
    // `logSize`.
    process.on('SIGHUP', app.sighupHandler);
    return app;
}


function configure(config) {
    return createAppender(
        config
    );
}

module.exports.configure = configure;