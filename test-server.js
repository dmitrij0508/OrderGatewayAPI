const express = require('express');
const app = express();
app.get('/test', (req, res) => {
  res.json({
    message: 'Order Gateway API is working!',
    timestamp: new Date().toISOString()
  });
});
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Test server running on http:
});
