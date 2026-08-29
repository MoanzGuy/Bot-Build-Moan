// ============================================================
//  INI SATU-SATUNYA FILE YANG KAMU BUTUHKAN UNTUK CLOUDFLARE
//  TINGGAL COPAS, SET ENV, DAN DEPLOY.
// ============================================================

export default {
  async fetch(request, env) {
    // ----- AMBIL ENVIRONMENT VARIABLE (DI SET DI DASHBOARD) -----
    const BOT_TOKEN = env.BOT_TOKEN;
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const REPO = env.REPO || 'MoanzGuy/Bot-Build-Moan';

    // ----- FUNGSI KIRIM PESAN KE TELEGRAM -----
    async function sendTelegram(chatId, text) {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
      });
    }

    // ----- FUNGSI TRIGGER BUILD GITHUB -----
    async function triggerBuild() {
      const url = `https://api.github.com/repos/${REPO}/actions/workflows/build.yml/dispatches`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({ ref: 'main' })
      });
      return resp.ok;
    }

    // ----- FUNGSI CEK STATUS BUILD -----
    async function getStatus() {
      const url = `https://api.github.com/repos/${REPO}/actions/runs?branch=main&per_page=1`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const run = data.workflow_runs?.[0];
      if (!run) return { status: 'Belum ada build' };
      return {
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url
      };
    }

    // ----- HANDLER PESAN MASUK -----
    async function handleMessage(chatId, text) {
      const cmd = text.trim().toLowerCase();

      if (cmd === '/start') {
        await sendTelegram(chatId,
          `☠️ *XOW BOT BUILDER AKTIF* ☠️\n\n` +
          `Kirim perintah:\n` +
          `/build - Mulai build APK\n` +
          `/status - Cek status build\n` +
          `/download - Cara download APK`
        );
      } 
      else if (cmd === '/build') {
        const ok = await triggerBuild();
        if (ok) {
          await sendTelegram(chatId, '✅ *Build berhasil dijalankan!* Cek /status nanti.');
        } else {
          await sendTelegram(chatId, '❌ *Gagal!* Cek token GitHub atau file workflow.');
        }
      } 
      else if (cmd === '/status') {
        const data = await getStatus();
        if (!data) {
          await sendTelegram(chatId, '❌ Gagal ambil status.');
          return;
        }
        if (data.status === 'Belum ada build') {
          await sendTelegram(chatId, '📭 Belum ada build yang dijalankan.');
        } else {
          await sendTelegram(chatId,
            `📊 *Status Build:*\n` +
            `Status: ${data.status}\n` +
            `Hasil: ${data.conclusion}\n` +
            `[Lihat Detail](${data.url})`
          );
        }
      } 
      else if (cmd === '/download') {
        await sendTelegram(chatId,
          `📥 *Cara Download APK:*\n` +
          `1. Buka repo: https://github.com/${REPO}\n` +
          `2. Klik tab *Actions*\n` +
          `3. Pilih workflow terbaru\n` +
          `4. Download artifact *telegram-bot-apk*`
        );
      } 
      else {
        await sendTelegram(chatId, '❓ Perintah gak dikenal. Ketik /start untuk bantuan.');
      }
    }

    // ----- ROUTING UTAMA -----
    const url = new URL(request.url);
    const path = url.pathname;

    // Endpoint untuk Webhook Telegram
    if (path === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        if (update.message && update.message.text) {
          await handleMessage(update.message.chat.id, update.message.text);
        }
        return new Response('OK', { status: 200 });
      } catch (err) {
        console.error(err);
        return new Response('Error', { status: 500 });
      }
    }

    // Halaman utama (cek apakah worker hidup)
    return new Response(
      `☠️ XOW WORKER AKTIF ☠️\n` +
      `Set webhook bot ke:\n` +
      `https://${url.hostname}/webhook`
    );
  }
};
