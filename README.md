# 🤖 Telegram Bot Worker

Bot Telegram yang berjalan di Cloudflare Worker.

## 🚀 Deploy

Klik tombol dibawah untuk deploy:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/telegram-bot-worker)

## 📝 Fitur

- ✅ Command: /start, /help, /info, /ping, /whoami, /time, /echo
- ✅ Auto reply
- ✅ Inline keyboard support
- ✅ Webhook integration

## 🔧 Setup

1. Dapatkan token dari @BotFather di Telegram
2. Ganti `BOT_TOKEN` di `worker.js` dan `wrangler.toml`
3. Deploy ke Cloudflare Workers
4. Akses `https://your-worker.dev/setup` untuk setup webhook

## 📦 Tech Stack

- Cloudflare Workers
- JavaScript
- Telegram Bot API

## 📄 License

MIT
