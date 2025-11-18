-- PostgreSQL migration to add categories table and seed rows for NYC-DELI-001
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON categories(restaurant_id);

-- Seed common categories if none exist for this restaurant
INSERT INTO categories (restaurant_id, name, display_order)
SELECT * FROM (
  VALUES
    ('NYC-DELI-001', 'Sandwiches', 1),
    ('NYC-DELI-001', 'Salads', 2),
    ('NYC-DELI-001', 'Soups', 3),
    ('NYC-DELI-001', 'Bakery', 4),
    ('NYC-DELI-001', 'Drinks', 5)
) v(restaurant_id, name, display_order)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE restaurant_id = 'NYC-DELI-001');
