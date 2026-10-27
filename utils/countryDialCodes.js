// Convert ISO country codes from IP services into international dial codes.
const COUNTRY_DIAL_CODES = {
  AL: "+355", XK: "+383", US: "+1", CA: "+1", GB: "+44", AU: "+61",
  DE: "+49", FR: "+33", IT: "+39", ES: "+34", NL: "+31", BE: "+32",
  CH: "+41", AT: "+43", SE: "+46", NO: "+47", DK: "+45", FI: "+358",
  IE: "+353", PT: "+351", PL: "+48", CZ: "+420", SK: "+421", HU: "+36",
  RO: "+40", BG: "+359", GR: "+30", HR: "+385", RS: "+381", BA: "+387",
  ME: "+382", MK: "+389", SI: "+386", EE: "+372", LV: "+371", LT: "+370",
  UA: "+380", MD: "+373", TR: "+90", CY: "+357", IS: "+354", LU: "+352",
  MT: "+356", JP: "+81", CN: "+86", HK: "+852", MO: "+853", TW: "+886",
  KR: "+82", SG: "+65", MY: "+60", TH: "+66", VN: "+84", PH: "+63",
  ID: "+62", IN: "+91", PK: "+92", BD: "+880", LK: "+94", NP: "+977",
  AE: "+971", SA: "+966", QA: "+974", KW: "+965", BH: "+973", OM: "+968",
  IL: "+972", JO: "+962", LB: "+961", EG: "+20", MA: "+212", DZ: "+213",
  TN: "+216", LY: "+218", ZA: "+27", NG: "+234", KE: "+254", GH: "+233",
  ET: "+251", TZ: "+255", UG: "+256", CM: "+237", CI: "+225", SN: "+221",
  ZM: "+260", ZW: "+263", MZ: "+258", AO: "+244", NA: "+264", BW: "+267",
  AR: "+54", BR: "+55", CL: "+56", CO: "+57", PE: "+51", VE: "+58",
  UY: "+598", PY: "+595", BO: "+591", EC: "+593", MX: "+52", GT: "+502",
  CR: "+506", PA: "+507", DO: "+1", PR: "+1", JM: "+1", TT: "+1",
  NZ: "+64", FJ: "+679", PG: "+675", WS: "+685",
};

export const toDialCode = (countryCode) => {
  if (!countryCode || typeof countryCode !== "string") return "Unknown";
  const normalized = countryCode.trim().toUpperCase();
  return normalized.startsWith("+")
    ? normalized
    : COUNTRY_DIAL_CODES[normalized] || "Unknown";
};
