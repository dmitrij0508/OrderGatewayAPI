
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function run() {
	const schemaPath = path.join(__dirname, '..', 'database', 'schema-sqlite.sql');
	if (!fs.existsSync(schemaPath)) {
		console.error('Schema file not found:', schemaPath);
		process.exit(1);
	}

	const dbPath = path.join(__dirname, '..', 'database', 'pos_gateway.db');
	await new Promise((resolve, reject) => {
		const db = new sqlite3.Database(dbPath, (err) => {
			if (err) return reject(err);
			db.exec('PRAGMA foreign_keys = ON;', (err2) => {
				if (err2) return reject(err2);
				const sql = fs.readFileSync(schemaPath, 'utf8');
				db.exec(sql, (err3) => {
					if (err3) return reject(err3);
					db.close((err4) => (err4 ? reject(err4) : resolve()));
				});
			});
		});
	});

	console.log('SQLite migration completed:', dbPath);
}

run().catch((e) => {
	console.error('Migration failed:', e);
	process.exit(1);
});

