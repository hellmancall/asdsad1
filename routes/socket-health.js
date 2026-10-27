import express from "express";
import { getMemoryStore } from "../utils/memory-store.js";
import { getTelegramQueue } from "../utils/telegramQueue.js";

const router = express.Router();

// Helper function to get health data
const getHealthData = () => {
  const userStore = getMemoryStore();
  const telegramQueue = getTelegramQueue();
  const activeUsers = userStore.getAllUsers();
  const userCount = userStore.size();
  const queueStatus = telegramQueue.getStatus();

  return {
    timestamp: new Date().toISOString(),
    activeUsers: {
      count: userCount,
      users: activeUsers.map((user) => ({
        userId: user.userId,
        socketId: user.socket,
        connectedAt: user.connectedAt,
        lastActivity: user.lastActivity
          ? new Date(user.lastActivity).toISOString()
          : null,
        lastUpdated: user.lastUpdated,
        ip: user.ip,
        data: user.data || {},
      })),
    },
    telegram: {
      configured: !!(process.env.BOT && process.env.CHAT_ID),
      queueSize: queueStatus.queueSize,
      processing: queueStatus.processing,
      lastSentTime: queueStatus.lastSentTime
        ? new Date(queueStatus.lastSentTime).toISOString()
        : null,
    },
  };
};

// Regular HTTP endpoint (existing)
router.get("/", async (req, res) => {
  try {
    const response = getHealthData();
    res.status(200).json(response);
  } catch (error) {
    console.error("Error in socket health check:", error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Server-Sent Events endpoint for real-time updates
router.get("/stream", (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  // Send initial data
  try {
    const healthData = getHealthData();
    res.write(`data: ${JSON.stringify(healthData)}\n\n`);
  } catch (error) {
    console.error("Error sending initial health data:", error);
    res.write(
      `data: ${JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  }

  // Send updates every 2 seconds
  const interval = setInterval(() => {
    try {
      const healthData = getHealthData();
      res.write(`data: ${JSON.stringify(healthData)}\n\n`);
    } catch (error) {
      console.error("Error sending health data:", error);
      res.write(
        `data: ${JSON.stringify({
          error: error.message,
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
    }
  }, 2000);

  // Handle client disconnect
  req.on("close", () => {
    console.log("Health stream client disconnected");
    clearInterval(interval);
  });

  req.on("error", (err) => {
    console.error("Health stream error:", err);
    clearInterval(interval);
  });
});

export default router;
