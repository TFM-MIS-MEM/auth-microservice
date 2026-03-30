const { Router } = require('express');
const healthRoutes = require('./health.routes');

const router = Router();

// --- Health Check ---
router.use('/health', healthRoutes);

// --- Service-specific routes (add here when implementing business logic) ---
// router.use('/api/v1/resource', resourceRoutes);

module.exports = router;
