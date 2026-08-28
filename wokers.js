// ============================================
// TELEGRAM BOT WORKER - CLOUDFLARE
// ============================================

const BOT_TOKEN = '8924768769:AAHspBsqCYfeFmVo4lvDxg5QoWijSF5w2XE'; // ← GANTI INI!

// ============================================
// HANDLER UTAMA
// ============================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // Root - Cek status
    if (url.pathname === '/' && method === 'GET') {
      return new Response(JSON.stringify({
        status: 'online',
        bot: 'Telegram Bot Worker',
        time: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Webhook endpoint
    if (url.pathname === '/webhook' && method === 'POST') {
      return handleWebhook(request);
    }

    // Setup webhook (manual trigger)
    if (url.pathname === '/setup' && method === 'GET') {
      return setupWebhook(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};

// ============================================
// WEBHOOK HANDLER
// ============================================

async function handleWebhook(request) {
  try {
    const body = await request.json();
    const { message, callback_query } = body;

    if (callback_query) {
      await handleCallback(callback_query);
      return new Response('OK', { status: 200 });
    }

    if (message) {
      await handleMessage(message);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error:', error);
    return new Response('Error', { status: 500 });
  }
}

// ============================================
// MESSAGE HANDLER
// ============================================

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const from = message.from?.first_name || 'User';

  if (text.startsWith('/')) {
    await handleCommand(message);
    return;
  }

  // Auto reply
  const replies = {
    'hai': '👋 Hai juga! Ada yang bisa saya bantu?',
    'halo': '👋 Halo! Senang bertemu denganmu!',
    'p': '🏓 Pong!',
    'test': '✅ Bot berfungsi dengan baik!',
    'help': '💡 Ketik /help untuk bantuan',
    'makasih': '🙏 Sama-sama!'
  };

  const lowerText = text.toLowerCase();
  for (const [keyword, reply] of Object.entries(replies)) {
    if (lowerText.includes(keyword)) {
      await sendMessage(chatId, reply);
      return;
    }
  }

  if (text && text.length > 0) {
    await sendMessage(chatId, `👋 Halo ${from}! Kamu ngetik: "${text}"\nKetik /help untuk bantuan.`);
  }
}

// ============================================
// COMMAND HANDLER
// ============================================

async function handleCommand(message) {
  const chatId = message.chat.id;
  const text = message.text;
  const command = text.split(' ')[0].toLowerCase();
  const args = text.split(' ').slice(1);

  switch (command) {
    case '/start':
      await sendMessage(chatId, `
👋 <b>Selamat datang di Bot!</b>

Bot ini berjalan di Cloudflare Worker 🚀

📌 <b>Perintah yang tersedia:</b>
/help - Bantuan
/info - Info bot
/ping - Cek koneksi
/whoami - Info user
/time - Waktu sekarang
/echo &lt;pesan&gt; - Echo pesan

Made with ❤️
      `, { parse_mode: 'HTML' });
      break;

    case '/help':
      await sendMessage(chatId, `
📚 <b>Daftar Perintah</b>

/start - Mulai bot
/help - Bantuan ini
/info - Info bot
/ping - Cek koneksi
/whoami - Info user
/time - Waktu sekarang
/echo &lt;pesan&gt; - Echo

📝 <b>Contoh:</b>
/echo Halo semua!
      `, { parse_mode: 'HTML' });
      break;

    case '/info':
      await sendMessage(chatId, `
🤖 <b>Info Bot</b>

⚡ Platform: Cloudflare Workers
🔄 Status: Online
📦 Version: 1.0.0
🌐 Region: Global

✅ Bot siap digunakan!
      `, { parse_mode: 'HTML' });
      break;

    case '/ping':
      const start = Date.now();
      await sendMessage(chatId, '🏓 Pong!');
      const latency = Date.now() - start;
      await sendMessage(chatId, `⏱️ Latency: ${latency}ms`);
      break;

    case '/whoami':
      const user = message.from;
      await sendMessage(chatId, `
👤 <b>Info User</b>

ID: <code>${user.id}</code>
Nama: ${user.first_name || '-'}
Username: ${user.username ? '@' + user.username : '-'}
Bahasa: ${user.language_code || '-'}
      `, { parse_mode: 'HTML' });
      break;

    case '/time':
      const now = new Date();
      const timeStr = now.toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta'
      });
      await sendMessage(chatId, `🕐 Waktu sekarang:\n<code>${timeStr}</code>`, { parse_mode: 'HTML' });
      break;

    case '/echo':
      if (args.length === 0) {
        await sendMessage(chatId, '⚠️ Masukkan pesan: /echo <pesan>');
        return;
      }
      await sendMessage(chatId, `📢 ${args.join(' ')}`);
      break;

    default:
      await sendMessage(chatId, '❓ Perintah tidak dikenal. Ketik /help untuk bantuan.');
  }
}

// ============================================
// CALLBACK HANDLER
// ============================================

async function handleCallback(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  
  if (data === 'button_click') {
    await sendMessage(chatId, '✅ Kamu mengklik tombol!');
  }
}

// ============================================
// TELEGRAM API
// ============================================

async function sendMessage(chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: true,
    ...options
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Send message error:', error);
    throw error;
  }
}

// ============================================
// SETUP WEBHOOK
// ============================================

async function setupWebhook(request) {
  const url = new URL(request.url);
  const webhookUrl = `${url.origin}/webhook`;
  
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`
  );
  
  const result = await response.json();
  
  return new Response(JSON.stringify({
    success: result.ok,
    result: result,
    webhook_url: webhookUrl,
    message: result.ok ? '✅ Webhook setup berhasil!' : '❌ Gagal setup webhook'
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
                                 }
