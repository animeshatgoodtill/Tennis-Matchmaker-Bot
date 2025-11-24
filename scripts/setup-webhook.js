import 'dotenv/config';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.VERCEL_URL || 'https://your-app.vercel.app';

async function setupWebhook() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set');
    process.exit(1);
  }

  if (!WEBHOOK_URL) {
    console.error('❌ VERCEL_URL is not set');
    process.exit(1);
  }

  const webhookEndpoint = `${WEBHOOK_URL}/api/webhook`;
  
  try {
    // Set webhook
    const setWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
    const response = await fetch(setWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookEndpoint,
        allowed_updates: ['message', 'callback_query']
      })
    });

    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Webhook set successfully!');
      console.log(`📍 Webhook URL: ${webhookEndpoint}`);
      
      // Get webhook info
      const infoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
      const infoResponse = await fetch(infoUrl);
      const info = await infoResponse.json();
      
      console.log('\n📊 Webhook Info:');
      console.log(`URL: ${info.result.url}`);
      console.log(`Pending updates: ${info.result.pending_update_count || 0}`);
      if (info.result.last_error_message) {
        console.log(`⚠️ Last error: ${info.result.last_error_message}`);
      }
    } else {
      console.error('❌ Failed to set webhook:', data);
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error);
  }
}

setupWebhook();
