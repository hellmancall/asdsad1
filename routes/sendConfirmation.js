import express from "express";
import axios from "axios";
import pkg from "nodemailer";
import dotenv from "dotenv";

const { createTransport } = pkg;

dotenv.config();

const router = express.Router();

const createTransporter = () =>
  createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

const getCalendlyToken = () =>
  process.env.CALENDLY_API_TOKEN || process.env.CALENDLY_PERSONAL_ACCESS_TOKEN;

const fetchCalendlyResource = async (uri, token) => {
  if (!uri) {
    return null;
  }

  const response = await axios.get(uri, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return response.data?.resource || null;
};

const buildScheduleDetails = ({
  scheduledAt,
  scheduledDate,
  scheduledTime,
  timezone,
}) => {
  const dateSource = scheduledAt || scheduledDate;
  const parsedDate = dateSource ? new Date(dateSource) : null;
  const hasValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());
  const resolvedTimezone = timezone || "UTC";

  return {
    resolvedDate:
      scheduledDate ||
      (hasValidDate ? parsedDate.toISOString().split("T")[0] : ""),
    resolvedTime:
      scheduledTime ||
      (hasValidDate
        ? new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: resolvedTimezone,
            timeZoneName: "short",
          }).format(parsedDate)
        : ""),
    formattedDate: hasValidDate
      ? new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: resolvedTimezone,
        }).format(parsedDate)
      : scheduledDate || "",
    resolvedScheduledAt: hasValidDate ? parsedDate.toISOString() : "",
    resolvedTimezone,
  };
};

const resolveBookingPayload = async (body) => {
  const {
    email,
    agentName,
    agentTitle,
    scheduledDate,
    scheduledTime,
    scheduledAt,
    timezone,
    jobInterests = [],
    workPreferences = [],
    inviteeUri,
    eventUri,
  } = body;

  let resolvedEmail = email;
  let resolvedScheduledAt = scheduledAt;
  let resolvedTimezone = timezone;
  let inviteeName = "";

  if (inviteeUri || eventUri) {
    const calendlyToken = getCalendlyToken();

    if (!calendlyToken) {
      throw Object.assign(
        new Error(
          "Calendly API token is missing. Set CALENDLY_API_TOKEN in the backend environment."
        ),
        { statusCode: 500 }
      );
    }

    const [invitee, calendlyEvent] = await Promise.all([
      fetchCalendlyResource(inviteeUri, calendlyToken),
      fetchCalendlyResource(eventUri, calendlyToken),
    ]);

    resolvedEmail =
      resolvedEmail ||
      invitee?.email ||
      invitee?.email_address ||
      invitee?.questions_and_answers?.find(
        (answer) => answer?.position === "email"
      )?.answer ||
      "";
    inviteeName = invitee?.name || invitee?.first_name || "";
    resolvedScheduledAt =
      resolvedScheduledAt ||
      calendlyEvent?.start_time ||
      invitee?.start_time ||
      "";
    resolvedTimezone =
      resolvedTimezone ||
      invitee?.timezone ||
      calendlyEvent?.timezone ||
      "";
  }

  const schedule = buildScheduleDetails({
    scheduledAt: resolvedScheduledAt,
    scheduledDate,
    scheduledTime,
    timezone: resolvedTimezone,
  });

  return {
    email: resolvedEmail,
    inviteeName,
    agentName,
    agentTitle,
    scheduledDate: schedule.resolvedDate,
    scheduledTime: schedule.resolvedTime,
    scheduledAt: schedule.resolvedScheduledAt,
    timezone: schedule.resolvedTimezone,
    formattedDate: schedule.formattedDate,
    jobInterests,
    workPreferences,
  };
};

const buildTagsSection = (title, items, accentColor) => {
  if (!items?.length) {
    return "";
  }

  const tags = items
    .map(
      (item) => `
        <span style="display:inline-block;margin:4px 6px 0 0;padding:8px 12px;border-radius:999px;background:${accentColor};color:#ffffff;font-size:12px;font-weight:600;">
          ${item}
        </span>
      `
    )
    .join("");

  return `
    <div style="background:#ffffff;border:1px solid #e8f2ff;border-radius:12px;padding:20px;margin:16px 0;box-shadow:0 2px 8px rgba(0, 107, 255, 0.05);">
      <p style="font-size:12px;font-weight:700;color:#006BFF;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px 0;">
        ${title}
      </p>
      <div>${tags}</div>
    </div>
  `;
};

router.post("/", async (req, res) => {
  try {
    const appointment = await resolveBookingPayload(req.body);

    if (
      !appointment.email ||
      !appointment.agentName ||
      !appointment.scheduledDate ||
      !appointment.scheduledTime
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        received: {
          email: appointment.email,
          agentName: appointment.agentName,
          scheduledDate: appointment.scheduledDate,
          scheduledTime: appointment.scheduledTime,
        },
      });
    }

    const appName = process.env.APP_NAME || "Careers Portal";
    const transporter = createTransporter();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:20px;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15, 23, 42, 0.08);">
            <div style="padding:28px 24px;border-bottom:3px solid #006BFF;background:linear-gradient(90deg,#eff6ff 0%,#ffffff 55%,#eff6ff 100%);text-align:center;">
              <div style="font-size:26px;font-weight:700;color:#111827;">${appName}</div>
              <div style="margin-top:10px;font-size:12px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">Powered by Calendly Scheduling</div>
            </div>
            <div style="background:#006BFF;color:#ffffff;padding:36px 28px;text-align:center;">
              <div style="width:54px;height:54px;border-radius:999px;background:rgba(255,255,255,0.18);margin:0 auto 18px;line-height:54px;font-size:28px;font-weight:700;">✓</div>
              <h1 style="margin:0;font-size:30px;line-height:1.2;">Your meeting is confirmed</h1>
              <p style="margin:12px 0 0 0;font-size:16px;opacity:0.96;">We have reserved your time with ${appointment.agentName}.</p>
            </div>
            <div style="padding:32px 28px;">
              <p style="margin:0 0 12px 0;font-size:18px;font-weight:600;color:#111827;">
                ${appointment.inviteeName ? `Hi ${appointment.inviteeName},` : "Hello,"}
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:#4b5563;">
                Thanks for booking. Your appointment has been scheduled, and your confirmation details are below.
              </p>

              <div style="background:#ffffff;border:1px solid #e8f2ff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0, 107, 255, 0.05);margin-bottom:16px;">
                <div style="background:#006BFF;padding:12px 20px;border-bottom:2px solid #0052CC;">
                  <p style="margin:0;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.5px;">Meeting Details</p>
                </div>
                <div style="padding:20px;background:#fafbff;">
                  <p style="margin:0 0 10px 0;font-size:18px;font-weight:700;color:#111827;">${appointment.formattedDate}</p>
                  <p style="margin:0 0 10px 0;font-size:15px;color:#4b5563;">${appointment.scheduledTime}</p>
                  <p style="margin:0;font-size:14px;color:#6b7280;">${appointment.agentName}${appointment.agentTitle ? ` • ${appointment.agentTitle}` : ""}</p>
                </div>
              </div>

              ${buildTagsSection("Job Interests", appointment.jobInterests, "#006BFF")}
              ${buildTagsSection("Work Preferences", appointment.workPreferences, "#10B981")}

              <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;">
                  Please keep this email for your records. Calendly will also send the meeting invite and conferencing details separately.
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = [
      "Meeting Confirmed",
      "",
      appointment.inviteeName ? `Hi ${appointment.inviteeName},` : "Hello,",
      `Your meeting with ${appointment.agentName} is confirmed.`,
      `Date: ${appointment.formattedDate}`,
      `Time: ${appointment.scheduledTime}`,
      appointment.agentTitle ? `Role: ${appointment.agentTitle}` : null,
      appointment.jobInterests.length
        ? `Job Interests: ${appointment.jobInterests.join(", ")}`
        : null,
      appointment.workPreferences.length
        ? `Work Preferences: ${appointment.workPreferences.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const mailOptions = {
      from: `"${appName}" <${process.env.EMAIL_USER}>`,
      to: appointment.email,
      subject: `${appName} Appointment Confirmation`,
      text: textContent,
      html: htmlContent,
    };

    let info = { messageId: null };
    let emailSent = true;

    try {
      info = await transporter.sendMail(mailOptions);
    } catch (_error) {
      emailSent = false;
    }

    return res.status(200).json({
      success: true,
      message: "Confirmation email sent successfully",
      messageId: info.messageId,
      emailSent,
      appointment,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to send confirmation email. Please try again.",
    });
  }
});

export default router;
