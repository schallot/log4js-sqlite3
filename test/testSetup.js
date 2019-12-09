const fs = require('fs');
const log4js = require('log4js');
const sqlite = require('sqlite3').verbose();

const testSetup = {
    dbFile: './test/test.sqlite',
    logTable: 'logTest',
    wait: async function(waitMilliseconds){
        return await new Promise((resolve) => {
            setTimeout(resolve, waitMilliseconds);
        })
    },
    getDefaultConfig: function(){
      return {
          appenders: {
              database: {
                  type: "lib/log4js-sqlite3",
                  file: this.dbFile,
                  table: this.logTable,
                  useNullAsDefault: true,
                  // If this value is set, we'll delete old records as we go, keeping the record count below this level.
                  maxRecordCount: 10000,
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
      };
    },
    getLogs : async function(){
        const db = new sqlite.Database(this.dbFile);
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
            const sql = `SELECT * FROM ${this.logTable};`;
            const params = [];
            db.all(sql,params,(err, rows ) => {
                resolve(rows);
            });
        });
        db.close();
        return resultRows;
    },
    setUp: async function(config){
        if(fs.existsSync(this.dbFile)){
            fs.unlinkSync(this.dbFile);
        }
        if(config == null){
            config = this.getDefaultConfig();
        }
        log4js.configure(config);
    },
    randomishString : function(){
        let count = 10;
        let arr = [];
        while(count > 0){
            arr.push(Math.random().toString(36));
            count--;
        }
        return arr.join();
    }
}

module.exports = testSetup;