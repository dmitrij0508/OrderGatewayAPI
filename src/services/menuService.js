const database = require('../config/database');
const logger = require('../utils/logger');
class MenuService {
  async getMenu(restaurantId = null) {
    try {
      let menuQuery = 'SELECT * FROM menus';
      let params = [];
      if (restaurantId) {
        menuQuery += ' WHERE restaurant_id = ?';
        params.push(restaurantId);
      }
      menuQuery += ' ORDER BY restaurant_id, name';
      const menuResult = await database.query(menuQuery, params);
      if (!menuResult.rows || menuResult.rows.length === 0) {
        return restaurantId ? null : [];
      }
      const menus = await Promise.all(menuResult.rows.map(async (menu) => {
        const itemsResult = await database.query(
          'SELECT * FROM menu_items WHERE menu_id = ? AND available = 1 ORDER BY name',
          [menu.id]
        );
        return {
          id: menu.id,
          restaurantId: menu.restaurant_id,
          name: menu.name,
          description: menu.description,
          version: menu.version,
          lastUpdated: menu.last_updated,
          items: itemsResult.rows.map(item => ({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            available: Boolean(item.available)
          }))
        };
      }));
      if (restaurantId && menus.length > 0) {
        return menus[0];
      }
      return menus;
    } catch (error) {
      logger.error('Failed to get menu:', error);
      throw error;
    }
  }
  async updateMenu(restaurantId, menuData) {
    try {
      const existingMenu = await database.query(
        'SELECT * FROM menus WHERE restaurant_id = ?',
        [restaurantId]
      );
      let menuId;
      if (existingMenu.rows.length === 0) {
        const result = await database.run(`
          INSERT INTO menus (restaurant_id, name, description, version, last_updated, created_at)
          VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [restaurantId, menuData.name, menuData.description]);
        menuId = result.lastID;
      } else {
        menuId = existingMenu.rows[0].id;
        await database.run(`
          UPDATE menus
          SET name = ?, description = ?, version = version + 1, last_updated = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [menuData.name, menuData.description, menuId]);
      }
      await database.run('DELETE FROM menu_items WHERE menu_id = ?', [menuId]);
      if (menuData.items && menuData.items.length > 0) {
        for (const item of menuData.items) {
          await database.run(`
            INSERT INTO menu_items (menu_id, name, price, available, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [menuId, item.name, item.price, item.available !== false ? 1 : 0]);
        }
      }
      logger.info(`Menu updated for restaurant ${restaurantId}`);
      return await this.getMenu(restaurantId);
    } catch (error) {
      logger.error(`Failed to update menu for restaurant ${restaurantId}:`, error);
      throw error;
    }
  }
}
module.exports = new MenuService();
