const mongoose = require('mongoose');
const config = require('../config');
const { getVersion } = require('../utils/versionUtils');

/**
 * Health Check Controller.
 * Returns service status, uptime, timestamp, DB status, version and environment.
 */
const getHealth = (_req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.status(200).json({
    status: 'ok',
    message: 'Health check successful',
    version: getVersion(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    db: dbStatus,
  });
};

module.exports = { getHealth };
