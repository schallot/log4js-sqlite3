const describe = require('mocha').describe;
const it = require('mocha').it;
const log4js = require('log4js');
const assert = require('assert');
const sqlite = require('sqlite3').verbose();
const fs = require('fs');

describe('log4js', function() {
  describe('log', function() {
    this.timeout(10000);
    it('should log to sqlite db', async function(done) {
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

      await new Promise((resolve, reject) => {
        console.log('Waiting three seconds.')
        setTimeout(resolve, 1000);
        console.log('finished waiting three seconds');
      });

      console.log('Writing first log entry....');
      defaultLog.info('first log entry');
      console.log('Writing second log entry....');
      defaultLog.trace('this log entry is too low of a level to reach the database');
      console.log('Writing third log entry....');
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
              console.log('Finished shutting down logs.');
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
        const sql = ``;
        const params = [];
        db.all(sql,params,(err, rows ) => {
          resolve(rows);
        });
      });

      assert.equal(resultRows.length, 3, 'Expected two log rows to have been written: an info and an error, with the trace entry having been filtered out.');

      db.close();
      done();
    });
  });
});
