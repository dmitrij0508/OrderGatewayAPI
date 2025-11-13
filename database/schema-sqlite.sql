-- SQLite Database Schema for Order Gateway API

-- Create main orders table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT UNIQUE NOT NULL, -- ORD-YYYYMMDD-NNN format
    external_order_id TEXT NOT NULL, -- Mobile app internal ID
    restaurant_id TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    
    -- Customer information
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    
    -- Order details
    order_type TEXT NOT NULL CHECK (order_type IN ('pickup', 'delivery', 'dine-in')),
    order_time TEXT NOT NULL,
    requested_time TEXT,
    
    -- Pricing
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    tip REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    delivery_fee REAL DEFAULT 0,
    total REAL NOT NULL,
    
    -- Payment information
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'authorized', 'captured', 'failed')),
    payment_transaction_id TEXT,
    
    -- Order status and tracking
    status TEXT DEFAULT 'received' CHECK (status IN ('received', 'preparing', 'ready', 'completed', 'cancelled')),
    estimated_time TEXT,
    cancellation_reason TEXT,
    notes TEXT,
    
    -- Audit fields
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Create order items table
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL, -- POS system item ID
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    special_instructions TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Create order item modifiers table
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Create menus table for menu management
CREATE TABLE IF NOT EXISTS menus (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    last_updated TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Create menu items table
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    available INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Optional POS authoritative SKU/price table (for price-authoritative mode)
CREATE TABLE IF NOT EXISTS pos_skus (
    sku TEXT PRIMARY KEY,
    name TEXT,
    price REAL NOT NULL,
    taxable INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    last_updated TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pos_skus_active ON pos_skus(active);
CREATE INDEX IF NOT EXISTS idx_pos_skus_price ON pos_skus(price);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_order_item_id ON order_item_modifiers(order_item_id);

CREATE INDEX IF NOT EXISTS idx_menus_restaurant_id ON menus(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON menu_items(menu_id);

-- Insert sample menu data for testing
INSERT OR IGNORE INTO menus (restaurant_id, name, description) 
VALUES ('NYC-DELI-001', 'Main Menu', 'New York Deli & Cafe Main Menu');

INSERT OR IGNORE INTO menu_items (menu_id, name, price, available) 
SELECT 
    (SELECT id FROM menus WHERE restaurant_id = 'NYC-DELI-001'),
    'Turkey Club Sandwich',
    12.99,
    1
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'Turkey Club Sandwich');

INSERT OR IGNORE INTO menu_items (menu_id, name, price, available) 
SELECT 
    (SELECT id FROM menus WHERE restaurant_id = 'NYC-DELI-001'),
    'Pastrami on Rye',
    14.50,
    1
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'Pastrami on Rye');

INSERT OR IGNORE INTO menu_items (menu_id, name, price, available) 
SELECT 
    (SELECT id FROM menus WHERE restaurant_id = 'NYC-DELI-001'),
    'Chicken Caesar Salad',
    11.99,
    1
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'Chicken Caesar Salad');

INSERT OR IGNORE INTO menu_items (menu_id, name, price, available) 
SELECT 
    (SELECT id FROM menus WHERE restaurant_id = 'NYC-DELI-001'),
    'Coffee',
    2.99,
    1
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'Coffee');

-- Create API usage tracking table (optional)
CREATE TABLE IF NOT EXISTS api_usage (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    api_key_name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_key ON api_usage(api_key_name);

-- Saved payloads for debugging/POSTMAN reuse
CREATE TABLE IF NOT EXISTS saved_payloads (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    -- A human-friendly key to identify the payload (unique)
    payload_key TEXT UNIQUE NOT NULL,
    description TEXT,
    source TEXT,
    -- Raw JSON payload stored as text
    payload TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_saved_payloads_created_at ON saved_payloads(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_payloads_source ON saved_payloads(source);