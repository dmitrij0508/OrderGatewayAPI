-- PostgreSQL Database Schema for Order Gateway API

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create main orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(50) UNIQUE NOT NULL,
    external_order_id VARCHAR(100) NOT NULL,
    restaurant_id VARCHAR(50) NOT NULL,
    idempotency_key UUID UNIQUE NOT NULL,

    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255),
    customer_address JSONB,

    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('pickup', 'delivery', 'dine-in')),
    order_time TIMESTAMP WITH TIME ZONE NOT NULL,
    requested_time TIMESTAMP WITH TIME ZONE,

    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) NOT NULL,
    tip DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,

    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'authorized', 'captured', 'failed')),
    payment_transaction_id VARCHAR(100),
    payment_amount DECIMAL(10,2) DEFAULT 0,

    status VARCHAR(20) DEFAULT 'received' CHECK (status IN ('received', 'preparing', 'ready', 'completed', 'cancelled')),
    estimated_time TIMESTAMP WITH TIME ZONE,
    cancellation_reason VARCHAR(50),
    notes TEXT,
    source VARCHAR(50) DEFAULT 'api',
    webhook_metadata JSONB,
    original_order_id VARCHAR(100),
    webhook_created_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    special_instructions TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order item modifiers table
CREATE TABLE order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_id VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create menus table for menu management
CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id)
);

-- Create categories table (optional taxonomy for menu items)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, name)
);

CREATE INDEX idx_categories_restaurant_id ON categories(restaurant_id);

-- Create menu items table
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_orders_order_id ON orders(order_id);
CREATE INDEX idx_orders_external_order_id ON orders(external_order_id);
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_idempotency_key ON orders(idempotency_key);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_item_modifiers_order_item_id ON order_item_modifiers(order_item_id);

CREATE INDEX idx_menus_restaurant_id ON menus(restaurant_id);
CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);

-- POS authoritative SKU / price table
CREATE TABLE pos_skus (
    sku VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255),
    price DECIMAL(10,2) NOT NULL,
    taxable BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_pos_skus_active ON pos_skus(active);
CREATE INDEX idx_pos_skus_price ON pos_skus(price);

-- Saved payloads for debugging / reuse
CREATE TABLE saved_payloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payload_key VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    source VARCHAR(50),
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_saved_payloads_created_at ON saved_payloads(created_at);
CREATE INDEX idx_saved_payloads_source ON saved_payloads(source);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to orders table
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample menu data for testing
INSERT INTO menus (restaurant_id, name, description) VALUES 
('NYC-DELI-001', 'Main Menu', 'New York Deli & Cafe Main Menu');

-- Seed default categories for NYC-DELI-001
INSERT INTO categories (restaurant_id, name, display_order) VALUES
('NYC-DELI-001', 'Sandwiches', 1),
('NYC-DELI-001', 'Salads', 2),
('NYC-DELI-001', 'Soups', 3),
('NYC-DELI-001', 'Bakery', 4),
('NYC-DELI-001', 'Drinks', 5);

INSERT INTO menu_items (menu_id, name, price, category, available) 
SELECT 
    (SELECT id FROM menus WHERE restaurant_id = 'NYC-DELI-001'),
    item_name,
    item_price,
    item_category,
    true
FROM (VALUES 
    ('Turkey Club Sandwich', 12.99, 'Sandwiches'),
    ('Pastrami on Rye', 14.50, 'Sandwiches'),
    ('Chicken Caesar Salad', 11.99, 'Salads'),
    ('Matzo Ball Soup', 8.99, 'Soups'),
    ('Bagel with Cream Cheese', 4.99, 'Bakery'),
    ('Coffee', 2.99, 'Drinks'),
    ('Iced Tea', 2.50, 'Drinks')
) AS items(item_name, item_price, item_category);

-- Create API usage tracking table (optional)
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_name VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX idx_api_usage_api_key ON api_usage(api_key_name);