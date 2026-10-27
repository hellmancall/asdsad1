import fs from "fs";
import path from "path";

const BAN_FILE_PATH = path.join(process.cwd(), "data", "banned_ids.txt");

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.dirname(BAN_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

export const addBannedId = (id) => {
  ensureDataDirectory();

  try {
    let bannedIds = [];

    // Read existing banned IDs if file exists
    if (fs.existsSync(BAN_FILE_PATH)) {
      const fileContent = fs.readFileSync(BAN_FILE_PATH, "utf8");
      bannedIds = fileContent.split("\n").filter((line) => line.trim() !== "");
    }

    // Check if ID is already banned
    if (!bannedIds.includes(id)) {
      bannedIds.push(id);
      fs.writeFileSync(BAN_FILE_PATH, bannedIds.join("\n") + "\n", "utf8");
    }

    return true;
  } catch (error) {
    throw new Error(`Failed to add banned ID: ${error.message}`);
  }
};

export const checkBannedId = (id) => {
  ensureDataDirectory();

  try {
    if (!fs.existsSync(BAN_FILE_PATH)) {
      return false;
    }

    const fileContent = fs.readFileSync(BAN_FILE_PATH, "utf8");
    const bannedIds = fileContent
      .split("\n")
      .filter((line) => line.trim() !== "");

    return bannedIds.includes(id);
  } catch (error) {
    // If there's an error reading the file, assume not banned for security
    console.error("Error checking banned ID:", error);
    return false;
  }
};
