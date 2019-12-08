const describe = require('mocha').describe;
const it = require('mocha').it;
const log4js = require('log4js');
const assert = require('assert');
const sqlite = require('sqlite3').verbose();
const fs = require('fs');

describe('log4js', function() {
  describe('log', function() {
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

      await new Promise(((resolve, reject) => {
        setTimeout(resolve, 3000);
      }));

      defaultLog.info('first log entry');
      defaultLog.trace('this log entry is too low of a level to reach the database');
      anotherLog.error('this error message should show up with category set to ANOTHER_CATEGORY');

      const db = new sqlite.Database(dbFile);
      await new Promise((resolve, reject) => {
        try{
          log4js.shutdown((err) => {
            if(err){
              reject(err);
            }
            else{
              resolve();
            }
          })
        }
        catch (e) {
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

      assert.equal(resultRows.length, 3, 'Unexpected number of log rows were written.');

      db.close();
      done();
    });
  });
});
