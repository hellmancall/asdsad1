export class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
  }

  handleSocketError(socket, error) {
    this.logger.error(`Socket error for ${socket.id}:`, error.message);
  }

  handleConnectionError(socket, error) {
    this.logger.error(`Connection error for ${socket.id}:`, error.message);
  }

  handleServerError(io, error) {
    this.logger.error("Socket.IO server connection error:", error.message);
  }

  handleNotify(socket, message) {
    this.logger.debug("Notification received:", message);
  }
} 