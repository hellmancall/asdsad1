import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";

// Import routes
import routes from "./routes/index.js";
import { initializeSocketHandlers } from "./socket/socketHandlers.js";

// Import middleware
import {
  errorHandlingMiddleware,
  requestLoggingMiddleware,
} from "./utils/middleware.js";

// Load environment variables
dotenv.config();
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

// CORS middleware
app.use(
  cors({
    origin: "*",
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging (only in development)
if (process.env.NODE_ENV !== "production") {
  app.use(requestLoggingMiddleware);
}

// Mount all routes
app.use(routes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Initialize Socket handlers
initializeSocketHandlers(io);

// Make io available to routes
app.locals.io = io;

// Error handling middleware (must be last)
app.use(errorHandlingMiddleware);

const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server initialized`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Started at: ${new Date().toISOString()}`);
});
