const describe = require('mocha').describe;
const it = require('mocha').it;
const log4js = require('log4js');
const assert = require('assert');
const testSetup = require('./testSetup');

describe('log4js-sqlite3', function() {

  describe('log-level-filter', function() {
    this.timeout(60000);
    it('should log to sqlite db with level filtering', function (done) {

      const func = async function() {
        await testSetup.setUp();

        const defaultLog = log4js.getLogger();
        const anotherLog = log4js.getLogger('ANOTHER_CATEGORY');

        defaultLog.info('first log entry');
        defaultLog.trace('this log entry is too low of a level to reach the database');
        anotherLog.error('this error message should show up with category set to ANOTHER_CATEGORY')

        const resultRows = await testSetup.getLogs();

        assert.equal(resultRows.length, 2, `Found ${resultRows.length} records. Expected two log rows to have been written: an info and an error, with the trace entry having been filtered out.`);
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
        done();
      }
      func();
    });

    it('should be able to log a few thousand entries in 15 seconds', function (done) {
      const func = async function() {
        await testSetup.setUp();

        const defaultLog = log4js.getLogger();
        const recordCount = 2000;

        for(let i=0; i< recordCount; i++){
          defaultLog.info(testSetup.randomishString());
        }
        await testSetup.wait(15000);
        const resultRows = await testSetup.getLogs();
        assert.equal(resultRows.length, recordCount, `Found ${resultRows.length} records. Expected ${recordCount}`);
        done();
      }
      func();
    });

    it('should keep record count below maxRecordCount', function (done) {
      const func = async function() {
        const config = testSetup.getDefaultConfig();
        const maxRecordCount = 25;
        config.appenders.database.maxRecordCount = maxRecordCount;
        await testSetup.setUp(config);

        const defaultLog = log4js.getLogger();
        const recordCount = 100;

        for(let i=0; i< recordCount; i++){
          defaultLog.info(testSetup.randomishString());
        }
        await testSetup.wait(5000);
        const resultRows = await testSetup.getLogs();
        assert.equal(resultRows.length, maxRecordCount, `Found ${resultRows.length} records. Expected ${maxRecordCount}`);
        done();
      }
      func();
    });

  });
});
