const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');

const router = Router();

// El health check queda fuera del versionado: lo consumen la sonda de
// Kubernetes y el compose, no los clientes de la API.
router.use('/health', healthRoutes);

router.use('/v1/auth', authRoutes);

module.exports = router;
