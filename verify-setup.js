#!/usr/bin/env node
console.log('🔍 Order Gateway API Setup Verification');
console.log('=====================================');
console.log(`📦 Node.js Version: ${process.version}`);
try {
  require('express');
  console.log('✅ Express: OK');
} catch (e) {
  console.log('❌ Express: Missing');
}
try {
  require('sqlite3');
  console.log('✅ SQLite3: OK');
} catch (e) {
  console.log('❌ SQLite3: Missing');
}
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'pos_gateway.db');
if (fs.existsSync(dbPath)) {
  console.log('✅ Database: Created');
  console.log(`📁 Database location: ${dbPath}`);
} else {
  console.log('❌ Database: Not found');
  console.log(`📁 Expected location: ${dbPath}`);
}
console.log('\n🗄️ Testing database connection...');
const database = require('./src/config/database');
database.query('SELECT COUNT(*) as count FROM orders')
  .then(result => {
    console.log('✅ Database connection: OK');
    console.log(`📊 Orders table ready`);
  })
  .catch(error => {
    console.log('❌ Database connection: Failed');
    console.log(`Error: ${error.message}`);
  })
  .finally(() => {
    database.end();
  });
console.log('\n🚀 API Endpoints will be available at:');
console.log('   Health: http:
console.log('   API Info: http:
console.log('   Orders: http:
console.log('   Menu: http:
console.log('\n🔑 Available API Keys:');
console.log('   Mobile App: pos-mobile-app-key');
console.log('   Website: pos-website-key');
console.log('   Admin: pos-admin-key');
console.log('   Sync Agent: sync-agent-key');
console.log('\n📖 Next steps:');
console.log('   1. Run: node server.js');
console.log('   2. Test: curl http:
console.log('   3. View full docs in README.md');
