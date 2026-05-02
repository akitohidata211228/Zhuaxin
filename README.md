<div align="center">

<img src="https://i.top4top.io/p_3774kf96h0.jpg" alt="Zhuaxin MD" width="300" style="border-radius: 16px"/>

# 🤖 Zhuaxin MD

> Bot WhatsApp modern berbasis **Baileys** | ESM | Node.js 21 | Pairing Code

**Developer:** Akito Hidata / Taufik

[![Node.js](https://img.shields.io/badge/Node.js-21.x-green?style=flat-square&logo=node.js)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-@itsliaaa%2Fbaileys-blue?style=flat-square)](https://github.com/itsliaaa/baileys)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](#-license)

</div>

---

## 📖 Tentang Bot

**Zhuaxin MD** adalah bot WhatsApp yang dibangun di atas library **@itsliaaa/baileys** — fork aktif dari Baileys yang mendukung koneksi WA Web terbaru. Bot ini dirancang dengan arsitektur plugin modular, hot-reload otomatis, dan siap deploy di **Pterodactyl Panel**.

Fitur utama:
- ⚡ **Hot-reload** — tambah/hapus/edit plugin tanpa restart bot, termasuk dari Pterodactyl File Manager & SFTP
- 🔌 **Sistem plugin** — setiap fitur adalah file JS terpisah di `plugins/`
- 🔐 **Whitelist** — kontrol siapa yang boleh pakai bot
- 🛡️ **Antilink** — hapus link grup WhatsApp otomatis
- 📡 **Channel WA** — kirim konten langsung ke channel WhatsApp

---

## 📁 Struktur Folder

```
zhuaxin-md/
├── index.js                  ← Entry point
├── config.js                 ← Konfigurasi bot
├── package.json
├── lib/
│   ├── connection.js         ← Connection & reconnect manager
│   ├── handler.js            ← Command router & whitelist check
│   ├── loader.js             ← Auto plugin loader + hot-reload watcher
│   ├── logger.js             ← Logger berwarna
│   ├── pairing.js            ← Pairing code handler
│   ├── utils.js              ← Helper utilities
│   ├── antilinkMiddleware.js ← Middleware antilink
│   ├── antilinkState.js      ← State antilink per grup
│   ├── groupBlacklist.js     ← Blacklist grup dari command bot
│   └── whitelist.js          ← State & logika whitelist
├── plugins/                  ← Folder plugin command (hot-reload)
├── data/                     ← Data persistensi (JSON)
│   ├── whitelist.json
│   ├── antilink-database.json
│   └── group-blacklist.json
└── sessions/                 ← Auto-generated saat login
```

---

## 🚀 Deploy ke Pterodactyl

### 1. Upload semua file ke server
Kecuali `node_modules/` dan `sessions/`

### 2. Pterodactyl Panel settings
- **Startup Command**: `npm start`
- **Node.js version**: `21.x`

### 3. Install dependencies via Console
```bash
npm install
```

### 4. Edit config sebelum start
```js
// config.js
ownerNumber: ['628xxxxxxxxxx'],  // Nomor owner (tanpa +)
prefix: '.',                     // Prefix command
botName: 'Zhuaxin MD',
```

### 5. Klik Start di Pterodactyl

---

## 🔐 Cara Pairing

1. Saat pertama start, bot meminta nomor HP owner
2. Masukkan format `628xxx` (tanpa `+`)
3. Bot tampilkan **Pairing Code** di console
4. Buka WhatsApp → **Settings → Linked Devices → Link a Device**
5. Pilih **Link with Phone Number** → masukkan kode
6. Bot otomatis connect ✅

> ⏰ **Timeout:** Jika dalam 3 menit pairing gagal, session otomatis dihapus dan server stop. Restart untuk coba ulang.

---

## 🎛️ Fitur & Command

### 👑 Owner

| Command | Alias | Deskripsi |
|---------|-------|-----------|
| `.broadcast` | `.bc` | Kirim pesan ke semua grup |
| `.restart` | — | Restart bot |
| `.shutdown` | `.matiin` | Matikan bot |
| `.runtime` | `.uptime` | Cek uptime bot |
| `.join` | — | Gabung grup via link |
| `.leave` | `.keluar` | Bot keluar dari grup ini |
| `.whitelist` | `.wl`, `.trusted` | Manajemen whitelist user |
| `.backup` | `.bkp` | Backup bot ke GitHub atau kirim file ke chat |
| `.gcbl` | — | Blacklist grup (bot diam, antilink tetap jalan) |
| `.pluginadd` | `.addplugin` | Tambah plugin baru via reply kode JS |
| `.plugindel` | `.delplugin`, `.rmplugin` | Hapus plugin |
| `.pluginget` | `.getplugin`, `.catplugin` | Lihat kode plugin |
| `.pluginlist` | `.listplugin`, `.plugins` | Daftar semua plugin terpasang |
| `.install` | `.npminstall`, `.pkg` | Install npm package dari chat |
| `.swpenonton` | `.swviewer` | Cek jumlah penonton status WA |

### 📊 Status WhatsApp (Owner)

| Command | Alias | Deskripsi |
|---------|-------|-----------|
| `.swfoto` | `.swimage`, `.swgambar` | Upload status foto |
| `.swvideo` | `.upswvideo`, `.swvid` | Upload status video |
| `.swaudio` | `.upswaudio`, `.swmp3` | Upload status audio |
| `.swvn` | `.swvoice`, `.swvoicenote` | Upload status voice note |
| `.swprivacy` | `.swsetting` | Kelola privasi status WA |

### 📥 Download

| Command | Alias | Deskripsi |
|---------|-------|-----------|
| `.play` | `.musik`, `.mp3`, `.yt` | Cari & download lagu/video YouTube |
| `.playch` | `.playc`, `.musikch` | Kirim lagu YouTube ke Channel WA (owner) |

### 🖼️ Sticker

| Command | Alias | Deskripsi |
|---------|-------|-----------|
| `.sticker` | `.stiker`, `.s` | Ubah gambar/video jadi sticker |
| `.smeme` | `.memesticker`, `.memes` | Buat sticker meme (reply gambar + caption `top\|bottom`) |
| `.brat` | — | Buat sticker brat style |
| `.bratcewek` | `.cewekbrat`, `.bratgirl` | Buat sticker brat cewek |
| `.bratvid` | `.bratgif`, `.bratvideo` | Buat sticker brat animated |

### 👥 Grup

| Command | Alias | Deskripsi |
|---------|-------|-----------|
| `.antilink` | — | Kelola fitur anti-link grup WA |
| `.tagall` | `.everyone`, `.all` | Tag semua member grup |
| `.crucio` | — | Kick member (reply/mention/nomor) |

### ℹ️ Info

| Command | Alias | Deskripsi |
|---------|-------|-----------|
| `.menu` | `.help`, `.start` | Tampilkan daftar semua command |
| `.info` | `.botinfo`, `.about` | Informasi bot |
| `.ping` | `.speed` | Cek kecepatan response bot |

### 🛠️ Tools

| Command | Alias | Deskripsi |
|---------|-------|-----------|
| `.say` | `.echo` | Bot mengulang pesan yang kamu kirim |

---

## 🔐 Whitelist

Whitelist mengontrol siapa yang boleh menggunakan bot.

```
.wl on          — aktifkan whitelist (hanya yang terdaftar bisa pakai bot)
.wl off         — nonaktifkan whitelist (semua orang bisa pakai)
.wl add 628xxx  — tambah nomor ke whitelist
.wl del 628xxx  — hapus nomor dari whitelist
.wl list        — lihat daftar whitelist
```

> Owner dan nomor bot sendiri selalu bisa pakai semua fitur tanpa perlu di-whitelist.

---

## 🛡️ Antilink

Hapus otomatis pesan yang mengandung link grup WhatsApp.

```
.antilink on     — aktifkan antilink di grup ini
.antilink off    — nonaktifkan antilink
.antilink status — cek status antilink
```

---

## 🚫 Group Blacklist

Bot tidak respon command apapun di grup blacklist, tapi **antilink tetap aktif**.

```
.gcbl add   — blacklist grup ini (kirim dari dalam grup)
.gcbl del   — hapus dari blacklist
.gcbl list  — lihat daftar blacklist
```

---

## 💾 Backup

```
.backup        — backup ke GitHub (config & data dikosongkan)
.backup file   — kirim semua file ke chat owner (config FULL, data dikosongkan)
```

---

## ➕ Cara Tambah Plugin

Buat file baru di `plugins/`, contoh `plugins/hello.js`:

```js
const handler = async (ctx) => {
  const { reply, sender, prefix } = ctx
  await reply(`Halo! Kamu adalah ${sender}`)
}

handler.pluginName  = 'hello'
handler.description = 'Ucapan halo kepada user'
handler.command     = ['hello', 'hai', 'halo']
handler.category    = ['tools']

export default handler
```

Plugin otomatis aktif dalam ~1 detik tanpa restart. Hot-reload bekerja dari **chat bot**, **Pterodactyl File Manager**, maupun **SFTP**.

---

## 📦 Context Object (ctx)

| Property | Type | Keterangan |
|----------|------|------------|
| `sock` | object | Baileys socket |
| `msg` | object | Message object mentah dari Baileys |
| `jid` | string | JID chat (grup atau private) |
| `sender` | string | JID pengirim pesan |
| `isGroup` | boolean | Apakah pesan dari grup |
| `isOwner` | boolean | Apakah sender adalah owner |
| `command` | string | Command yang dipanggil |
| `args` | string[] | Argumen setelah command |
| `text` | string | Argumen gabungan (`args.join(' ')`) |
| `fullText` | string | Teks lengkap setelah prefix |
| `prefix` | string | Prefix aktif dari config |
| `reply(text)` | function | Balas pesan dengan teks |
| `react(emoji)` | function | React ke pesan dengan emoji |

---

## ⚙️ Konfigurasi (config.js)

| Key | Default | Keterangan |
|-----|---------|------------|
| `prefix` | `.` | Prefix command |
| `ownerNumber` | `['628xxx']` | Nomor owner (array) |
| `botName` | `Zhuaxin MD` | Nama bot |
| `sessionDir` | `./sessions` | Folder session |
| `pairingTimeout` | `180000` | Timeout pairing (ms) |
| `maxReconnectAttempts` | `5` | Max percobaan reconnect |
| `reconnectDelay` | `5000` | Jeda antar reconnect (ms) |
| `logLevel` | `silent` | Level log Baileys |
| `githubToken` | `''` | Token GitHub untuk backup |
| `githubUser` | `''` | Username GitHub |
| `githubRepo` | `''` | Nama repo GitHub |
| `channelId` | `''` | JID Channel WA untuk playch |

---

## 📝 License

MIT — Free to use and modify.

---

<div align="center">
  <sub>Made with ❤️ by <strong>Akito Hidata / Taufik</strong></sub>
</div>
