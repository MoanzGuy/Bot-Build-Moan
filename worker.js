const BOT_TOKEN = "8875896303:AAF6XiYGB9MnPGdbx_d_7nI3dJ5ou30rI_o";
const GITHUB_TOKEN = "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";
const GITHUB_USER = "MoanzGuy";
const GITHUB_REPO = "Bot-Build-Moan";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── TELEGRAM ───────────────────────────────────────────────
async function sendMessage(chatId, text, extra = {}) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...extra,
    }),
  });
}

async function getFileUrl(fileId) {
  const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  const data = await res.json();
  if (!data.ok) return null;
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
}

async function downloadBinary(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── GITHUB ─────────────────────────────────────────────────
async function githubRequest(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": GITHUB_USER,
      Accept: "application/vnd.github+json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.github.com${path}`, opts);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function getFileSHA(repo, path) {
  const res = await githubRequest(
    `/repos/${GITHUB_USER}/${repo}/contents/${path}`
  );
  if (res.ok) return res.data.sha;
  return null;
}

async function uploadFile(repo, fileName, base64Content) {
  const sha = await getFileSHA(repo, fileName);
  const body = {
    message: `Upload ${fileName} via Bot`,
    content: base64Content,
  };
  if (sha) body.sha = sha;
  return await githubRequest(
    `/repos/${GITHUB_USER}/${repo}/contents/${fileName}`,
    "PUT",
    body
  );
}

async function triggerWorkflow(repo, workflow = "build.yml", ref = "main") {
  return await githubRequest(
    `/repos/${GITHUB_USER}/${repo}/actions/workflows/${workflow}/dispatches`,
    "POST",
    { ref }
  );
}

// ─── KV HELPERS ─────────────────────────────────────────────
async function getSession(userId) {
  const raw = await WORKER_KV.get(`session_${userId}`);
  return raw ? JSON.parse(raw) : {};
}

async function setSession(userId, data) {
  await WORKER_KV.put(`session_${userId}`, JSON.stringify(data), {
    expirationTtl: 3600,
  });
}

async function clearSession(userId) {
  await WORKER_KV.delete(`session_${userId}`);
}

async function getWorkers() {
  const raw = await WORKER_KV.get("workers");
  return raw ? JSON.parse(raw) : [];
}

async function saveWorkers(list) {
  await WORKER_KV.put("workers", JSON.stringify(list));
}

// ─── MENU KEYBOARD ──────────────────────────────────────────
function mainKeyboard() {
  return {
    reply_markup: JSON.stringify({
      keyboard: [
        [{ text: "🔨 Build APK" }, { text: "🚀 Deploy Website" }],
        [{ text: "📋 TQTO" }, { text: "🧰 Tools Menu" }],
        [{ text: "💰 Cek Credit" }, { text: "🛒 Buy Credit" }],
        [{ text: "⚠️ Lapor Bug" }, { text: "⚙️ Status Bot" }],
        [{ text: "🔑 Admin Panel" }],
        [{ text: "👑 Owner Panel" }, { text: "🌐 Semua Deploy" }],
      ],
      resize_keyboard: true,
    }),
  };
}

function cancelKeyboard() {
  return {
    reply_markup: JSON.stringify({
      keyboard: [[{ text: "❌ Batalkan" }]],
      resize_keyboard: true,
    }),
  };
}

// ─── HANDLERS ───────────────────────────────────────────────
async function handleStart(chatId, userId) {
  await clearSession(userId);
  const workers = await getWorkers();
  const workerList =
    workers.length > 0
      ? workers
          .map((w, i) => `${i + 1}. <b>${w.title}</b> — <code>${w.repo}</code>`)
          .join("\n")
      : "<i>Belum ada worker terdaftar.</i>";

  await sendMessage(
    chatId,
    `○ Saldo : ∞ Unlimited\n[ 🔄 ] Tap tombol di bawah untuk mulai build\n\n` +
      `( 🥦 ) Pilih menu di bawah...\n\n` +
      `🖥️ <b>GitHub Worker</b>\n\n` +
      `Tambah worker:\n<code>/addwolker title|repo|token</code>\n\n` +
      workerList,
    mainKeyboard()
  );
}

async function handleBuildAPK(chatId, userId) {
  await setSession(userId, { step: "build_apk_name" });
  await sendMessage(
    chatId,
    `🔨 <b>Siap Build Flutter APK!</b>\n\n` +
      `📦 Mode  : 💙 RELEASE\n` +
      `✅ Format : .zip\n` +
      `✅ Wajib  : pubspec.yaml\n` +
      `✅ Maks   : 2 GB\n\n` +
      `👑 OWNER PRIORITY (Level 1) — Build diproses paling depan!\n\n` +
      `Kirim nama project dulu:`,
    cancelKeyboard()
  );
}

async function handleDeployWebsite(chatId, userId) {
  await setSession(userId, { step: "deploy_web_name" });
  await sendMessage(
    chatId,
    `🚀 <b>Deploy Website</b>\n\nKirim nama subdomain project:\n<i>(huruf kecil, angka, min 3 karakter)</i>`,
    cancelKeyboard()
  );
}

async function handleCancel(chatId, userId) {
  await clearSession(userId);
  await sendMessage(chatId, "❌ Dibatalkan.", mainKeyboard());
}

async function handleAddWorker(chatId, text) {
  const parts = text.replace("/addwolker ", "").split("|");
  if (parts.length < 3) {
    await sendMessage(
      chatId,
      "❌ Format salah!\n<code>/addwolker title|repo|token</code>"
    );
    return;
  }
  const [title, repo, token] = parts.map((p) => p.trim());
  const workers = await getWorkers();
  workers.push({ title, repo, token, createdAt: Date.now() });
  await saveWorkers(workers);
  await sendMessage(
    chatId,
    `✅ <b>Worker Ditambahkan!</b>\n\n🏷️ Title: ${title}\n📦 Repo: ${repo}`
  );
}

async function handleCekCredit(chatId) {
  await sendMessage(chatId, `💰 <b>Saldo Kamu</b>\n\n∞ Unlimited Credit`);
}

async function handleStatusBot(chatId) {
  await sendMessage(
    chatId,
    `⚙️ <b>Status Bot</b>\n\n` +
      `🟢 Online\n` +
      `🖥️ Runtime: Cloudflare Workers\n` +
      `📦 Repo: <a href="https://github.com/${GITHUB_USER}/${GITHUB_REPO}">GitHub</a>`
  );
}

async function handleSemuaDeploy(chatId) {
  const workers = await getWorkers();
  if (workers.length === 0) {
    await sendMessage(chatId, "🌐 <b>Semua Deploy</b>\n\nBelum ada deploy.");
    return;
  }
  const list = workers
    .map(
      (w, i) =>
        `${i + 1}. <b>${w.title}</b>\n   📦 ${w.repo}\n   🕐 ${new Date(w.createdAt).toLocaleString("id-ID")}`
    )
    .join("\n\n");
  await sendMessage(chatId, `🌐 <b>Semua Deploy</b>\n\n${list}`);
}

async function handleAdminPanel(chatId) {
  const workers = await getWorkers();
  const list =
    workers.length > 0
      ? workers.map((w, i) => `${i + 1}. ${w.title} | ${w.repo}`).join("\n")
      : "Kosong.";
  await sendMessage(
    chatId,
    `🔑 <b>Admin Panel</b>\n\n<b>Workers:</b>\n${list}\n\n` +
      `/addwolker — Tambah worker\n` +
      `/clearworkers — Hapus semua worker\n` +
      `/setvercel TOKEN — Set Vercel token`
  );
}

async function handleOwnerPanel(chatId) {
  await sendMessage(
    chatId,
    `👑 <b>Owner Panel</b>\n\n` +
      `/adduser ID — Tambah user\n` +
      `/banuser ID — Ban user\n` +
      `/broadcast PESAN — Kirim ke semua user\n` +
      `/clearworkers — Reset workers`
  );
}

// ─── SESSION FLOW ────────────────────────────────────────────
async function handleSessionFlow(chatId, userId, text, document, session) {

  // BUILD APK FLOW
  if (session.step === "build_apk_name" && text) {
    const name = text.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (name.length < 3) {
      await sendMessage(chatId, "❌ Nama minimal 3 karakter.", cancelKeyboard());
      return;
    }
    await setSession(userId, { step: "build_apk_file", projectName: name });
    await sendMessage(
      chatId,
      `✅ Nama: <b>${name}</b>\n\nSekarang kirim file <code>.zip</code> project Flutter kamu:`,
      cancelKeyboard()
    );
    return;
  }

  if (session.step === "build_apk_file" && document) {
    const fileName = document.file_name;
    if (!fileName.endsWith(".zip")) {
      await sendMessage(chatId, "❌ Harus file .zip!", cancelKeyboard());
      return;
    }

    await sendMessage(chatId, `⏳ Mengupload <b>${fileName}</b> ke GitHub...`);

    const fileUrl = await getFileUrl(document.file_id);
    if (!fileUrl) {
      await sendMessage(chatId, "❌ Gagal mengambil file dari Telegram.");
      return;
    }

    const base64 = await downloadBinary(fileUrl);
    const uploadRes = await uploadFile(GITHUB_REPO, `projects/${session.projectName}/${fileName}`, base64);

    if (!uploadRes.ok) {
      await sendMessage(
        chatId,
        `❌ <b>Gagal Memproses File!</b>\n\n🔴 Error: <code>${uploadRes.data.message}</code>\n\nSilakan coba lagi.`
      );
      return;
    }

    // Trigger GitHub Actions workflow kalau ada
    await triggerWorkflow(GITHUB_REPO, "build.yml", "main");

    await clearSession(userId);
    await sendMessage(
      chatId,
      `✅ <b>Build Dimulai!</b>\n\n` +
        `📦 Project: <b>${session.projectName}</b>\n` +
        `📁 File: <code>${fileName}</code>\n` +
        `🔗 <a href="https://github.com/${GITHUB_USER}/${GITHUB_REPO}/actions">Lihat Progress Build</a>`,
      mainKeyboard()
    );
    return;
  }

  // DEPLOY WEBSITE FLOW
  if (session.step === "deploy_web_name" && text) {
    const name = text.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (name.length < 3) {
      await sendMessage(chatId, "❌ Nama minimal 3 karakter.", cancelKeyboard());
      return;
    }
    await setSession(userId, { step: "deploy_web_file", projectName: name });
    await sendMessage(
      chatId,
      `✅ Nama: <b>${name}</b>\n\nKirim file <code>.html</code> atau <code>.zip</code>:`,
      cancelKeyboard()
    );
    return;
  }

  if (session.step === "deploy_web_file" && document) {
    const fileName = document.file_name;
    const valid = fileName.endsWith(".html") || fileName.endsWith(".zip");
    if (!valid) {
      await sendMessage(chatId, "❌ File harus .html atau .zip!", cancelKeyboard());
      return;
    }

    await sendMessage(chatId, `⏳ Mengupload <b>${fileName}</b> ke GitHub...`);

    const fileUrl = await getFileUrl(document.file_id);
    if (!fileUrl) {
      await sendMessage(chatId, "❌ Gagal mengambil file dari Telegram.");
      return;
    }

    const base64 = await downloadBinary(fileUrl);
    const uploadRes = await uploadFile(
      GITHUB_REPO,
      `websites/${session.projectName}/${fileName}`,
      base64
    );

    if (!uploadRes.ok) {
      await sendMessage(
        chatId,
        `❌ <b>Gagal Memproses File!</b>\n\n🔴 Error: <code>${uploadRes.data.message}</code>\n\nSilakan coba lagi.`
      );
      return;
    }

    await clearSession(userId);
    await sendMessage(
      chatId,
      `✅ <b>Upload Berhasil!</b>\n\n` +
        `📦 Project: <b>${session.projectName}</b>\n` +
        `📁 File: <code>${fileName}</code>\n` +
        `🔗 <a href="https://github.com/${GITHUB_USER}/${GITHUB_REPO}">Lihat di GitHub</a>\n\n` +
        `Connect repo ke Vercel: <a href="https://vercel.com/import">vercel.com/import</a>`,
      mainKeyboard()
    );
    return;
  }
}

// ─── MAIN HANDLER ────────────────────────────────────────────
async function handleUpdate(update) {
  if (!update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || "";
  const document = msg.document || null;
  const session = await getSession(userId);

  // Cancel
  if (text === "❌ Batalkan") { await handleCancel(chatId, userId); return; }

  // Commands
  if (text === "/start" || text === "🔄 Menu") { await handleStart(chatId, userId); return; }
  if (text.startsWith("/addwolker ")) { await handleAddWorker(chatId, text); return; }
  if (text === "/clearworkers") { await saveWorkers([]); await sendMessage(chatId, "✅ Workers dihapus."); return; }
  if (text.startsWith("/setvercel ")) {
    const token = text.replace("/setvercel ", "").trim();
    await WORKER_KV.put("vercel_token", token);
    await sendMessage(chatId, "✅ Vercel token disimpan.");
    return;
  }

  // Menu buttons
  if (text === "🔨 Build APK") { await handleBuildAPK(chatId, userId); return; }
  if (text === "🚀 Deploy Website") { await handleDeployWebsite(chatId, userId); return; }
  if (text === "💰 Cek Credit") { await handleCekCredit(chatId); return; }
  if (text === "⚙️ Status Bot") { await handleStatusBot(chatId); return; }
  if (text === "🌐 Semua Deploy") { await handleSemuaDeploy(chatId); return; }
  if (text === "🔑 Admin Panel") { await handleAdminPanel(chatId); return; }
  if (text === "👑 Owner Panel") { await handleOwnerPanel(chatId); return; }
  if (text === "⚠️ Lapor Bug") { await sendMessage(chatId, "⚠️ Lapor bug ke @MoanzGuy"); return; }
  if (text === "📋 TQTO") { await sendMessage(chatId, "📋 <b>TQTO</b>\n\nFitur coming soon."); return; }
  if (text === "🧰 Tools Menu") { await sendMessage(chatId, "🧰 <b>Tools Menu</b>\n\nFitur coming soon."); return; }
  if (text === "🛒 Buy Credit") { await sendMessage(chatId, "🛒 <b>Buy Credit</b>\n\nHubungi @MoanzGuy untuk beli credit."); return; }

  // Session flow
  if (Object.keys(session).length > 0) {
    await handleSessionFlow(chatId, userId, text, document, session);
    return;
  }

  await sendMessage(chatId, "Ketik /start untuk memulai.", mainKeyboard());
}

// ─── ENTRY POINT ─────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    globalThis.WORKER_KV = env.WORKER_KV;

    if (request.method === "POST") {
      const update = await request.json();
      ctx.waitUntil(handleUpdate(update));
      return new Response("OK", { status: 200 });
    }

    const url = new URL(request.url);
    if (url.searchParams.get("setup") === "1") {
      const res = await fetch(
        `${TELEGRAM_API}/setWebhook?url=${url.origin}`,
        { method: "GET" }
      );
      const data = await res.json();
      return new Response(JSON.stringify(data, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("🤖 Bot Build Moan
