const describe = require('mocha').describe;
const it = require('mocha').it;
const log4js = require('log4js');
const assert = require('assert');

describe('log4js', function() {
  describe('log', function() {
    it('should log to sqlite db', function() {

      log4js.configure({
        appenders: {
          database: {
            type: "lib/log4js-sqlite3",
            filename: './test.sqlite',
            table: "log",
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

      assert.fail('test not yet completely implemented');
    });
  });
});
