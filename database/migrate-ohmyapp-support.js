const fs = require('fs');
const path = require('path');
const database = require('../src/config/database');
const logger = require('../src/utils/logger');

async function applyOhMyAppMigration() {
  try {
    logger.info('🔄 Applying OhMyApp.io support migration...');
    
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'add_ohmyapp_support.sql'), 
      'utf8'
    );
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        if (statement.includes('ALTER TABLE') || statement.includes('CREATE INDEX')) {
          // These might fail if columns/indexes already exist, which is OK
          await database.run(statement);
          logger.info(`✅ Applied: ${statement.substring(0, 50)}...`);
        } else {
          const result = await database.query(statement);
          logger.info(`✅ Executed: ${statement.substring(0, 50)}...`);
          if (statement.includes('PRAGMA table_info')) {
            logger.info('📋 Table structure:', result.rows);
          }
        }
      } catch (error) {
        if (error.message.includes('duplicate column name') || 
            error.message.includes('already exists')) {
          logger.info(`⚠️ Skipped (already exists): ${statement.substring(0, 50)}...`);
        } else {
          logger.error(`❌ Failed: ${statement.substring(0, 50)}...`, error.message);
          throw error;
        }
      }
    }
    
    logger.info('🎉 OhMyApp.io migration completed successfully!');
    
    // Test the new structure by checking if we can insert a test record
    await testNewStructure();
    
  } catch (error) {
    logger.error('💥 Migration failed:', error);
    throw error;
  }
}

async function testNewStructure() {
  try {
    logger.info('🧪 Testing new database structure...');
    
    // Test if new columns exist by doing a simple query
    const testQuery = `
      SELECT 
        customer_address, 
        payment_amount, 
        source, 
        webhook_metadata, 
        original_order_id, 
        webhook_created_at 
      FROM orders 
      LIMIT 1
    `;
    
    await database.query(testQuery);
    logger.info('✅ New order columns are accessible');
    
    // Test order_items new columns
    const testItemsQuery = `
      SELECT category FROM order_items LIMIT 1
    `;
    
    await database.query(testItemsQuery);
    logger.info('✅ New order_items columns are accessible');
    
    // Test order_item_modifiers new columns
    const testModifiersQuery = `
      SELECT modifier_id, quantity FROM order_item_modifiers LIMIT 1
    `;
    
    await database.query(testModifiersQuery);
    logger.info('✅ New order_item_modifiers columns are accessible');
    
    logger.info('🎯 Database structure test completed successfully!');
    
  } catch (error) {
    logger.error('💥 Database structure test failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  applyOhMyAppMigration()
    .then(() => {
      logger.info('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { applyOhMyAppMigration, testNewStructure };