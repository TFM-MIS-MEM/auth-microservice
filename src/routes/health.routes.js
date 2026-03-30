const { Router } = require('express');
const { getHealth } = require('../controllers/health.controller');

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check endpoint
 *     description: Returns basic information to verify that the API is running properly.
 *     responses:
 *       200:
 *         description: API is healthy and responding.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Health check successful
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 uptime:
 *                   type: number
 *                   example: 123.45
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-03-13T12:00:00.000Z"
 *                 environment:
 *                   type: string
 *                   example: development
 *                 db:
 *                   type: string
 *                   example: connected
 */
router.get('/', getHealth);

module.exports = router;
