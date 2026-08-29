# ☠️ XOW TELEGRAM BOT BUILDER ☠️

Bot Telegram + Cloudflare Worker untuk trigger build APK via GitHub Actions.

---

## 📦 **Fitur**
- **/build** – Memicu build APK dari repository GitHub.
- **/status** – Menampilkan status build terakhir.
- **/download** – Panduan cara mengunduh APK hasil build.
- **/start** – Menampilkan menu bantuan.

---

## 🚀 **Cara Deploy & Setup**

### 1. **Persiapan Akun & Token**
- **Akun Cloudflare** (untuk Workers).
- **Akun GitHub** dengan repository `MoanzGuy/Bot-Build-Moan`.
- **Bot Telegram** (dapatkan token dari [@BotFather](https://t.me/BotFather)).
- **GitHub Personal Access Token** (classic atau fine-grained) dengan izin:
  - `repo` (full control)
  - `workflow` (untuk trigger Actions)
- Pastikan token memiliki akses ke repository `MoanzGuy/Bot-Build-Moan`.

---

### 2. **Buat & Deploy Cloudflare Worker**
1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Buat Worker**.
2. Nama worker bebas (contoh: `xow-bot-builder`).
3. Salin seluruh kode `worker.js` (ada di repository ini) dan paste di editor.
4. **Set Environment Variables** (tab **Settings** → **Variables**):

| Nama Variabel | Nilai |
| :--- | :--- |
| `BOT_TOKEN` | Token bot Telegram Anda |
| `GITHUB_TOKEN` | Token GitHub Anda |
| `REPO` | `MoanzGuy/Bot-Build-Moan` |

5. Klik **Save and Deploy**.

---

### 3. **Atur Webhook Telegram**
Ganti `NAMA_WORKER_ANDA` dengan nama worker yang Anda buat, lalu buka URL berikut di browser:
