-- Optional performance indexes for PostgreSQL (safe on SQLite: statements will be ignored if syntax unsupported).
-- Orders: speed status queries per restaurant
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status);
-- Order items: quick lookup for assembling orders
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
-- Menu items: retrieving by menu
CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON menu_items(menu_id);
-- POS SKUs: lookup by sku
CREATE INDEX IF NOT EXISTS idx_pos_skus_sku ON pos_skus(sku);
