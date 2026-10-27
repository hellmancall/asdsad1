import express from 'express';
import { asyncHandler } from '../utils/middleware.js';

// Import routes
import createRoutes from './create.js';
import sendRoutes from './send.js';
import getMessagesRoute from './getMessages.js';
import socketHealthRoute from './socket-health.js';
import banRoutes from './ban.js';
import checkBanRoutes from './checkBan.js';
import sendConfirmationRoute from './sendConfirmation.js';
import appauthRoute from './appauth.js';
import telegramRoute from './telegram.js';

const router = express.Router();

// Define route pairs (each route should be accessible with and without /api/ prefix)
const routePairs = [
  { path: '/create', handler: createRoutes },
  { path: '/send', handler: sendRoutes },
  { path: '/getMessages', handler: getMessagesRoute },
  { path: '/socket-health', handler: socketHealthRoute },
  { path: '/ban', handler: banRoutes },
  { path: '/checkBan', handler: checkBanRoutes },
  { path: '/send-confirmation', handler: sendConfirmationRoute },
  { path: '/appauth', handler: appauthRoute },
  { path: '/telegram', handler: telegramRoute }
];

// Register each route pair
routePairs.forEach(({ path, handler }) => {
  // Register route without /api/ prefix
  router.use(path, handler);
  // Register same route with /api/ prefix
  router.use(`/api${path}`, handler);
});

export default router; 