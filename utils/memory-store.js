// Simple in-memory storage optimized for serverless environments
// This provides reliable storage for user sessions without external dependencies

class MemoryStore {
  constructor(options = {}) {
    this.users = new Map();
    this.socketToUser = new Map(); // For fast socket-to-user lookups
    this.stats = {
      created: Date.now(),
      totalConnections: 0,
      totalDisconnections: 0,
      cleanupRuns: 0,
      maxUsersReached: 0,
    };

    // Configuration with defaults
    this.config = {
      cleanupInterval: options.cleanupInterval || 300000, // 5 minutes
      userTimeout: options.userTimeout || 600000, // 10 minutes
      maxUsers: options.maxUsers || 1000, // Maximum users to prevent memory exhaustion
      forceCleanupThreshold: options.forceCleanupThreshold || 0.9, // Clean when 90% full
    };

    // Cleanup interval reference
    this.cleanupInterval = null;
    this.processListeners = [];

    this.startCleanupTimer();
    this.setupProcessHandlers();
  }

  startCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
      this.checkMemoryPressure();
    }, this.config.cleanupInterval);
  }

  setupProcessHandlers() {
    if (typeof process !== "undefined") {
      const exitHandler = () => this.gracefulShutdown();
      const signalHandler = () => this.gracefulShutdown();

      process.on("exit", exitHandler);
      process.on("SIGINT", signalHandler);
      process.on("SIGTERM", signalHandler);

      // Keep references for cleanup
      this.processListeners = [
        { event: "exit", handler: exitHandler },
        { event: "SIGINT", handler: signalHandler },
        { event: "SIGTERM", handler: signalHandler },
      ];
    }
  }

  // Check if we're approaching memory limits
  checkMemoryPressure() {
    const currentUsers = this.users.size;
    const threshold = this.config.maxUsers * this.config.forceCleanupThreshold;

    if (currentUsers > threshold) {
      console.warn(
        `Memory pressure detected: ${currentUsers}/${this.config.maxUsers} users. Running aggressive cleanup.`
      );
      this.aggressiveCleanup();
      this.stats.maxUsersReached++;
    }
  }

  // More aggressive cleanup when approaching limits
  aggressiveCleanup() {
    const now = Date.now();
    const aggressiveTimeout = this.config.userTimeout * 0.5; // 5 minutes instead of 10
    let cleanedCount = 0;

    for (const [userId, userData] of this.users.entries()) {
      if (now - userData.lastSeen > aggressiveTimeout) {
        this.forceRemoveUser(userId, userData);
        cleanedCount++;
      }
    }

    console.log(`Aggressive cleanup removed ${cleanedCount} users`);
    return cleanedCount;
  }

  // Safely remove user and cleanup all references
  forceRemoveUser(userId, userData) {
    // Remove from socket mapping
    if (userData && userData.socket) {
      this.socketToUser.delete(userData.socket);
    }

    // Remove from main storage
    this.users.delete(userId);
    this.stats.totalDisconnections++;
  }

  set(userId, data) {
    try {
      if (!userId) {
        return false;
      }

      // Check if we're at capacity and this is a new user
      if (!this.users.has(userId) && this.users.size >= this.config.maxUsers) {
        console.warn(
          `Memory store at capacity (${this.config.maxUsers}). Rejecting new user: ${userId}`
        );
        return false;
      }

      const userData = {
        ...data,
        lastSeen: Date.now(),
        updatedAt: new Date().toISOString(),
      };

      // Clean up old socket mapping if user had different socket
      const existingUser = this.users.get(userId);
      if (
        existingUser &&
        existingUser.socket &&
        existingUser.socket !== data.socket
      ) {
        this.socketToUser.delete(existingUser.socket);
      }

      // Update main storage
      this.users.set(userId, userData);

      // Update socket-to-user mapping for fast lookups
      if (data.socket) {
        this.socketToUser.set(data.socket, userId);
      }

      return true;
    } catch (error) {
      console.error("MemoryStore SET error:", error.message);
      return false;
    }
  }

  get(userId) {
    try {
      if (!userId) {
        return null;
      }

      const userData = this.users.get(userId);
      if (userData) {
        // Update last seen on access (but don't update the map unnecessarily)
        if (Date.now() - userData.lastSeen > 60000) {
          // Only update if >1 minute since last update
          userData.lastSeen = Date.now();
          this.users.set(userId, userData);
        }
      }

      return userData || null;
    } catch (error) {
      console.error("MemoryStore GET error:", error.message);
      return null;
    }
  }

  delete(userId) {
    try {
      if (!userId) {
        return false;
      }

      const userData = this.users.get(userId);

      if (userData) {
        this.forceRemoveUser(userId, userData);
        return true;
      }

      return false;
    } catch (error) {
      console.error("MemoryStore DELETE error:", error.message);
      return false;
    }
  }

  findBySocket(socketId) {
    try {
      if (!socketId) {
        return null;
      }

      // Fast lookup using socket mapping
      const userId = this.socketToUser.get(socketId);
      if (userId) {
        const userData = this.users.get(userId);
        if (userData) {
          return { userId, ...userData };
        } else {
          // Clean up orphaned socket mapping
          this.socketToUser.delete(socketId);
        }
      }

      return null;
    } catch (error) {
      console.error("MemoryStore FIND error:", error.message);
      return null;
    }
  }

  cleanup() {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      // Clean up expired users
      for (const [userId, userData] of this.users.entries()) {
        if (now - userData.lastSeen > this.config.userTimeout) {
          this.forceRemoveUser(userId, userData);
          cleanedCount++;
        }
      }

      // Clean up orphaned socket mappings
      let orphanedSockets = 0;
      for (const [socketId, userId] of this.socketToUser.entries()) {
        if (!this.users.has(userId)) {
          this.socketToUser.delete(socketId);
          orphanedSockets++;
        }
      }

      this.stats.cleanupRuns++;

      if (cleanedCount > 0 || orphanedSockets > 0) {
        console.log(
          `Cleanup: removed ${cleanedCount} expired users, ${orphanedSockets} orphaned sockets`
        );
      }

      return { cleanedUsers: cleanedCount, orphanedSockets };
    } catch (error) {
      console.error("MemoryStore CLEANUP error:", error.message);
      return { cleanedUsers: 0, orphanedSockets: 0 };
    }
  }

  size() {
    return this.users.size;
  }

  getStats() {
    return {
      ...this.stats,
      currentUsers: this.users.size,
      socketMappings: this.socketToUser.size,
      uptime: Date.now() - this.stats.created,
      maxUsers: this.config.maxUsers,
      utilizationPercent: Math.round(
        (this.users.size / this.config.maxUsers) * 100
      ),
    };
  }

  health() {
    try {
      const stats = this.getStats();
      const memoryUsage =
        typeof process !== "undefined" ? process.memoryUsage() : null;

      return {
        status: stats.utilizationPercent > 95 ? "warning" : "healthy",
        type: "in-memory",
        users: stats.currentUsers,
        socketMappings: stats.socketMappings,
        uptime: stats.uptime,
        totalConnections: stats.totalConnections,
        totalDisconnections: stats.totalDisconnections,
        cleanupRuns: stats.cleanupRuns,
        maxUsersReached: stats.maxUsersReached,
        utilizationPercent: stats.utilizationPercent,
        memory: memoryUsage
          ? {
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
              heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
              rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
            }
          : null,
      };
    } catch (error) {
      return {
        status: "error",
        error: error.message,
        type: "in-memory",
      };
    }
  }

  // Update stats when user connects
  recordConnection() {
    this.stats.totalConnections++;
  }

  // Clear all data (mainly for testing)
  clear() {
    this.users.clear();
    this.socketToUser.clear();
    this.stats.totalConnections = 0;
    this.stats.totalDisconnections = 0;
    this.stats.maxUsersReached = 0;
  }

  // Improved graceful shutdown
  gracefulShutdown() {
    console.log("MemoryStore: Starting graceful shutdown...");

    // Stop cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Remove process listeners
    if (typeof process !== "undefined" && this.processListeners.length > 0) {
      this.processListeners.forEach(({ event, handler }) => {
        process.removeListener(event, handler);
      });
      this.processListeners = [];
    }

    // Final cleanup
    const cleanupResult = this.cleanup();
    console.log(
      `MemoryStore: Shutdown complete. Final cleanup: ${JSON.stringify(
        cleanupResult
      )}`
    );

    // Clear all data
    this.clear();
  }

  // Legacy method name for backward compatibility
  disconnect() {
    this.gracefulShutdown();
  }

  // Get all users (for debugging - use carefully)
  getAllUsers() {
    const users = [];
    for (const [userId, userData] of this.users.entries()) {
      users.push({ userId, ...userData });
    }
    return users;
  }

  // Validate data integrity
  validateIntegrity() {
    const issues = [];

    // Check for users without socket mappings
    for (const [userId, userData] of this.users.entries()) {
      if (userData.socket && !this.socketToUser.has(userData.socket)) {
        issues.push(
          `User ${userId} has socket ${userData.socket} but no socket mapping`
        );
      }
    }

    // Check for socket mappings without users
    for (const [socketId, userId] of this.socketToUser.entries()) {
      if (!this.users.has(userId)) {
        issues.push(
          `Socket mapping ${socketId} -> ${userId} but user doesn't exist`
        );
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}

// Singleton instance
let storeInstance = null;

// Singleton accessor function
export const getMemoryStore = () => {
  if (!storeInstance) {
    storeInstance = new MemoryStore();
  }
  return storeInstance;
};

export default MemoryStore;
