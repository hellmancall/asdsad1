import { getMemoryStore } from "../utils/memory-store.js";

export class UserHandler {
  constructor(logger) {
    this.logger = logger;
    this.userStore = getMemoryStore();
  }

  handleAddUser(socket, data) {
    try {

      const { userId } = data;

      // Get existing user or create new one
      const existingUser = this.userStore.get(userId);
      const user = existingUser || {
        id: userId,
        data: {},
        ip: socket.clientIP,
      };

      // Update user connection info
      user.socket = socket.id;
      user.connectedAt = new Date().toISOString();
      user.lastActivity = Date.now();

      // Save user
      this.userStore.set(userId, user);

      // Set socket info
      socket.userId = userId;
      socket.lastActivity = Date.now();
      socket.join(userId);

      this.logger.info(
        `User ${userId} connected. Total: ${this.userStore.size()}`
      );
      socket.emit("user-added", { userId, status: "connected" });
    } catch (error) {
      this.logger.error("Error adding user:", error.message);
      socket.emit("error", { message: "Failed to add user" });
    }
  }

  handleUpdateUser(socket, data) {
    try {

      const { userId, data: updateData } = data;

      // Check if socket owns this user
      if (socket.userId !== userId) {
        this.logger.warn(`Socket ${socket.id} tried to update different user`);
        return;
      }

      // Get user
      const user = this.userStore.get(userId);
      if (!user) {
        this.logger.warn(`Update for non-existent user: ${userId}`);
        return;
      }

      // Update user data
      user.data = { ...user.data, ...updateData };
      user.lastUpdated = new Date().toISOString();
      user.lastActivity = Date.now();
      user.socket = socket.id;

      // Save updated user
      this.userStore.set(userId, user);

      // Update socket activity
      socket.lastActivity = Date.now();

      this.logger.debug(`User ${userId} data updated`);
    } catch (error) {
      this.logger.error("Error updating user:", error.message);
    }
  }
}
