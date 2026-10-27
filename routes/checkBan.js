import express from "express";
import { checkBannedId } from "../utils/banManager.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID parameter
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID parameter is required",
      });
    }

    const clientIP = req.clientIP || req.ip || "unknown";

    // Check if ID is banned
    const isBanned = checkBannedId(id);

    // Log ban check for monitoring
    if (isBanned) {
      console.log(
        `Ban check: ID ${id} is banned (checked from IP: ${clientIP})`
      );
    }

    return res.status(200).json({
      success: true,
      data: isBanned,
    });
  } catch (error) {
    console.error("Error in /api/checkBan:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
