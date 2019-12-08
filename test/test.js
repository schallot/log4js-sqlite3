const describe = require('mocha').describe;
const it = require('mocha').it;
const log4js = require('log4js');
const assert = require('assert');
const sqlite = require('sqlite3').verbose();
const fs = require('fs');

const test1 =  async function(done) {
  const dbFile = './test/test.sqlite';
  if(fs.existsSync(dbFile)){
    fs.unlinkSync(dbFile);
  }
  const logTable = 'logTest';
  log4js.configure({
    appenders: {
      database: {
        type: "lib/log4js-sqlite3",
        filename: dbFile,
        table: logTable,
        useNullAsDefault: true,
        additionalFields: [
          {name: 'customColumn1', value: 'custom value 1', type: 'TEXT' },
          {name: 'customColumn2', value: '222', type: 'INTEGER' },
        ]
      },
    },
    categories: {
      default: {
        appenders: ['database'], level: 'info'
      },
      ANOTHER_CATEGORY: {
        appenders: ['database'], level: 'info'
      }
    }
  });

  const defaultLog = log4js.getLogger();
  const anotherLog = log4js.getLogger('ANOTHER_CATEGORY');

  defaultLog.info('first log entry');
  defaultLog.trace('this log entry is too low of a level to reach the database');
  anotherLog.error('this error message should show up with category set to ANOTHER_CATEGORY');

  const db = new sqlite.Database(dbFile);
  await new Promise((resolve, reject) => {
    try{
      log4js.shutdown((err) => {
        if(err){
          console.log('failed to shut down logs');
          reject(err);
        }
        else{
          resolve();
        }
      })
    }
    catch (e) {
      console.log('failed to shut down sqlite logs.', e);
      reject(e);
    }
  });

  const resultRows = await new Promise((resolve, reject) => {
    const sql = `SELECT * FROM ${logTable};`;
    const params = [];
    db.all(sql,params,(err, rows ) => {
      resolve(rows);
    });
  });

  assert.equal(resultRows.length, 2, 'Expected two log rows to have been written: an info and an error, with the trace entry having been filtered out.');
  const infoRow = resultRows.find(x => x.levelName == 'INFO');
  const errorRow = resultRows.find(x => x.levelName == 'ERROR');
  const now = (new Date()).getTime();

  assert.notEqual(infoRow, null, 'Expected a non-null info entry.');
  assert.equal(infoRow.data, 'first log entry', 'Unexpected info entry data.');
  assert.equal(infoRow.level, 20000, 'unexpected info level');
  assert.equal(infoRow.category, 'default', 'unexpected category for info entry.');
  assert.equal(infoRow.customColumn1, 'custom value 1', 'unexpected info customColumn1 value');
  assert.equal(infoRow.customColumn2, 222, 'unexpected info customColumn2 value');
  assert.ok((now-infoRow.time) < 30000, 'Expected time of info log entry to be less than 30 seconds ago');

  assert.notEqual(errorRow, null, 'Expected a non-null info entry');
  assert.equal(errorRow.data, 'this error message should show up with category set to ANOTHER_CATEGORY', 'Unexpected error entry data.');
  assert.equal(errorRow.level, 40000, 'unexpected error level');
  assert.equal(errorRow.category, 'ANOTHER_CATEGORY', 'unexpected category for error entry.');
  assert.equal(errorRow.customColumn1, 'custom value 1', 'unexpected error customColumn1 value');
  assert.equal(errorRow.customColumn2, 222, 'unexpected error customColumn2 value');
  assert.ok((now-errorRow.time) < 30000, 'Expected time of error log entry to be less than 30 seconds ago');

  db.close();
  done();
}

describe('log4js', function() {
  describe('log', function() {
    this.timeout(10000);
    it('should log to sqlite db', function (done) {
      test1(done);
    });
  });
});
