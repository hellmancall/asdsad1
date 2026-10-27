import { ConnectionHandler } from "./ConnectionHandler.js";
import { UserHandler } from "./UserHandler.js";
import { DisconnectHandler } from "./DisconnectHandler.js";
import { ErrorHandler } from "./ErrorHandler.js";

// Simple logger
const logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message, ...args) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
};

export function initializeSocketHandlers(io) {
  // Initialize handler classes
  const connectionHandler = new ConnectionHandler(logger);
  const userHandler = new UserHandler(logger);
  const disconnectHandler = new DisconnectHandler(logger);
  const errorHandler = new ErrorHandler(logger);

  io.on("connection", (socket) => {
    // Handle initial connection
    connectionHandler.handleConnection(socket);

    // Set up event listeners
    socket.on("add-user", (userData) => {
      userHandler.handleAddUser(socket, userData);
    });

    socket.on("update-user", (userData) => {
      userHandler.handleUpdateUser(socket, userData);
    });

    socket.on("disconnect", (reason) => {
      disconnectHandler.handleDisconnect(socket, reason);
    });

    socket.on("error", (error) => {
      errorHandler.handleSocketError(socket, error);
    });

    socket.on("notify", (message) => {
      errorHandler.handleNotify(socket, message);
    });
  });

  // Return handlers for potential cleanup or monitoring
  return {
    connectionHandler,
    userHandler,
    disconnectHandler,
    errorHandler,
  };
}
