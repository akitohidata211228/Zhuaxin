// ═══════════════════════════════════════════════════════════════
//  plugins/autoai.js — AI Chatbot terintegrasi dengan plugin bot
//
//  Command:
//    .ai on/off         → aktifkan/matikan autoai di grup (admin/owner)
//    .ai status         → lihat status
//    .ai <teks>         → chat langsung tanpa perlu autoai on
//
//  Auto-trigger (perlu .ai on dulu):
//    Zhuaxin <pesan>    → bot respon otomatis
//
//  Intent terintegrasi:
//    cariin lagu ...    → eksekusi .play
//    buat sticker       → eksekusi .sticker (perlu reply gambar)
//    buat brat ...      → eksekusi .brat
//    tag semua          → eksekusi .tagall
//    ping               → eksekusi .ping
//
//  Butuh: GROQ_API_KEY di config.js → groqApiKey: 'gsk_xxx'
// ═══════════════════════════════════════════════════════════════

import config   from '../config.js'
import fetch    from 'node-fetch'
import fs       from 'node:fs'
import path     from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const STATE_PATH = path.join(__dirname, '../data/autoai-state.json')

// ─── Groq config ──────────────────────────────────────────────
const GROQ_API_KEY = config.groqApiKey || process.env.GROQ_API_KEY || ''
const GROQ_MODEL   = 'llama-3.3-70b-versatile'
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions'
const BOT_NAME     = config.botName || 'Zhuaxin'

// ─── Nama trigger yang dikenali ───────────────────────────────
const TRIGGER_NAMES = [BOT_NAME.toLowerCase(), 'bot', 'ai']

// ─── State persist: grup yang autoai aktif ────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      const arr = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'))
      return new Set(Array.isArray(arr) ? arr : [])
    }
  } catch {}
  return new Set()
}

function saveState(set) {
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
    fs.writeFileSync(STATE_PATH, JSON.stringify([...set]), 'utf-8')
  } catch {}
}

const activeGroups = loadState()

// ─── Chat history per sender (max 10 turn, TTL 30 menit) ──────
const historyMap  = new Map()
const HISTORY_TTL = 30 * 60 * 1000

function getHistory(sender) {
  const e = historyMap.get(sender)
  if (!e || Date.now() - e.ts > HISTORY_TTL) {
    historyMap.delete(sender)
    return []
  }
  return e.msgs
}

function addHistory(sender, role, content) {
  let e = historyMap.get(sender)
  if (!e || Date.now() - e.ts > HISTORY_TTL) e = { msgs: [], ts: Date.now() }
  e.msgs.push({ role, content })
  if (e.msgs.length > 20) e.msgs = e.msgs.slice(-20)
  e.ts = Date.now()
  historyMap.set(sender, e)
}

// ─── Groq call ────────────────────────────────────────────────
const SYSTEM_PROMPT = `Kamu adalah ${BOT_NAME}, asisten WhatsApp yang cerdas, ramah, dan gaul. Jawab dalam bahasa Indonesia yang santai. Gunakan emoji yang relevan. Jawaban singkat 2-3 kalimat kecuali diminta panjang. Jangan bilang kamu AI dari Groq/Meta/OpenAI — kamu adalah ${BOT_NAME}.`

async function callGroq(sender, userText) {
  if (!GROQ_API_KEY) throw new Error('groqApiKey belum diset di config.js')

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...getHistory(sender),
    { role: 'user', content: userText },
  ]

  const res = await fetch(GROQ_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body:    JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 512, temperature: 0.8 }),
  })

  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 150)}`)

  const data  = await res.json()
  const reply = data.choices?.[0]?.message?.content?.trim() || '...'

  addHistory(sender, 'user', userText)
  addHistory(sender, 'assistant', reply)
  return reply
}

// ─── Intent detection ─────────────────────────────────────────
const INTENTS = [
  {
    name: 'play',
    test: (t) => /(?:cariin?|puterin?|play|putar|download|dl)\s*(?:lagu|musik|song|audio)?/i.test(t),
    extract: (t) => {
      const m = t.match(/(?:cariin?|puterin?|play|putar|download|dl)\s*(?:lagu|musik|song|audio)?\s*(.+)/i)
      return m?.[1]?.trim() || null
    },
  },
  {
    name: 'sticker',
    test: (t) => /(?:buat|jadiin?|convert|ubah)\s*stik?er|^stik?er$/i.test(t),
    extract: () => null,
  },
  {
    name: 'brat',
    test: (t) => /\bbrat\b/i.test(t),
    extract: (t) => {
      const m = t.match(/brat\s+(.+)/i)
      return m?.[1]?.trim() || null
    },
  },
  {
    name: 'tagall',
    test: (t) => /(?:tag|mention|panggil)\s*(?:semua|all|everyone)|tagall/i.test(t),
    extract: () => null,
  },
  {
    name: 'ping',
    test: (t) => /\b(?:ping|cek\s*bot|test\s*bot)\b/i.test(t),
    extract: () => null,
  },
]

function detectIntent(text) {
  return INTENTS.find(i => i.test(text)) || null
}

// ─── Ekstrak teks setelah nama bot ────────────────────────────
function extractAfterBotName(text) {
  const t = text.trim()
  for (const name of TRIGGER_NAMES) {
    const re = new RegExp(`^${name}[,\\s]+(.+)`, 'i')
    const m  = t.match(re)
    if (m) return m[1].trim()
  }
  return null
}

// ─── Jalankan intent → plugin ─────────────────────────────────
async function runIntent(intent, inputText, ctx) {
  const { msg, reply } = ctx
  const commandMap = global.__commandMap

  if (!commandMap) return false

  switch (intent.name) {
    case 'play': {
      const query = intent.extract(inputText)
      if (!query) { await reply('🎵 Mau dengerin lagu apa?'); return true }
      const h = commandMap.get('play')
      if (!h) { await reply('❌ Plugin play tidak tersedia'); return true }
      await h({ ...ctx, args: query.split(' '), text: query, fullText: query })
      return true
    }
    case 'sticker': {
      const hasMedia =
        msg.message?.imageMessage ||
        msg.message?.videoMessage ||
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage
      if (!hasMedia) { await reply('🖼️ Reply gambar/video dulu ya biar aku jadiin sticker!'); return true }
      const h = commandMap.get('sticker')
      if (!h) { await reply('❌ Plugin sticker tidak tersedia'); return true }
      await h({ ...ctx, args: [], text: '' })
      return true
    }
    case 'brat': {
      const bratText = intent.extract(inputText)
      if (!bratText) { await reply('😈 Tulis teksnya juga ya, contoh: _Zhuaxin brat hidup santuy_'); return true }
      const h = commandMap.get('brat')
      if (!h) { await reply('❌ Plugin brat tidak tersedia'); return true }
      await h({ ...ctx, args: bratText.split(' '), text: bratText, fullText: bratText })
      return true
    }
    case 'tagall': {
      const h = commandMap.get('tagall')
      if (!h) { await reply('❌ Plugin tagall tidak tersedia'); return true }
      await h({ ...ctx, args: [], text: '' })
      return true
    }
    case 'ping': {
      const h = commandMap.get('ping')
      if (!h) { await reply('❌ Plugin ping tidak tersedia'); return true }
      await h({ ...ctx, args: [], text: '' })
      return true
    }
  }
  return false
}

// ─── Core: proses teks → intent atau AI ───────────────────────
async function processAI(inputText, ctx) {
  const { sock, msg, jid, sender, reply, react } = ctx

  const intent = detectIntent(inputText)
  if (intent) {
    try {
      const handled = await runIntent(intent, inputText, ctx)
      if (handled) return
    } catch (e) {
      console.error('[autoai] intent error:', e.message)
      // fallthrough ke AI
    }
  }

  // Chat AI biasa
  await react('🤔')
  try {
    const aiReply = await callGroq(sender, inputText)
    await sock.sendMessage(jid, { text: aiReply }, { quoted: msg })
    await react('✅')
  } catch (e) {
    await react('❌')
    await reply(`❌ AI error: ${e.message}`)
  }
}

// ─── Handler (.ai command) ─────────────────────────────────────
const handler = async (ctx) => {
  const { sock, jid, sender, isGroup, isOwner, reply, args } = ctx

  const sub = (args[0] || '').toLowerCase()

  // ── .ai on/off ──
  if (isGroup && (sub === 'on' || sub === 'off')) {
    if (!isOwner) {
      try {
        const meta    = await sock.groupMetadata(jid)
        const sNum    = sender.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
        const isAdmin = meta.participants.some(p => {
          const pNum = p.id.split(':')[0].split('@')[0].replace(/[^0-9]/g, '')
          return pNum === sNum && (p.admin === 'admin' || p.admin === 'superadmin')
        })
        if (!isAdmin) return reply('⛔ Hanya admin grup atau owner bot')
      } catch { return reply('❌ Gagal cek admin') }
    }

    let gName = jid
    try { gName = (await sock.groupMetadata(jid)).subject } catch {}

    if (sub === 'on') {
      activeGroups.add(jid)
      saveState(activeGroups)
      return reply(
        `🤖 *AutoAI aktif di ${gName}!*\n\n` +
        `Panggil aku: *${BOT_NAME} <pesan>*\n\n` +
        `Contoh:\n• _${BOT_NAME} cariin lagu Hindia_\n• _${BOT_NAME} buat sticker_ (reply gambar)\n• _${BOT_NAME} halo apa kabar_`
      )
    } else {
      activeGroups.delete(jid)
      saveState(activeGroups)
      return reply(`🤖 *AutoAI dimatikan di ${gName}.*`)
    }
  }

  // ── .ai status ──
  if (sub === 'status') {
    const on = isGroup ? activeGroups.has(jid) : false
    return reply(
      `🤖 *AutoAI Status*\n\n` +
      `Grup ini: ${on ? '✅ Aktif' : '❌ Mati'}\n\n` +
      `*.ai on*  → aktifkan\n*.ai off* → matikan`
    )
  }

  // ── .ai <teks> — chat langsung ──
  const question = args.join(' ').trim()
  if (!question) {
    return reply(
      `🤖 *${BOT_NAME} AI*\n\n` +
      `*.ai <pesan>*      → chat langsung\n` +
      `*.ai on/off*       → toggle autoai di grup\n` +
      `*.ai status*       → lihat status\n\n` +
      `_Auto-trigger: ketik "${BOT_NAME} <pesan>" di grup yang sudah *.ai on*_`
    )
  }

  await processAI(question, ctx)
}

handler.pluginName         = 'autoai'
handler.description        = 'AI chatbot terintegrasi plugin (Groq)'
handler.command            = ['ai', 'autoai']
handler.category           = ['ai']

// Untuk handleAutoTrigger di handler.js
handler.autoTrigger        = true
handler.activeGroups       = activeGroups
handler.processAI          = processAI
handler.extractAfterBotName = extractAfterBotName

export default handler
