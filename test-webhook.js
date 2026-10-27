/**
 * Test script to check if Telegram webhook is working
 * 
 * Usage:
 * 1. Make sure backend is running: npm start
 * 2. Run this script: node test-webhook.js
 * 3. Check the output to see webhook status
 */

import axios from 'axios';
import 'dotenv/config';

const BOT_TOKEN = process.env.BOT;
const CHAT_ID = process.env.CHAT_ID;

async function testWebhook() {
  console.log('\n🔍 Testing Telegram Bot Configuration...\n');

  if (!BOT_TOKEN) {
    console.error('❌ BOT token not found in environment variables');
    return;
  }

  if (!CHAT_ID) {
    console.error('❌ CHAT_ID not found in environment variables');
    return;
  }

  console.log('✅ BOT token found');
  console.log('✅ CHAT_ID found:', CHAT_ID);

  try {
    // Check bot info
    console.log('\n📱 Checking bot info...');
    const botInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    console.log('✅ Bot name:', botInfo.data.result.username);
    console.log('✅ Bot ID:', botInfo.data.result.id);

    // Check webhook info
    console.log('\n🔗 Checking webhook status...');
    const webhookInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    
    if (webhookInfo.data.result.url) {
      console.log('✅ Webhook URL:', webhookInfo.data.result.url);
      console.log('📊 Pending updates:', webhookInfo.data.result.pending_update_count);
      
      if (webhookInfo.data.result.last_error_message) {
        console.log('⚠️  Last error:', webhookInfo.data.result.last_error_message);
      }
    } else {
      console.log('⚠️  No webhook configured');
      console.log('\n💡 To set up webhook, use one of these methods:');
      console.log('   1. Using ngrok (for testing):');
      console.log('      - Run: ngrok http 5000');
      console.log('      - Copy the HTTPS URL');
      console.log('      - Visit: http://localhost:5000/api/telegram/setup?url=YOUR_NGROK_URL/api/telegram/webhook');
      console.log('\n   2. Using production server:');
      console.log('      - Visit: http://localhost:5000/api/telegram/setup?url=https://yourdomain.com/api/telegram/webhook');
    }

    // Send test message
    console.log('\n📤 Sending test message...');
    const testMessage = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: '✅ *Test Message*\n\nYour Telegram bot is working correctly!\n\nYou can now use the APPAUTH system.',
        parse_mode: 'Markdown'
      }
    );

    if (testMessage.data.ok) {
      console.log('✅ Test message sent successfully!');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }

  console.log('\n✅ Test complete!\n');
}

testWebhook();
