# 🤖 WaBot — WhatsApp Bot Production Ready

> Base bot WhatsApp modern menggunakan `@itsliaaa/baileys` | ESM | Node.js 21 | Pairing Code

---

## 📁 Struktur Folder

```
wabot/
├── index.js              ← Entry point
├── config.js             ← Konfigurasi bot
├── package.json
├── lib/
│   ├── connection.js     ← Connection & reconnect manager
│   ├── handler.js        ← Command router
│   ├── loader.js         ← Auto plugin loader
│   ├── logger.js         ← Logger berwarna
│   ├── pairing.js        ← Pairing code handler
│   └── utils.js          ← Helper utilities
├── plugins/              ← Folder plugin command
│   ├── menu.js
│   ├── ping.js
│   ├── info.js
│   ├── say.js
│   ├── sticker.js
│   ├── tagall.js
│   └── owner.js
└── sessions/             ← Auto-generated saat login
```

---

## 🚀 Deploy ke Pterodactyl

### 1. Upload semua file ke server (kecuali `node_modules/` dan `sessions/`)

### 2. Di Pterodactyl Panel:
- **Startup Command**: `npm start`
- **Node.js version**: `21.x`

### 3. Install dependencies dulu via Console:
```bash
npm install
```

### 4. Edit config sebelum start:
```js
// config.js
ownerNumber: ['628xxxxxxxxxx'],  // Ganti nomor kamu
prefix: '!',
```

### 5. Klik **Start** di Pterodactyl

---

## 🔐 Cara Pairing

1. Saat pertama kali start, bot akan meminta nomor HP owner
2. Masukkan nomor format `628xxx` (tanpa `+`)
3. Bot akan menampilkan **Pairing Code** di console
4. Buka WhatsApp → Settings → Linked Devices → Link a Device
5. Pilih **Link with Phone Number** → masukkan kode
6. Bot akan otomatis connect ✅

### ⏰ Timeout Pairing
- Jika dalam **3 menit** pairing tidak berhasil:
  - Session otomatis dihapus
  - Bot berhenti dengan sendirinya
  - Server Pterodactyl otomatis stop
  - Restart untuk coba ulang

---

## ➕ Cara Tambah Plugin

Buat file baru di folder `plugins/`, contoh `plugins/hello.js`:

```js
const handler = async (ctx) => {
  const { reply, sender, isOwner } = ctx

  await reply(`Halo! Kamu adalah ${sender}`)
}

handler.pluginName = 'hello'
handler.description = 'Ucapan halo kepada user'
handler.command = ['hello', 'hai', 'halo']
handler.category = ['tools']

export default handler
```

Plugin otomatis terload saat bot start. **Tidak perlu edit file lain.**

---

## 📦 Context Object (ctx) di Plugin

| Property | Type | Keterangan |
|----------|------|------------|
| `sock` | object | Baileys socket (akses semua fungsi Baileys) |
| `msg` | object | Message object mentah dari Baileys |
| `jid` | string | JID chat (grup atau private) |
| `sender` | string | JID pengirim pesan |
| `isGroup` | boolean | Apakah pesan dari grup |
| `command` | string | Command yang dipanggil |
| `args` | string[] | Argumen setelah command |
| `text` | string | Argumen gabungan (args.join(' ')) |
| `fullText` | string | Teks lengkap setelah prefix |
| `isOwner` | boolean | Apakah sender adalah owner |
| `reply(text)` | function | Balas pesan dengan teks |
| `react(emoji)` | function | React ke pesan dengan emoji |

---

## ⚙️ Konfigurasi (config.js)

| Key | Default | Keterangan |
|-----|---------|------------|
| `prefix` | `!` | Prefix command |
| `ownerNumber` | `['628xxx']` | Nomor owner (array) |
| `botName` | `WaBot` | Nama bot |
| `sessionDir` | `./sessions` | Folder session |
| `pairingTimeout` | `180000` | Timeout pairing (ms) |
| `maxReconnectAttempts` | `5` | Max percobaan reconnect |
| `reconnectDelay` | `5000` | Jeda antar reconnect (ms) |
| `logLevel` | `silent` | Level log Baileys |

---

## 📝 License

MIT — Free to use and modify.
