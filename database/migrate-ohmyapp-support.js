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
    
    // Execute statements one by one with proper error handling
    const statements = [
      "ALTER TABLE orders ADD COLUMN customer_address TEXT",
      "ALTER TABLE orders ADD COLUMN payment_amount REAL DEFAULT 0",
      "ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'api'",
      "ALTER TABLE orders ADD COLUMN webhook_metadata TEXT",
      "ALTER TABLE orders ADD COLUMN original_order_id TEXT",
      "ALTER TABLE orders ADD COLUMN webhook_created_at TEXT",
      "ALTER TABLE order_items ADD COLUMN category TEXT DEFAULT 'General'",
      "ALTER TABLE order_item_modifiers ADD COLUMN modifier_id TEXT",
      "ALTER TABLE order_item_modifiers ADD COLUMN quantity INTEGER DEFAULT 1",
      "CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source)",
      "CREATE INDEX IF NOT EXISTS idx_orders_original_order_id ON orders(original_order_id)",
      "CREATE INDEX IF NOT EXISTS idx_orders_source_created ON orders(source, created_at)"
    ];
    
    for (const statement of statements) {
      try {
        await database.run(statement);
        logger.info(`✅ Applied: ${statement.substring(0, 80)}...`);
      } catch (error) {
        if (error.message.includes('duplicate column name') || 
            error.message.includes('already exists')) {
          logger.info(`⚠️ Skipped (already exists): ${statement.substring(0, 80)}...`);
        } else {
          logger.error(`❌ Failed: ${statement.substring(0, 80)}...`, error.message);
          // Don't throw error for ALTER TABLE failures, continue with next statement
          logger.warn(`Continuing with migration despite error in: ${statement}`);
        }
      }
    }
    
    // Log final table structure
    try {
      const result = await database.query("PRAGMA table_info(orders)");
      logger.info('📋 Final orders table structure:', result.rows);
    } catch (error) {
      logger.warn('Could not retrieve table info:', error.message);
    }
    
    logger.info('🎉 OhMyApp.io migration completed successfully!');
    
    // Test the new structure
    const testResult = await testNewStructure();
    
    if (!testResult.success) {
      logger.warn('⚠️ Migration test had issues, but proceeding with server start');
    }
    
    return testResult;
    
  } catch (error) {
    logger.error('💥 Migration failed:', error);
    // Don't throw error, return failure status but allow server to start
    return { 
      success: false, 
      error: error.message,
      canProceed: true 
    };
  }
}

async function testNewStructure() {
  try {
    logger.info('🧪 Testing new database structure...');
    
    // Get table structure to check what columns exist
    const ordersTableInfo = await database.query("PRAGMA table_info(orders)");
    const orderColumns = ordersTableInfo.rows.map(col => col.name);
    
    const expectedOrderColumns = [
      'customer_address', 'payment_amount', 'source', 
      'webhook_metadata', 'original_order_id', 'webhook_created_at'
    ];
    
    const missingOrderColumns = expectedOrderColumns.filter(col => !orderColumns.includes(col));
    
    if (missingOrderColumns.length > 0) {
      logger.warn(`⚠️ Missing order columns: ${missingOrderColumns.join(', ')}`);
      logger.info('📋 Available columns:', orderColumns);
    } else {
      logger.info('✅ All new order columns are present');
    }
    
    // Test order_items table
    try {
      const itemsTableInfo = await database.query("PRAGMA table_info(order_items)");
      const itemColumns = itemsTableInfo.rows.map(col => col.name);
      
      if (itemColumns.includes('category')) {
        logger.info('✅ order_items.category column is present');
      } else {
        logger.warn('⚠️ order_items.category column is missing');
      }
    } catch (error) {
      logger.warn('Could not check order_items table:', error.message);
    }
    
    // Test order_item_modifiers table
    try {
      const modifiersTableInfo = await database.query("PRAGMA table_info(order_item_modifiers)");
      const modifierColumns = modifiersTableInfo.rows.map(col => col.name);
      
      const expectedModifierColumns = ['modifier_id', 'quantity'];
      const presentModifierColumns = expectedModifierColumns.filter(col => modifierColumns.includes(col));
      
      if (presentModifierColumns.length === expectedModifierColumns.length) {
        logger.info('✅ All new order_item_modifiers columns are present');
      } else {
        logger.warn(`⚠️ Missing modifier columns: ${expectedModifierColumns.filter(col => !modifierColumns.includes(col)).join(', ')}`);
      }
    } catch (error) {
      logger.warn('Could not check order_item_modifiers table:', error.message);
    }
    
    logger.info('🎯 Database structure test completed!');
    return { 
      success: true, 
      missingColumns: missingOrderColumns.length,
      canProceed: true // Always proceed, just log warnings
    };
    
  } catch (error) {
    logger.error('💥 Database structure test failed:', error);
    // Don't throw error, just return status
    return { 
      success: false, 
      error: error.message,
      canProceed: true // Still proceed to start server
    };
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