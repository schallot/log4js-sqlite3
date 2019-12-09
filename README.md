# log4js-sqlite3
[![NPM](https://nodei.co/npm/log4js-sqlite3.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/log4js/)

A node.js [log4js](https://www.npmjs.com/package/log4js) appender for writing to [sqlite3](https://www.npmjs.com/package/sqlite3) databases.



## Configuration
You can use it with a standard configuration as follows:

```
var log4js = require('log4js');
log4js.configure({
	appenders: {
	    database: {
	        type: "log4js-sqlite3",
	        file: "./log.sqlite",
	        // table name defaults to "log"
	        table: 'yourLogTableName',
	        // If this value is set, we'll delete old records as we go, keeping the record count below this level.
	        // If you leave this out of the config or set it to null, the database will grow without limit as you log.
	        maxRecordCount: 10000,
	        // If you want to have additional columns in your log table, you can define them here.
	        // For instance, if you want to mark log records with a run id.
	        additionalFields: [
	            {name: 'customColumn1', value: 'custom value 1', type: 'TEXT' },
	            {name: 'customColumn2', value: '222', type: 'INTEGER' },
	        ]
	    },
	},
	// Set up your log4js categories like you would with any other appender.
	categories: {
	    default: {
	        appenders: ['database'], level: 'trace'
	    },
	    ANOTHER_CATEGORY: {
	        appenders: ['database'], level: 'info'
	    }
	}
})

var logger = log4js.getLogger();
logger.debug("Added debug");
```

The default table name is _log_, although that can be overridden by passing the `table`
option as shown above. The appender will create the table for you.:

	CREATE TABLE "log" (
		"time" INTEGER  NOT NULL,
		"data" TEXT  NOT NULL,
		"level" INTEGER  NOT NULL,
		"levelName" TEXT  NOT NULL,
		"category" TEXT  NOT NULL
        // plus any additional fields you've defined.
	);
	CREATE INDEX "timeIndex" on "log"("time");

Note that time is stored as a integer, coming from `(new Date()).getTime()`, so you can convert back to a javascript date with `new Date(time)`.

By default, the database file will grow unbounded as you write log entries.  If you want to prevent the database from growing too large, you can define a maximum number of records to retain using the `maxRecordCount` setting.  If this is enabled, each time we write a log entry the appender will check delete old records as needed to keep the total record count below the defined count.  The module doesn't currently do any [vacuuming](https://www.sqlite.org/lang_vacuum.html).


## Acknowlegments
In writing this module, I stole as much as I could from [log4js-knex](https://github.com/morungos/log4js-knex).




## License
Released under the MIT License.
