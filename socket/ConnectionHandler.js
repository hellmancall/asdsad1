import { getMemoryStore } from "../utils/memory-store.js";

export class ConnectionHandler {
  constructor(logger) {
    this.logger = logger;
    this.userStore = getMemoryStore();
  }

  handleConnection(socket) {
    this.logger.info(`Client connected: ${socket.id}`);

    // Set socket metadata
    socket.lastActivity = Date.now();
    socket.connectionTime = Date.now();

    // Record connection in stats
    this.userStore.recordConnection();

    // Get client IP
    const clientIP =
      socket.handshake.address ||
      socket.conn.remoteAddress ||
      socket.handshake.headers["x-forwarded-for"];

    // Store client IP for use in other handlers
    socket.clientIP = clientIP;

    return { clientIP };
  }
}
