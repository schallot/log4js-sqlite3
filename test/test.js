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
            type: "log4js-sqlite",
            table: "log",
            knex: {
              connection: {
                filename: './test/test.sqlite'
              },
              useNullAsDefault: true
            },
            additionalFields: {
              customColumn1: 'custom value 1',
              customColumn2: 'custom value 2'
            }
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
