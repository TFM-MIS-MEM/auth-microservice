const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');

const router = Router();

// --- Health Check ---
router.use('/health', healthRoutes);

// --- Auth (Semantic Versioning: /api/v1/auth) ---
router.use('/api/v1/auth', authRoutes);

module.exports = router;
