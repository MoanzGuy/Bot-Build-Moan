const BOT_TOKEN = "8875896303:AAF6XiYGB9MnPGdbx_d_7nI3dJ5ou30rI_o";
const GITHUB_TOKEN = "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";
const GITHUB_USER = "MoanzGuy";
const GITHUB_REPO = "Bot-Build-Moan";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId, text, parseMode = "HTML") {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
    }),
  });
}

async function createGithubRepo(repoName, token, user) {
  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      "User-Agent": user,
    },
    body: JSON.stringify({
      name: repoName,
      private: false,
      auto_init: true,
    }),
  });
  return res;
}

async function uploadFileToGithub(repoName, fileName, content, token, user) {
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const res = await fetch(
    `https://api.github.com/repos/${user}/${repoName}/contents/${fileName}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        "User-Agent": user,
      },
      body: JSON.stringify({
        message: `Upload ${fileName}`,
        content: encoded,
      }),
    }
  );
  return res;
}

async function deployToVercel(repoName, githubUser) {
  const vercelToken = await WORKER_KV.get("vercel_token");
  if (!vercelToken) return null;

  const res = await fetch("https://api.vercel.com/v1/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: repoName,
      gitSource: {
        type: "github",
        repoId: `${githubUser}/${repoName}`,
        ref: "main",
      },
    }),
  });
  return res;
}

// Store per-user session di KV
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

// Worker registry
async function getWorkers() {
  const raw = await WORKER_KV.get("workers");
  return raw ? JSON.parse(raw) : [];
}

async function addWorker(title, repo, token) {
  const workers = await getWorkers();
  workers.push({ title, repo, token, createdAt: Date.now() });
  await WORKER_KV.put("workers", JSON.stringify(workers));
}

async function handleUpdate(update) {
  if (!update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || "";
  const document = msg.document;

  const session = await getSession(userId);

  // /start
  if (text === "/start") {
    await clearSession(userId);
    const workers = await getWorkers();
    const workerList =
      workers.length > 0
        ? workers.map((w, i) => `${i + 1}. <b>${w.title}</b> — ${w.repo}`).join("\n")
        : "<i>Belum ada worker terdaftar.</i>";

    await sendMessage(
      chatId,
      `🖥️ <b>GitHub Worker</b>\n\n` +
        `Tambah worker baru pakai command:\n<code>/addwolker title|repo|token</code>\n\n` +
        workerList +
        `\n\n<b>Admin Panel</b> → /admin`
    );
    return;
  }

  // /addwolker title|repo|token
  if (text.startsWith("/addwolker ")) {
    const parts = text.replace("/addwolker ", "").split("|");
    if (parts.length < 3) {
      await sendMessage(chatId, "❌ Format salah!\nGunakan: <code>/addwolker title|repo|token</code>");
      return;
    }
    const [title, repo, token] = parts;
    await addWorker(title.trim(), repo.trim(), token.trim());
    await sendMessage(chatId, `✅ <b>Worker Ditambahkan!</b>\n\n🏷️ Title: ${title}\n📦 Repo: ${repo}`);
    return;
  }

  // /build — mulai flow build
  if (text === "/build") {
    await setSession(userId, { step: "awaiting_name" });
    await sendMessage(
      chatId,
      `🚀 <b>Build Project Baru</b>\n\nKirim nama project kamu:\n<i>(huruf kecil, angka, min 3 karakter, tanpa spasi/simbol)</i>`
    );
    return;
  }

  // /admin
  if (text === "/admin") {
    const workers = await getWorkers();
    const list =
      workers.length > 0
        ? workers.map((w, i) => `${i + 1}. ${w.title} | ${w.repo}`).join("\n")
        : "Kosong.";
    await sendMessage(
      chatId,
      `⚙️ <b>Admin Panel</b>\n\n<b>Workers:</b>\n${list}\n\n` +
        `/build — Mulai build baru\n` +
        `/addwolker — Tambah worker\n` +
        `/clearworkers — Hapus semua worker`
    );
    return;
  }

  // /clearworkers
  if (text === "/clearworkers") {
    await WORKER_KV.put("workers", JSON.stringify([]));
    await sendMessage(chatId, "✅ Semua worker dihapus.");
    return;
  }

  // Flow session-based
  if (session.step === "awaiting_name") {
    const name = text.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (name.length < 3) {
      await sendMessage(chatId, "❌ Nama terlalu pendek, min 3 karakter.");
      return;
    }
    await setSession(userId, { step: "awaiting_subdomain", projectName: name });

    // Buat subdomain default dari nama
    const subdomain = `https://${name}.vercel.app`;
    await sendMessage(
      chatId,
      `✅ <b>Nama Tersimpan!</b>\n\n🌐 Subdomain: <code>${subdomain}</code>\n\nSekarang kirim:\n• File <code>.html</code> tunggal, <b>atau</b>\n• File <code>.zip</code> project web (html+css+js+gambar)`
    );
    return;
  }

  if (session.step === "awaiting_subdomain" && document) {
    const fileName = document.file_name;
    const isHtml = fileName.endsWith(".html");
    const isZip = fileName.endsWith(".zip");

    if (!isHtml && !isZip) {
      await sendMessage(chatId, "❌ File harus .html atau .zip!");
      return;
    }

    // Download file dari Telegram
    const fileInfoRes = await fetch(
      `${TELEGRAM_API}/getFile?file_id=${document.file_id}`
    );
    const fileInfo = await fileInfoRes.json();
    const filePath = fileInfo.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    const fileRes = await fetch(fileUrl);
    const fileContent = await fileRes.text();

    const projectName = session.projectName;

    // Push ke GitHub repo yang ada
    await sendMessage(chatId, `⏳ Mengupload <b>${fileName}</b> ke GitHub...`);

    const uploadRes = await uploadFileToGithub(
      GITHUB_REPO,
      fileName,
      fileContent,
      GITHUB_TOKEN,
      GITHUB_USER
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      await sendMessage(
        chatId,
        `❌ <b>Upload Gagal!</b>\n\n<code>${err.message}</code>`
      );
      return;
    }

    await clearSession(userId);

    const deployUrl = `https://${projectName}.vercel.app`;
    await sendMessage(
      chatId,
      `✅ <b>Upload Berhasil!</b>\n\n📦 File: <code>${fileName}</code>\n🔗 GitHub: <code>https://github.com/${GITHUB_USER}/${GITHUB_REPO}</code>\n\n` +
        `🚀 File sudah di-push ke repo.\nDeploy manual ke Vercel via: <a href="https://vercel.com/import">vercel.com/import</a>\n\n` +
        `Atau connect repo <b>${GITHUB_REPO}</b> di Vercel dashboard.`
    );
    return;
  }

  // Default
  await sendMessage(
    chatId,
    `Gunakan /start untuk memulai atau /build untuk deploy project baru.`
  );
}

export default {
  async fetch(request, env, ctx) {
    // Inject KV binding global
    globalThis.WORKER_KV = env.WORKER_KV;

    if (request.method === "POST") {
      const update = await request.json();
      ctx.waitUntil(handleUpdate(update));
      return new Response("OK", { status: 200 });
    }

    // Set webhook otomatis via GET /?setup=1
    const url = new URL(request.url);
    if (url.searchParams.get("setup") === "1") {
      const workerUrl = url.origin;
      const res = await fetch(
        `${TELEGRAM_API}/setWebhook?url=${workerUrl}`,
        { method: "GET" }
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Bot Worker Running", { status: 200 });
  },
};
