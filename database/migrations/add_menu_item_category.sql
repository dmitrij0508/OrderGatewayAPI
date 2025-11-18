-- Add category column to menu_items and backfill for existing rows
-- PostgreSQL migration
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Backfill some common categories based on item name patterns
UPDATE menu_items SET category = 'Sandwiches' WHERE category IS NULL AND name ILIKE '%Sandwich%' OR name ILIKE '%Rye%';
UPDATE menu_items SET category = 'Salads' WHERE category IS NULL AND name ILIKE '%Salad%';
UPDATE menu_items SET category = 'Soups' WHERE category IS NULL AND name ILIKE '%Soup%';
UPDATE menu_items SET category = 'Bakery' WHERE category IS NULL AND name ILIKE '%Bagel%' OR name ILIKE '%Croissant%';
UPDATE menu_items SET category = 'Drinks' WHERE category IS NULL AND name ILIKE '%Coffee%' OR name ILIKE '%Tea%' OR name ILIKE '%Soda%' OR name ILIKE '%Juice%';

-- Fallback any remaining nulls to 'Other'
UPDATE menu_items SET category = 'Other' WHERE category IS NULL;