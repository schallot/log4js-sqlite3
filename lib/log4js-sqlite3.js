const path = require('path');
const fs = require('fs');
const sqLite = require('sqlite3').verbose();

const Appender = function(file, layout, logSize, options, timezoneOffset, table){
    this.file = file;
    this.layout = layout;
    this.logSize = logSize;
    this.options = options;
    this.timezoneOffset = timezoneOffset;
    this.table = table;
    this.database = null;
    this.config = options;
    this.buffer = [];
    // If we're in the middle of a write, we'll store that promise here so
    // that we can keep track of outstanding writes and finish up gracefully when
    // shutdown is called.
    this.currentWrite = null;
}

Appender.prototype.canWrite = function(){
    return this.database != null;
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
    if(this.config != null && this.config.additionalFields != null){
        this.config.additionalFields.forEach(x=>{
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

Appender.prototype._ensureSqLiteDbExists = async function(){
    console.log('Initializing db connection.')
    const self = this;

    const openDb = async function () {
        let newDb = null;
        return await new Promise((resolve, reject)=> {
            console.log('opening db', self.file);
            newDb = new sqLite.Database(self.file, (err)=>{
                if(err){
                    console.error('FAILED TO OPEN DB', err);
                }
                else{
                    resolve(newDb);
                }
            });
        });
    }
    if(!fs.existsSync(this.file)){
        const db = await openDb();
        await self._runCommand(db, this._getTableCreationSql());
        return db;
    }
    this.database = await openDb();
    console.log('Initialized database connection.')
    await this._emptyBuffer();
    return this.database;
}

Appender.prototype._writeToLog = async function(logData){
    if(this.canWrite()){
        console.log('stubbed _writeToLog...', logData);
    }
    else{
        console.warn('Missed write: database was already closed.', logData)
    }
}

Appender.prototype._emptyBuffer = async function(){
    console.log('called _emptyBuffer');
    let evt;
    while ((evt = buffer.shift())) {
        await this._writeToLog(evt);
    }
}

Appender.prototype.writeToLog = async function(logEvent){
    console.log('called writeToLog');
    if(this.currentWrite != null){
        await this.currentWrite;
    }
    this.buffer.push(logEvent);
    if(this.canWrite()){
        this.currentWrite = this._emptyBuffer();
    }
    else{
        console.log('Still can\'t write to db: just adding to buffer.');
    }
    await this.currentWrite;
}

Appender.prototype.shutDown = async function(){
    let remainingSeconds = 5;
    let writesRemaining = this.buffer.length;

    while(writesRemaining > 0 && remainingSeconds > 0 ){


        console.log('Shutting down logging.  Waiting for ', writesRemaining , ' entries to finish writing...');
        await new Promise((resolve)=> {
            setTimeout(resolve, 1000);
        });
        remainingSeconds--;
        writesRemaining = this.buffer.length;
    }
    if(writesRemaining > 0){
        console.warn('Forcing shutdown with ', writesRemaining, ' unwritten.');
    }
    this.database = null;
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
function createAppender(file, layout, logSize, options, timezoneOffset, table) {
    const logDbFullPath = path.normalize(file);
    const appender = new Appender(logDbFullPath, layout, logSize, options, timezoneOffset);

    appender._ensureSqLiteDbExists();

    const app = function (loggingEvent) {
        appender.writeToLog(loggingEvent);
    };

    app.reopen = function () {
        console.log('reopen');
        //writer.end(() => { writer = openTheStream(file, logSize, numBackups, options); });
    };

    app.sighupHandler = function () {
        debug('SIGHUP handler called.');
        app.reopen();
    };

    app.shutdown = async function (complete) {
        await appender.shutDown();
        process.removeListener('SIGHUP', app.sighupHandler);
        console.log('shutdown');
        complete();
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
        config.timezoneOffset,
        config.table
    );
}

module.exports.configure = configure;