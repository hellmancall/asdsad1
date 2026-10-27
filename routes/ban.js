import express from "express";
import { addBannedId } from "../utils/banManager.js";

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

    // Add ID to banned list
    const success = addBannedId(id);

    if (success) {
      console.log(`ID ${id} has been banned (requested from IP: ${clientIP})`);

      return res.status(200).json({
        success: true,
        message: `ID ${id} has been banned`,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to ban ID",
      });
    }
  } catch (error) {
    console.error("Error in /api/ban:", error);

    if (error.message.includes("Invalid ID format")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
