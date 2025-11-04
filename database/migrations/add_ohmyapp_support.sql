-- Database Migration: Add OhMyApp.io Support Fields
-- Date: November 4, 2025
-- Purpose: Add columns to support OhMyApp.io webhook data structure

-- Add customer address support
ALTER TABLE orders ADD COLUMN customer_address TEXT;

-- Add payment amount field
ALTER TABLE orders ADD COLUMN payment_amount REAL DEFAULT 0;

-- Add webhook source tracking
ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'api';

-- Add webhook metadata storage
ALTER TABLE orders ADD COLUMN webhook_metadata TEXT;

-- Add original order ID tracking
ALTER TABLE orders ADD COLUMN original_order_id TEXT;

-- Add webhook creation timestamp
ALTER TABLE orders ADD COLUMN webhook_created_at TEXT;

-- Add category field to order_items for OhMyApp.io support
ALTER TABLE order_items ADD COLUMN category TEXT DEFAULT 'General';

-- Add modifier ID to order_item_modifiers for OhMyApp.io support
ALTER TABLE order_item_modifiers ADD COLUMN modifier_id TEXT;

-- Add modifier quantity for OhMyApp.io support
ALTER TABLE order_item_modifiers ADD COLUMN quantity INTEGER DEFAULT 1;

-- Create index for webhook source queries
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);

-- Create index for original order ID queries
CREATE INDEX IF NOT EXISTS idx_orders_original_order_id ON orders(original_order_id);

-- Create index for webhook source specific queries
CREATE INDEX IF NOT EXISTS idx_orders_source_created ON orders(source, created_at);

PRAGMA table_info(orders);