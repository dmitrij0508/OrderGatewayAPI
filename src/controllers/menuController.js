const menuService = require('../services/menuService');
const logger = require('../utils/logger');
class MenuController {
  async getMenu(req, res, next) {
    try {
      const { restaurantId } = req.query;
      logger.info(`Retrieving menu`, {
        client: req.apiKey.name,
        restaurantId: restaurantId || 'all'
      });
      const menu = await menuService.getMenu(restaurantId);
      res.json({
        success: true,
        data: menu,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new MenuController();
