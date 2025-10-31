const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../middleware/authenticate');

// Import Twilio SDK
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Import SendGrid for email
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// POST endpoint to send SMS
router.post('/send-sms', authenticateJWT, async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Missing required fields: to, message' });
    }

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
    });

    res.status(200).json({ success: true, messageSid: result.sid });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: 'Failed to send SMS', details: error.message });
  }
});

// POST endpoint to send email via SendGrid
router.post('/send-email', authenticateJWT, async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, text or html' });
    }

    const msg = {
      to: to,
      from: process.env.SENDGRID_FROM_EMAIL, // Must be a verified sender in SendGrid
      subject: subject,
      text: text,
      html: html,
    };

    const result = await sgMail.send(msg);

    res.status(200).json({ success: true, statusCode: result[0].statusCode });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

module.exports = { messaging: router };
