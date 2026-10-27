# Email Configuration Setup

This project uses Nodemailer to send confirmation emails to users after they schedule appointments.

## Configuration

All email settings are stored in the `.env` file in the backend directory.

### Environment Variables

```env
APP_NAME="ePuna Careers"          # Brand name shown in emails
EMAIL_HOST="smtp.gmail.com"       # SMTP server host
EMAIL_PORT=587                    # SMTP port (587 for TLS, 465 for SSL)
EMAIL_USER="your-email@gmail.com" # Your email address
EMAIL_PASS="your-app-password"    # Your email password or app password
```

## Gmail Setup Instructions

If you're using Gmail, follow these steps:

1. **Enable 2-Factor Authentication**
   - Go to your Google Account settings
   - Navigate to Security
   - Enable 2-Step Verification

2. **Create an App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter a name like "Tesla Careers App"
   - Copy the 16-character password
   - Use this as your `EMAIL_PASS` in the .env file

3. **Update .env file**
   ```env
   EMAIL_USER="youremail@gmail.com"
   EMAIL_PASS="xxxx xxxx xxxx xxxx"  # 16-char app password from step 2
   ```

## Other Email Providers

### Outlook/Hotmail
```env
EMAIL_HOST="smtp-mail.outlook.com"
EMAIL_PORT=587
```

### Yahoo
```env
EMAIL_HOST="smtp.mail.yahoo.com"
EMAIL_PORT=587
```

### Custom SMTP Server
Consult your email provider's documentation for SMTP settings.

## Email Template

The confirmation email includes:
- Meeting details (agent, date, time)
- Job interests selected by the user
- Work preferences selected by the user
- Professional HTML formatting with inline CSS
- Plain text fallback

## Testing

To test email functionality:

1. Ensure your backend server is running
2. Complete the appointment booking flow in the frontend
3. Check the email inbox for the confirmation
4. Check backend logs for any errors

## Troubleshooting

### "Invalid login" error
- Double-check your EMAIL_USER and EMAIL_PASS
- For Gmail, ensure you're using an App Password, not your regular password
- Verify 2FA is enabled on your Google account

### "Connection timeout" error
- Check your internet connection
- Verify the EMAIL_HOST and EMAIL_PORT are correct
- Some networks block SMTP ports - try using a different network

### Email not received
- Check spam/junk folder
- Verify the recipient email address is correct
- Check backend logs for sending errors
- Ensure your email provider allows sending emails programmatically

## Security Notes

- Never commit the `.env` file to version control
- Use `.env.example` as a template
- Keep your EMAIL_PASS secure
- Rotate your app passwords periodically
- Consider using environment-specific configurations for production

## API Endpoint

**POST** `/api/send-confirmation`

Request body:
```json
{
  "email": "user@example.com",
  "agentName": "Sarah Johnson",
  "agentTitle": "Senior Recruiter",
  "scheduledDate": "2026-02-15",
  "scheduledTime": "14:00",
  "jobInterests": ["Software Engineering", "Data Science"],
  "workPreferences": ["Remote", "Full-time"]
}
```

Response:
```json
{
  "success": true,
  "message": "Confirmation email sent successfully",
  "messageId": "<unique-message-id>"
}
```
