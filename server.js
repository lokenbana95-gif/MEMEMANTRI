require("dotenv").config();
const path = require("node:path");
const http = require("node:http");
const express = require("express");
const { Server } = require("socket.io");
const fs = require("node:fs");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");
const GLOBAL_SEED = require("./global-seed");

/* CORS allowlist: set ALLOWED_ORIGIN to a comma-separated list of origins
   in production (e.g. "https://mememantri.com,https://www.mememantri.com").
   With no Origin header (same-origin requests, curl, server-to-server) we
   always allow. With no ALLOWED_ORIGIN configured we allow everything
   ONLY outside production, so local/dev testing keeps working without
   extra setup — production deployments should always set this env var. */
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
function corsOriginCheck(origin, callback) {
  if (!origin) return callback(null, true);
  if (!ALLOWED_ORIGINS.length)
    return callback(null, process.env.NODE_ENV !== "production");
  return callback(null, ALLOWED_ORIGINS.includes(origin));
}

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginCheck,
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 16 * 1024,
});
const PORT = Number(process.env.PORT || 3000);
const METERED_DOMAIN = process.env.METERED_DOMAIN || "";
const METERED_SECRET_KEY = process.env.METERED_SECRET_KEY || "";
const TURN_CACHE_TTL_MS = 55 * 60 * 1000; // Metered credentials are valid ~1hr; refresh a bit early
let turnCredentialsCache = null;
let turnCredentialsFetchedAt = 0;
async function getTurnCredentials() {
  if (!METERED_DOMAIN || !METERED_SECRET_KEY) return null;
  const now = Date.now();
  if (
    turnCredentialsCache &&
    now - turnCredentialsFetchedAt < TURN_CACHE_TTL_MS
  )
    return turnCredentialsCache;
  try {
    const response = await fetch(
      `https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_SECRET_KEY}`,
    );
    if (!response.ok)
      throw new Error(`Metered API responded ${response.status}`);
    const iceServers = await response.json();
    turnCredentialsCache = iceServers;
    turnCredentialsFetchedAt = now;
    return iceServers;
  } catch (error) {
    console.error("Failed to fetch TURN credentials:", error.message);
    return turnCredentialsCache; // serve stale cache rather than fail the call if we have one
  }
}
const BATTLE_DB_PATH =
  process.env.BATTLE_DB_PATH || path.join(__dirname, "data", "voice-mantri.db");
fs.mkdirSync(path.dirname(BATTLE_DB_PATH), { recursive: true });
const db = new Database(BATTLE_DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS voice_contests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'open',
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    settled_at INTEGER,
    winner_submission_id INTEGER,
    winner_author TEXT,
    winner_title TEXT,
    winner_votes INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS voice_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contest_id INTEGER NOT NULL,
    slot TEXT NOT NULL CHECK(slot IN ('A', 'B')),
    owner_token TEXT NOT NULL,
    author TEXT NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    votes INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    UNIQUE(contest_id, slot)
  );
  CREATE TABLE IF NOT EXISTS voice_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contest_id INTEGER NOT NULL,
    submission_id INTEGER NOT NULL,
    voter_token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(contest_id, voter_token)
  );
  CREATE TABLE IF NOT EXISTS ministries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🏛',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS ticker_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS memes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    creator TEXT NOT NULL,
    text TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    plays INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    radio_enabled INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'published',
    source TEXT NOT NULL DEFAULT 'admin',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saved_memes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meme_id INTEGER NOT NULL,
    profile_token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(meme_id, profile_token)
  );
  CREATE TABLE IF NOT EXISTS petitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    creator TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    review_note TEXT
  );
  CREATE TABLE IF NOT EXISTS banned_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS ip_bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'moderator',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    token TEXT PRIMARY KEY,
    nickname TEXT NOT NULL DEFAULT 'Meme Citizen',
    avatar TEXT NOT NULL DEFAULT '😎',
    points INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 1,
    longest_streak INTEGER NOT NULL DEFAULT 1,
    last_seen_day TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profile_follows (
    profile_token TEXT NOT NULL,
    ministry_key TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (profile_token, ministry_key)
  );
  CREATE TABLE IF NOT EXISTS meme_likes (
    meme_id INTEGER NOT NULL,
    profile_token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (meme_id, profile_token)
  );
  CREATE TABLE IF NOT EXISTS meme_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meme_id INTEGER NOT NULL,
    profile_token TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meme_court_votes (
    meme_id INTEGER NOT NULL,
    profile_token TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK(verdict IN ('guilty', 'not_funny', 'needs_punchline')),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (meme_id, profile_token)
  );
  CREATE TABLE IF NOT EXISTS referral_visits (
    referrer_token TEXT NOT NULL,
    visitor_token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (referrer_token, visitor_token)
  );
`);
try {
  db.exec("ALTER TABLE petitions ADD COLUMN creator_token TEXT");
} catch {}
function ensureColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn("memes", "scope", "TEXT NOT NULL DEFAULT 'local'");
ensureColumn("memes", "country", "TEXT NOT NULL DEFAULT ''");
ensureColumn("memes", "continent", "TEXT NOT NULL DEFAULT ''");
ensureColumn("memes", "language", "TEXT NOT NULL DEFAULT 'english'");
ensureColumn("memes", "petition_id", "INTEGER");
db.exec(`UPDATE memes SET petition_id = (SELECT p.id FROM petitions p WHERE p.status = 'approved' AND p.title = memes.title AND p.text = memes.text AND p.creator = memes.creator ORDER BY p.reviewed_at DESC LIMIT 1) WHERE source = 'petition' AND petition_id IS NULL`);
ensureColumn("petitions", "scope", "TEXT NOT NULL DEFAULT 'local'");
ensureColumn("petitions", "country", "TEXT NOT NULL DEFAULT ''");
ensureColumn("petitions", "continent", "TEXT NOT NULL DEFAULT ''");
ensureColumn("petitions", "language", "TEXT NOT NULL DEFAULT 'hinglish'");
ensureColumn("profiles", "favourite_department_override", "TEXT NOT NULL DEFAULT ''");
// adda_reports is created immediately below with the detail column included;
// do not run ALTER TABLE before the table exists on a fresh database.
db.exec(`CREATE TABLE IF NOT EXISTS meme_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, meme_id INTEGER NOT NULL, profile_token TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(meme_id, profile_token))`);
/* Two-tier IP moderation: a "warning" still allows full access to the site,
   it just tells the visitor their behaviour is on record. Enough strikes
   (or a manual admin action) escalates the IP into ip_bans, which is a
   hard block enforced on both HTTP writes and the realtime chat socket. */
db.exec(`
  CREATE TABLE IF NOT EXISTS ip_warnings (
    ip TEXT PRIMARY KEY,
    reason TEXT,
    strikes INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS adda_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_token TEXT NOT NULL,
    reported_token TEXT,
    reported_ip TEXT,
    reason TEXT NOT NULL,
    detail TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS adda_blocks (
    blocker_token TEXT NOT NULL,
    blocked_token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (blocker_token, blocked_token)
  );
`);

/* ---------------------------------------------------------------------
   Seed default content (only runs once — when tables are empty) so the
   public site keeps showing content even before an admin logs in.
   --------------------------------------------------------------------- */
const DEFAULT_MINISTRIES = [
  ["hindi", "हिंदी मीम्स", "🕉️"],
  ["desi", "Desi India", "🇮🇳"],
  ["bollywood", "Bollywood", "🎬"],
  ["cricket", "Cricket", "🏏"],
  ["politics", "Indian Politics", "🏛"],
  ["student", "Student Life", "🎓"],
  ["funny", "Funny India", "😂"],
  ["trending", "Trending India", "🔥"],
  ["genz", "Desi Gen Z", "🧠"],
  ["tech", "Indian Tech", "💻"],
  ["science", "Science India", "📚"],
  ["gaming", "Indian Gaming", "🎮"],
  ["love", "Desi Relationships", "💘"],
];
const DEFAULT_TICKER = [
  "BREAKING: Local student opens book after 6 months",
  "EXCLUSIVE: Chai declared official debugging tool",
  "LIVE: Meme Parliament passes bill for shorter syllabus",
  "ALERT: Desi uncle forwards 47 good-morning memes",
  "BREAKING: Indian WiFi router receives family blessings in twelve languages",
];
const DEFAULT_MEMES = [
  [
    "Breaking: Student Opens Book",
    "student",
    "@sarkari_savage",
    "Breaking news! A local engineering student has opened a textbook for the first time in six months. Scientists say the dust cloud was visible from space.",
  ],
  [
    "Chai Over Everything",
    "desi",
    "@chaiwala_coder",
    "Indian problem-solving flowchart. Step one: drink chai. Step two: discuss problem for two hours. Step three: drink more chai. Problem still unsolved, but friendship level maximum.",
  ],
  [
    "Last Over Panic",
    "cricket",
    "@gully_gavaskar",
    "Eighteen runs needed off six balls, and my heart is playing its own match. The bowler is nervous, the batsman is nervous, but my mother is calmly asking if I have eaten dinner.",
  ],
  [
    "It Works On My Machine",
    "tech",
    "@semicolon_sardar",
    "The developer said, it works on my machine. So the manager shipped the machine to production. And that, my friends, is how cloud computing was invented in India.",
  ],
  [
    "Manifesto Of Memes",
    "politics",
    "@meme_neta",
    "My fellow citizens! If elected, I promise free WiFi in every classroom, and mandatory nap time after lunch. Vote for me, and I shall make the syllabus fifty percent shorter!",
  ],
  [
    "Bollywood Slow Motion",
    "bollywood",
    "@filmy_frames",
    "He walks in slow motion. The wind blows. Three hundred goons attack. He removes his sunglasses. Physics resigns and leaves the theatre quietly.",
  ],
  [
    "Situationship Status",
    "love",
    "@delulu_dilse",
    "We are not dating. We are not friends. We are in a quantum state of a relationship. Observation collapses it into ignored messages.",
  ],
  [
    "One More Match",
    "gaming",
    "@noob_nawab",
    "It is two in the morning. He says just one more match. Six matches later, the sun rises, the rank drops, and the mother enters with the legendary slipper of judgement.",
  ],
  [
    "Physics Ka Pyaar",
    "science",
    "@lab_lafanga",
    "Newton's fourth law, discovered in India. Every action has an equal and opposite relative who compares your marks with the neighbour's child.",
  ],
  [
    "Aura Farming",
    "genz",
    "@vibecheck_vishal",
    "He did not study, he did not revise, he did not even bring a pen. He walked into the exam hall with pure vibes and left with pure trauma. Absolute aura, zero marks.",
  ],
  [
    "Uncle Ki Advice",
    "funny",
    "@whatsapp_university",
    "Beta, in our time we walked twenty kilometres to school, uphill, both directions, without shoes, and still topped the class. Also beta, please recharge my phone, I cannot find the button.",
  ],
  [
    "Trending On Every App",
    "trending",
    "@reel_rishi",
    "Today's trend is doing nothing productive, but filming it in cinematic mode with sad background music. Congratulations, you are now a content creator.",
  ],
  [
    "सोमवार का सन्नाटा",
    "hindi",
    "@dilli_ka_dimaag",
    "सोमवार सुबह अलार्म बजते ही शरीर कहता है, अभी नहीं, बस पांच मिनट और। दो घंटे बाद वही पांच मिनट, तब तक ऑफिस पहुंचने की सारी योजना बदल चुकी होती है।",
  ],
  [
    "मम्मी का सीसीटीवी",
    "hindi",
    "@ghar_ki_khabrein",
    "घर में मम्मी से बड़ा कोई जासूस नहीं होता। कमरे का दरवाज़ा बंद करते ही आवाज़ आती है, अंदर क्या कर रहे हो, दरवाज़ा क्यों बंद किया है?",
  ],
  [
    "परीक्षा से एक रात पहले",
    "hindi",
    "@topper_ki_tabahi",
    "परीक्षा से एक रात पहले अचानक कमरा साफ करने का मन करता है, अलमारी व्यवस्थित होती है, और पूरा सिलेबस एक ही रात में खत्म करने का हौसला अचानक जाग जाता है।",
  ],
  [
    "पड़ोसी का बेटा",
    "hindi",
    "@tulna_ka_tandav",
    "हर घर में एक काल्पनिक किरदार होता है, पड़ोसी का बेटा, जो हमेशा टॉप करता है, हमेशा समय पर सोता है, और कभी मोबाइल नहीं चलाता।",
  ],
  [
    "Mumbai Local Olympics",
    "desi",
    "@platform_pundit",
    "Mumbai local mein seat milna koi coincidence nahi, ye timing, strategy aur halka sa Olympic-level shoulder movement ka result hai.",
  ],
  [
    "Bengaluru Traffic Meditation",
    "desi",
    "@silicon_samosa",
    "Bengaluru traffic ne mujhe patience, podcast aur ek hi signal par teen naye life goals de diye.",
  ],
  [
    "Chennai Heat Mode",
    "desi",
    "@filtercoffee_fury",
    "Chennai ki garmi mein phone bhi bolta hai: bhai mujhe charge mat karo, main already 100 percent emotional hoon.",
  ],
  [
    "Kolkata Adda",
    "desi",
    "@adda_archivist",
    "Kolkata adda starts with one question and ends three hours later with politics, poetry, football and no final answer.",
  ],
  [
    "Punjabi Wedding Budget",
    "desi",
    "@dhol_department",
    "Punjabi wedding budget: 20 percent food, 10 percent venue, 70 percent proving that the DJ can hear us from the next district.",
  ],
];
const DEFAULT_SETTINGS = {
  site_title: "MemeMantri",
  site_tagline: "MemeMantri The Official Parliament of Indian Memes",
  motd_meme_id: "",
  maintenance_mode: "0",
  maintenance_message:
    "MemeMantri Sansad abhi thodi der ke liye band hai. Jald hi wapas aayenge!",
};
function seedIfEmpty() {
  const ministryCount = db
    .prepare("SELECT COUNT(*) AS c FROM ministries")
    .get().c;
  if (!ministryCount) {
    const insert = db.prepare(
      "INSERT INTO ministries (key, name, emoji, sort_order, active) VALUES (?, ?, ?, ?, 1)",
    );
    DEFAULT_MINISTRIES.forEach(([key, name, emoji], index) =>
      insert.run(key, name, emoji, index),
    );
  }
  const tickerCount = db
    .prepare("SELECT COUNT(*) AS c FROM ticker_items")
    .get().c;
  if (!tickerCount) {
    const insert = db.prepare(
      "INSERT INTO ticker_items (text, sort_order, active) VALUES (?, ?, 1)",
    );
    DEFAULT_TICKER.forEach((text, index) => insert.run(text, index));
  }
  const memeCount = db.prepare("SELECT COUNT(*) AS c FROM memes").get().c;
  if (!memeCount) {
    const now = Date.now();
    const insert = db.prepare(
      "INSERT INTO memes (title, category, creator, text, likes, plays, featured, radio_enabled, status, source, created_at) VALUES (?, ?, ?, ?, 0, 0, 0, 1, 'published', 'seed', ?)",
    );
    DEFAULT_MEMES.forEach(([title, category, creator, text], index) =>
      insert.run(title, category, creator, text, now - index),
    );
  }
  const globalCount = db.prepare("SELECT COUNT(*) AS c FROM memes WHERE scope = 'global'").get().c;
  if (!globalCount) {
    const insertGlobal = db.prepare("INSERT INTO memes (title, category, creator, text, likes, plays, featured, radio_enabled, status, source, created_at, scope, country, continent, language) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'published', 'global-seed', ?, 'global', ?, ?, ?)");
    const continentFor = (region) => ({ usa: "north-america", canada: "north-america", uk: "europe", france: "europe", europe: "europe", nordics: "europe", japan: "asia", korea: "asia", china: "asia", asia: "asia", africa: "africa", nigeria: "africa", latam: "south-america", brazil: "south-america", middleeast: "middle-east", turkey: "middle-east", global: "world" }[region] || "world");
    const countryFor = (region) => region === "global" ? "world" : region;
    const now = Date.now();
    GLOBAL_SEED.forEach((m, index) => insertGlobal.run(m.title, m.label, m.creator, m.text, m.likes || 0, m.plays || 0, index < 3 ? 1 : 0, now - index, countryFor(m.region), continentFor(m.region), /hindi|india|hi/i.test(m.text) ? "hinglish" : "english"));
  }
  const insertSetting = db.prepare(
    "INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)",
  );
  Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) =>
    insertSetting.run(key, value),
  );
}
seedIfEmpty();
const BATTLE_DAY_MS = 24 * 60 * 60 * 1000;
function createVoiceContest(now = Date.now()) {
  // A contest is created as a waiting shell. The 24-hour clock starts only
  // when the first valid participant submits a meme.
  const result = db
    .prepare(
      "INSERT INTO voice_contests (status, starts_at, ends_at, created_at) VALUES ('open', 0, 0, ?)",
    )
    .run(now);
  return result.lastInsertRowid;
}
function activateVoiceContest(contestId, now = Date.now()) {
  db.prepare("UPDATE voice_contests SET starts_at = ?, ends_at = ? WHERE id = ? AND status = 'open' AND starts_at = 0").run(now, now + BATTLE_DAY_MS, contestId);
  return openVoiceContest();
}
function resetEmptyExpiredContest(contest) {
  if (!contest) return contest;
  const count = db.prepare("SELECT COUNT(*) AS count FROM voice_submissions WHERE contest_id = ?").get(contest.id).count;
  // Repair legacy contests that started before the lazy-timer fix. Any open
  // contest with zero entries must never keep a running countdown.
  if (count === 0 && (contest.starts_at > 0 || contest.ends_at > 0)) {
    db.prepare("UPDATE voice_contests SET starts_at = 0, ends_at = 0 WHERE id = ? AND status = 'open'").run(contest.id);
    return openVoiceContest();
  }
  return contest;
}
function openVoiceContest() {
  return db
    .prepare(
      "SELECT * FROM voice_contests WHERE status = 'open' ORDER BY id DESC LIMIT 1",
    )
    .get();
}
function voiceMantriHistory() {
  return db
    .prepare(
      "SELECT id, winner_author AS author, winner_title AS title, winner_votes AS votes, settled_at FROM voice_contests WHERE status = 'settled' AND winner_submission_id IS NOT NULL ORDER BY settled_at DESC, id DESC",
    )
    .all();
}
function latestVoiceMantri() {
  return voiceMantriHistory()[0] || null;
}
function settleVoiceContest(contestId) {
  const contest = db
    .prepare("SELECT * FROM voice_contests WHERE id = ? AND status = 'open'")
    .get(contestId);
  if (!contest) return false;
  const entries = db
    .prepare(
      "SELECT * FROM voice_submissions WHERE contest_id = ? ORDER BY votes DESC, created_at ASC, id ASC",
    )
    .all(contestId);
  const winner = entries.length > 0 ? entries[0] : null;
  const now = Date.now();
  db.prepare(
    "UPDATE voice_contests SET status = 'settled', settled_at = ?, winner_submission_id = ?, winner_author = ?, winner_title = ?, winner_votes = ? WHERE id = ?",
  ).run(
    now,
    winner?.id || null,
    winner?.author || null,
    winner?.title || null,
    winner?.votes || 0,
    contestId,
  );
  return true;
}
/* One-time repair: earlier versions only saved a winner when a contest had
   exactly 2 submissions, so any contest settled with 1 submission (e.g. the
   2nd meme arrived after the 24-hour window and landed in a fresh contest)
   silently lost its history even though the raw submission was never
   deleted. Backfill those from voice_submissions so old VoiceMantris
   reappear after this fix is deployed. */
function backfillMissingVoiceHistory() {
  const broken = db
    .prepare(
      "SELECT id FROM voice_contests WHERE status = 'settled' AND winner_submission_id IS NULL",
    )
    .all();
  broken.forEach(({ id }) => {
    const entries = db
      .prepare(
        "SELECT * FROM voice_submissions WHERE contest_id = ? ORDER BY votes DESC, created_at ASC, id ASC",
      )
      .all(id);
    if (!entries.length) return;
    const winner = entries[0];
    db.prepare(
      "UPDATE voice_contests SET winner_submission_id = ?, winner_author = ?, winner_title = ?, winner_votes = ? WHERE id = ?",
    ).run(winner.id, winner.author, winner.title, winner.votes, id);
  });
}
backfillMissingVoiceHistory();
function ensureVoiceContest() {
  let contest = resetEmptyExpiredContest(openVoiceContest());
  if (contest && contest.ends_at > 0 && contest.ends_at <= Date.now()) {
    const count = db.prepare("SELECT COUNT(*) AS count FROM voice_submissions WHERE contest_id = ?").get(contest.id).count;
    if (count > 0) settleVoiceContest(contest.id);
    contest = null;
  }
  if (!contest) {
    createVoiceContest();
    contest = openVoiceContest();
  }
  return contest;
}
function voiceBattleState(socket) {
  const contest = ensureVoiceContest();
  const submissions = db
    .prepare(
      "SELECT id, slot, author, title, text, votes, created_at FROM voice_submissions WHERE contest_id = ? ORDER BY slot ASC",
    )
    .all(contest.id);
  const own = submissions.find((entry) =>
    db
      .prepare(
        "SELECT 1 FROM voice_submissions WHERE id = ? AND owner_token = ?",
      )
      .get(entry.id, socket.data.voiceBattleToken),
  );
  const voted = !!db
    .prepare(
      "SELECT 1 FROM voice_votes WHERE contest_id = ? AND voter_token = ?",
    )
    .get(contest.id, socket.data.voiceBattleToken);
  const history = voiceMantriHistory();
  return {
    contestId: contest.id,
    status: contest.status,
    startsAt: contest.starts_at > 0 ? contest.starts_at : null,
    endsAt: contest.ends_at > 0 ? contest.ends_at : null,
    submissions,
    viewerSubmissionId: own?.id || null,
    viewerVoted: voted,
    todayVoiceMantri: history[0] || null,
    retiredVoiceMantris: history.slice(1),
  };
}
function broadcastVoiceBattle(event = "battle:update") {
  io.sockets.sockets.forEach((client) =>
    client.emit(event, voiceBattleState(client)),
  );
}
function settleExpiredVoiceContest() {
  const contest = openVoiceContest();
  if (!contest || contest.ends_at <= 0 || contest.ends_at > Date.now()) return;
  const count = db.prepare("SELECT COUNT(*) AS count FROM voice_submissions WHERE contest_id = ?").get(contest.id).count;
  if (count > 0 && settleVoiceContest(contest.id)) broadcastVoiceBattle("battle:settled");
  else if (count === 0) resetEmptyExpiredContest(contest);
}
setInterval(settleExpiredVoiceContest, 30 * 1000).unref();

/* ---------------------------------------------------------------------
   Content helpers — ministries, ticker, settings, memes, petitions,
   chat moderation (banned words / ip bans), admin users, activity log.
   --------------------------------------------------------------------- */
function logActivity(actor, action, detail = "") {
  db.prepare(
    "INSERT INTO admin_activity (actor, action, detail, created_at) VALUES (?, ?, ?, ?)",
  ).run(actor, action, detail, Date.now());
}
function allMinistries() {
  return db
    .prepare("SELECT * FROM ministries ORDER BY sort_order ASC, id ASC")
    .all();
}
function activeMinistries() {
  return db
    .prepare(
      "SELECT * FROM ministries WHERE active = 1 ORDER BY sort_order ASC, id ASC",
    )
    .all();
}
function allTicker() {
  return db
    .prepare("SELECT * FROM ticker_items ORDER BY sort_order ASC, id ASC")
    .all();
}
function activeTicker() {
  return db
    .prepare(
      "SELECT * FROM ticker_items WHERE active = 1 ORDER BY sort_order ASC, id ASC",
    )
    .all();
}

const DEFAULT_AVATARS = [
  "😎",
  "😂",
  "🔥",
  "🎤",
  "🏏",
  "👑",
  "🧠",
  "💀",
  "🇮🇳",
  "🚀",
];
function dayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function parseCookieHeader(header = "") { return Object.fromEntries(header.split(";").map(part => part.trim().split("=")).filter(pair => pair.length === 2).map(([k,v]) => [k, decodeURIComponent(v)])); }
function profileTokenFrom(req) {
  const cookies = parseCookieHeader(req.headers.cookie || "");
  return String(
    cookies.mm_citizen || req.headers["x-mememantri-token"] || req.body?.token || req.query?.token || "",
  )
    .trim()
    .slice(0, 120);
}
function cleanNickname(value) {
  const nickname = String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
  return nickname || "Meme Citizen";
}
function cleanAvatar(value) {
  const avatar = String(value || "")
    .trim()
    .slice(0, 8);
  return DEFAULT_AVATARS.includes(avatar) ? avatar : "😎";
}
function ensureProfile(rawToken, nickname = "", avatar = "") {
  const token = String(rawToken || crypto.randomBytes(18).toString("hex"))
    .trim()
    .slice(0, 120);
  const now = Date.now();
  const existing = db
    .prepare("SELECT * FROM profiles WHERE token = ?")
    .get(token);
  if (!existing) {
    db.prepare(
      "INSERT INTO profiles (token, nickname, avatar, points, current_streak, longest_streak, last_seen_day, created_at, updated_at) VALUES (?, ?, ?, 0, 1, 1, ?, ?, ?)",
    ).run(
      token,
      cleanNickname(nickname),
      cleanAvatar(avatar),
      dayStamp(),
      now,
      now,
    );
  } else {
    const previous = existing.last_seen_day;
    const today = dayStamp();
    let streak = existing.current_streak || 1;
    if (previous !== today) {
      const previousTime = Date.parse(`${previous}T00:00:00Z`);
      const todayTime = Date.parse(`${today}T00:00:00Z`);
      streak =
        previous && todayTime - previousTime === 86400000 ? streak + 1 : 1;
    }
    const nextLongest = Math.max(existing.longest_streak || 1, streak);
    db.prepare(
      "UPDATE profiles SET nickname = ?, avatar = ?, current_streak = ?, longest_streak = ?, last_seen_day = ?, updated_at = ? WHERE token = ?",
    ).run(
      nickname ? cleanNickname(nickname) : existing.nickname,
      avatar ? cleanAvatar(avatar) : existing.avatar,
      streak,
      nextLongest,
      today,
      now,
      token,
    );
  }
  return db.prepare("SELECT * FROM profiles WHERE token = ?").get(token);
}
function awardPoints(token, amount) {
  if (!token || !Number.isFinite(amount) || amount <= 0) return;
  db.prepare(
    "UPDATE profiles SET points = points + ?, updated_at = ? WHERE token = ?",
  ).run(Math.floor(amount), Date.now(), token);
}
function profileBadges(profile) {
  if (!profile) return [];
  const submissions = db
    .prepare("SELECT COUNT(*) AS c FROM petitions WHERE creator_token = ?")
    .get(profile.token).c;
  const comments = db
    .prepare("SELECT COUNT(*) AS c FROM meme_comments WHERE profile_token = ?")
    .get(profile.token).c;
  const votes = db
    .prepare("SELECT COUNT(*) AS c FROM meme_likes WHERE profile_token = ?")
    .get(profile.token).c;
  const badges = [];
  if (profile.current_streak >= 3)
    badges.push({
      key: "streak",
      title: "3-Day Streak",
      icon: "🔥",
      description: "3 din se regular MemeMantri citizen",
    });
  if (submissions >= 1)
    badges.push({
      key: "rookie",
      title: "Meme Rookie",
      icon: "📝",
      description: "First meme petition filed",
    });
  if (profile.points >= 50)
    badges.push({
      key: "mantri",
      title: "Meme Mantri",
      icon: "🏛",
      description: "50+ karma points earned",
    });
  if (votes >= 3)
    badges.push({
      key: "voice",
      title: "Voice Champion",
      icon: "🎤",
      description: "Three community votes cast",
    });
  if (comments >= 5)
    badges.push({
      key: "roast",
      title: "Roast King",
      icon: "🔥",
      description: "Five comments dropped",
    });
  return badges;
}
function profilePayload(token) {
  const profile = ensureProfile(token);
  const follows = db
    .prepare(
      "SELECT ministry_key FROM profile_follows WHERE profile_token = ? ORDER BY ministry_key",
    )
    .all(profile.token)
    .map((row) => row.ministry_key);
  const likedMemeIds = db
    .prepare("SELECT meme_id FROM meme_likes WHERE profile_token = ?")
    .all(profile.token)
    .map((row) => row.meme_id);
  const savedMemeIds = db.prepare("SELECT meme_id FROM saved_memes WHERE profile_token = ?").all(profile.token).map((row) => row.meme_id);
  return {
    token: profile.token,
    nickname: profile.nickname,
    avatar: profile.avatar,
    points: profile.points,
    currentStreak: profile.current_streak,
    longestStreak: profile.longest_streak,
    badges: profileBadges(profile),
    follows,
    likedMemeIds,
    savedMemeIds,
    favouriteDepartmentOverride: profile.favourite_department_override || "",
  };
}
/* ---------- Meme Court ---------- */
function courtCounts(memeId) {
  const rows = db
    .prepare(
      "SELECT verdict, COUNT(*) AS c FROM meme_court_votes WHERE meme_id = ? GROUP BY verdict",
    )
    .all(memeId);
  const counts = { guilty: 0, not_funny: 0, needs_punchline: 0 };
  for (const row of rows) counts[row.verdict] = row.c;
  counts.total = counts.guilty + counts.not_funny + counts.needs_punchline;
  return counts;
}
function courtVerdict(counts) {
  const { guilty, not_funny, needs_punchline, total } = counts;
  if (total < 3)
    return { code: "pending", label: "⚖️ Case under trial — vote to decide" };
  const guiltyRatio = guilty / total;
  const notFunnyRatio = not_funny / total;
  if (notFunnyRatio >= 0.8 && total >= 5)
    return { code: "banned", label: "🚫 Lifetime ban from Parliament" };
  if (guiltyRatio >= 0.6)
    return { code: "passed", label: "✅ Motion Passed" };
  if (notFunnyRatio >= 0.6)
    return { code: "rejected", label: "❌ Public rejected this meme" };
  return { code: "acquitted", label: "🙏 Meme acquitted — case dismissed" };
}
function courtPayload(memeId, token) {
  const counts = courtCounts(memeId);
  const myVote = token
    ? db
        .prepare(
          "SELECT verdict FROM meme_court_votes WHERE meme_id = ? AND profile_token = ?",
        )
        .get(memeId, token)?.verdict || null
    : null;
  return { caseNumber: 1000 + Number(memeId), counts, verdict: courtVerdict(counts), myVote };
}

/* ---------- Meme Passport ---------- */
const PASSPORT_RANKS = [
  { min: 0, title: "Intern of Timepass" },
  { min: 10, title: "Junior Meme Officer" },
  { min: 30, title: "Cabinet Minister of Relatability" },
  { min: 75, title: "Deputy Speaker of Bakchodi" },
  { min: 150, title: "Chief Minister of Chaos" },
  { min: 300, title: "Prime Minister of Memedom" },
  { min: 600, title: "President of the Republic of Bakchodi" },
];
function passportRankTitle(points) {
  let title = PASSPORT_RANKS[0].title;
  for (const tier of PASSPORT_RANKS) if (points >= tier.min) title = tier.title;
  return title;
}
function passportPayload(token) {
  const profile = ensureProfile(token);
  const likesCount = db
    .prepare("SELECT COUNT(*) AS c FROM meme_likes WHERE profile_token = ?")
    .get(profile.token).c;
  const commentsCount = db
    .prepare("SELECT COUNT(*) AS c FROM meme_comments WHERE profile_token = ?")
    .get(profile.token).c;
  const submissionsCount = db
    .prepare("SELECT COUNT(*) AS c FROM petitions WHERE creator_token = ?")
    .get(profile.token).c;
  const votesCount = db
    .prepare("SELECT COUNT(*) AS c FROM voice_votes WHERE voter_token = ?")
    .get(profile.token).c;
  const favouriteRow = db
    .prepare(
      `SELECT m.category AS category, COUNT(*) AS c
       FROM meme_likes ml JOIN memes m ON m.id = ml.meme_id
       WHERE ml.profile_token = ?
       GROUP BY m.category ORDER BY c DESC LIMIT 1`,
    )
    .get(profile.token);
  const ministry = favouriteRow
    ? db.prepare("SELECT name, emoji FROM ministries WHERE key = ?").get(favouriteRow.category)
    : null;
  let favouriteDepartment = ministry
    ? `${ministry.emoji} ${ministry.name}`
    : "🏢 Unassigned Department";
  let favouriteDepartmentKey = favouriteRow ? favouriteRow.category : "";
  if (profile.favourite_department_override) {
    const overrideMinistry = db
      .prepare("SELECT key, name, emoji FROM ministries WHERE key = ?")
      .get(profile.favourite_department_override);
    if (overrideMinistry) {
      favouriteDepartment = `${overrideMinistry.emoji} ${overrideMinistry.name}`;
      favouriteDepartmentKey = overrideMinistry.key;
    }
  }
  let reactionPersonality = "Mostly 💀";
  if (commentsCount >= likesCount && commentsCount >= 5) reactionPersonality = "Roast Machine 🔥";
  else if (votesCount >= 3) reactionPersonality = "Debate Ka Deewana 🎤";
  else if (profile.current_streak >= 5) reactionPersonality = "Regular Sansad Attendee 🏛";
  else if (likesCount >= 20) reactionPersonality = "Serial Liker ❤️";
  const memeAge = likesCount + commentsCount + submissionsCount;
  return {
    citizenship: "Republic of Bakchodi 🇮🇳",
    nickname: profile.nickname,
    avatar: profile.avatar,
    rankTitle: passportRankTitle(profile.points),
    points: profile.points,
    favouriteDepartment,
    favouriteDepartmentKey,
    reactionPersonality,
    memeAge: `${memeAge} memes old`,
    issued: profile.created_at,
  };
}
function publicMemeRows(limit = 100) {
  return db
    .prepare(
      `SELECT m.id, m.title, m.category, m.creator, m.text, m.plays, m.featured, m.radio_enabled, m.status, m.source, m.created_at,
    m.likes + COALESCE((SELECT COUNT(*) FROM meme_likes ml WHERE ml.meme_id = m.id), 0) AS likes,
    (SELECT COUNT(*) FROM meme_comments mc WHERE mc.meme_id = m.id) AS comments
    FROM memes m WHERE m.status = 'published' AND m.scope = 'local' ORDER BY m.created_at DESC LIMIT ?`,
    )
    .all(limit);
}
function trendingMemeRows(limit = 6) {
  return db
    .prepare(
      `SELECT m.id, m.title, m.category, m.creator, m.text, m.plays,
    m.likes + COALESCE((SELECT COUNT(*) FROM meme_likes ml WHERE ml.meme_id = m.id), 0) AS likes,
    (m.likes * 1.0) + (COALESCE((SELECT COUNT(*) FROM meme_likes ml2 WHERE ml2.meme_id = m.id), 0) * 3) + (CASE WHEN m.created_at > ? THEN 500 ELSE 0 END) AS trend_score
    FROM memes m WHERE m.status = 'published' AND m.scope = 'local' ORDER BY trend_score DESC, m.created_at DESC LIMIT ?`,
    )
    .all(Date.now() - 86400000, limit);
}
function publicLeaderboard(limit = 10) {
  return db
    .prepare(
      "SELECT token, nickname, avatar, points, current_streak FROM profiles ORDER BY points DESC, current_streak DESC, updated_at DESC LIMIT ?",
    )
    .all(limit)
    .map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname,
      avatar: row.avatar,
      points: row.points,
      streak: row.current_streak,
    }));
}
function onlineCount() {
  return Math.max(1, Number(io.engine?.clientsCount || 0));
}
function publicProfileToken(req) {
  return profileTokenFrom(req) || crypto.randomBytes(18).toString("hex");
}
function numericMemeId(rawId) {
  const id = Number(String(rawId || "").replace(/^srv/, ""));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function profileRank(token) {
  return (
    db
      .prepare(
        "SELECT COUNT(*) + 1 AS rank FROM profiles WHERE points > (SELECT points FROM profiles WHERE token = ?)",
      )
      .get(token)?.rank || 1
  );
}
function getComments(memeId) {
  return db
    .prepare(
      `SELECT c.id, c.text, c.created_at, p.nickname, p.avatar
    FROM meme_comments c LEFT JOIN profiles p ON p.token = c.profile_token
    WHERE c.meme_id = ? ORDER BY c.created_at DESC LIMIT 40`,
    )
    .all(memeId)
    .map((comment) => ({
      ...comment,
      nickname: comment.nickname || "Meme Citizen",
      avatar: comment.avatar || "😎",
    }));
}
function getSetting(key, fallback = "") {
  const row = db
    .prepare("SELECT value FROM site_settings WHERE key = ?")
    .get(key);
  return row ? row.value : fallback;
}
function setSetting(key, value) {
  db.prepare(
    "INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, String(value));
}
function allSettings() {
  const rows = db.prepare("SELECT key, value FROM site_settings").all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
function publicGlobalMemeRows(req) {
  const token = publicProfileToken(req);
  const country = String(req.query.country || "").trim().slice(0, 40);
  const continent = String(req.query.continent || "").trim().slice(0, 40);
  const language = String(req.query.language || "").trim().slice(0, 30);
  const sort = String(req.query.sort || "latest");
  const search = String(req.query.search || "").trim().slice(0, 100);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const order = sort === "popular" ? "likes DESC, m.created_at DESC" : sort === "played" ? "plays DESC, m.created_at DESC" : sort === "featured" ? "m.featured DESC, m.created_at DESC" : "m.created_at DESC";
  const where = ["m.scope = 'global'", "m.status = 'published'"];
  const params = [];
  if (country && country !== "all") { where.push("m.country = ?"); params.push(country); }
  if (continent && continent !== "all") { where.push("m.continent = ?"); params.push(continent); }
  if (language && language !== "all") { where.push("m.language = ?"); params.push(language); }
  if (search) { where.push("(LOWER(m.title) LIKE ? OR LOWER(m.text) LIKE ? OR LOWER(m.creator) LIKE ? OR LOWER(m.category) LIKE ?)"); const q = "%" + search.toLowerCase() + "%"; params.push(q, q, q, q); }
  const totalCount = db.prepare(`SELECT COUNT(*) AS c FROM memes m WHERE ${where.join(" AND ")}`).get(...params).c;
  const rows = db.prepare(`SELECT m.id, m.title, m.category, m.creator, m.text, m.plays, m.featured, m.radio_enabled, m.created_at, m.country, m.continent, m.language, m.source,
    m.likes + COALESCE((SELECT COUNT(*) FROM meme_likes ml WHERE ml.meme_id = m.id), 0) AS likes,
    (SELECT COUNT(*) FROM meme_comments mc WHERE mc.meme_id = m.id) AS comments,
    EXISTS(SELECT 1 FROM meme_likes ml2 WHERE ml2.meme_id = m.id AND ml2.profile_token = ?) AS liked,
    EXISTS(SELECT 1 FROM saved_memes sm WHERE sm.meme_id = m.id AND sm.profile_token = ?) AS saved
    FROM memes m WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`).all(token, token, ...params, limit, offset);
  return { memes: rows, profile: { ...profilePayload(token), rank: profileRank(token) }, total: totalCount, offset, limit, hasMore: offset + rows.length < totalCount };
}

function publishedMemes() {
  return publicMemeRows();
}
function publicMemeByShareId(rawId) {
  const value = String(rawId || "").trim();
  const id = Number(value.replace(/^srv/, ""));
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return (
    db
      .prepare(
        "SELECT id, title, category, creator, text, likes, plays FROM memes WHERE id = ? AND status = 'published'",
      )
      .get(id) || null
  );
}
function escapeHtmlAttribute(value) {
  return String(value ?? "").replace(
    /[&<>\"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
function allMemesAdmin() {
  return db.prepare("SELECT * FROM memes ORDER BY created_at DESC").all();
}
function bannedWordsList() {
  return db.prepare("SELECT * FROM banned_words ORDER BY word ASC").all();
}
function censorTextFlagged(text) {
  const words = bannedWordsList()
    .map((w) => w.word.toLowerCase())
    .filter(Boolean);
  if (!words.length) return { text, flagged: false };
  let out = text;
  let flagged = false;
  words.forEach((word) => {
    out = out.replace(
      new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      (m) => {
        flagged = true;
        return "*".repeat(m.length);
      },
    );
  });
  return { text: out, flagged };
}
function censorText(text) {
  return censorTextFlagged(text).text;
}
function isIpBanned(ip) {
  return !!db.prepare("SELECT 1 FROM ip_bans WHERE ip = ?").get(ip);
}
function httpClientIp(req) {
  return String(
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown",
  )
    .split(",")[0]
    .trim();
}
const AUTO_BAN_STRIKES = 3;
function getIpWarning(ip) {
  return db.prepare("SELECT * FROM ip_warnings WHERE ip = ?").get(ip);
}
function banIpRecord(ip, reason) {
  db.prepare(
    "INSERT OR IGNORE INTO ip_bans (ip, reason, created_at) VALUES (?, ?, ?)",
  ).run(ip, reason, Date.now());
  db.prepare("DELETE FROM ip_warnings WHERE ip = ?").run(ip);
  for (const client of io.sockets.sockets.values()) {
    if (clientSocketIp(client) === ip) client.disconnect(true);
  }
}
/* Records a strike against an IP. Below AUTO_BAN_STRIKES it stays a
   warning — the visitor keeps full access, they just get told about it.
   At the threshold it escalates straight into a hard ban (ip_bans),
   which is enforced everywhere (HTTP writes + chat socket). */
function warnIp(ip, reason) {
  if (isIpBanned(ip)) return { alreadyBanned: true, strikes: null };
  const existing = getIpWarning(ip);
  const strikes = (existing?.strikes || 0) + 1;
  const now = Date.now();
  if (strikes >= AUTO_BAN_STRIKES) {
    banIpRecord(ip, `Auto-ban after repeated warnings: ${reason}`);
    return { escalatedToBan: true, strikes };
  }
  db.prepare(
    `INSERT INTO ip_warnings (ip, reason, strikes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ip) DO UPDATE SET reason = excluded.reason, strikes = excluded.strikes, updated_at = excluded.updated_at`,
  ).run(ip, reason, strikes, existing?.created_at || now, now);
  return { escalatedToBan: false, strikes };
}
function warningMessageFor(ip) {
  const warning = getIpWarning(ip);
  if (!warning) return null;
  return `⚠️ Warning: aapki activity flag hui hai (strike ${warning.strikes}/${AUTO_BAN_STRIKES}). Dobara wrong activity hui to aapka IP poori tarah ban ho jayega.`;
}
/* Blocks HTTP requests from a fully-banned IP outright. A merely-warned IP
   passes through untouched — res.locals.moderationWarning is set so route
   handlers can echo the warning back in their JSON response. */
function ipModerationGate(req, res, next) {
  const ip = httpClientIp(req);
  if (isIpBanned(ip))
    return res.status(403).json({
      message: "Aapka IP is action ke liye poori tarah blocked hai.",
    });
  const warning = warningMessageFor(ip);
  if (warning) res.locals.moderationWarning = warning;
  next();
}
/* Lightweight in-memory rate limiter (no external dependency). Keyed by
   IP + bucket name; resets on a rolling window. Good enough for a single
   Node process — swap for a shared store (Redis) if you scale out. */
const rateLimitBuckets = new Map();
function rateLimit({ windowMs, max, bucket }) {
  return (req, res, next) => {
    const key = `${bucket}:${httpClientIp(req)}`;
    const now = Date.now();
    const entry = rateLimitBuckets.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        message: `Bahut zyada requests. ${retryAfterSec}s baad try karein.`,
      });
    }
    entry.count += 1;
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitBuckets)
    if (now > entry.resetAt) rateLimitBuckets.delete(key);
}, 10 * 60 * 1000).unref();
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(check, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const waiting = [];
const partnerOf = new Map();
const pendingInvites = new Map();
const inviteBySocket = new Map();
const channels = new Map();
const names = [
  "Chai Citizen",
  "Meme Yatri",
  "Roast Republic",
  "Laughing Lok",
  "Desi Debater",
  "Punchline Pilot",
];

const cors = require("cors");
/* Set TRUST_PROXY=1 when deployed behind a reverse proxy / load balancer
   (Render, Railway, Nginx, etc.) so req.secure and X-Forwarded-* headers
   are read correctly. */
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(cors({ origin: corsOriginCheck, credentials: true }));
/* Hand-rolled security headers (no extra dependency needed — equivalent
   to the common bits of Helmet for this app's needs). Adjust connect-src /
   script-src if you add new third-party domains. */
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), camera=(), microphone=(self)",
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.socket.io",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "media-src 'self' blob: data:",
      "connect-src 'self' https: wss: ws:",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  );
  if (req.secure || req.headers["x-forwarded-proto"] === "https")
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains",
    );
  next();
}
app.use(securityHeaders);
app.use(express.json({ limit: "32kb" }));

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const ADMIN_ROUTE = `/${String(process.env.ADMIN_ROUTE || "meme-mantri-control-7f2a").replace(/^\/+|\/+$/g, "")}`;
const adminSessions = new Map();
const adminLoginAttempts = new Map();
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((pair) => pair.length === 2)
      .map(([key, ...value]) => [key, decodeURIComponent(value.join("="))]),
  );
}
function secureEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function adminSession(req) {
  const token = parseCookies(req.headers.cookie).mm_admin_session;
  const session = token && adminSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  return { token, ...session };
}
function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD)
    return res
      .status(503)
      .json({
        message:
          "Admin panel configured nahi hai. Render environment mein ADMIN_PASSWORD set karo.",
      });
  const session = adminSession(req);
  if (!session)
    return res.status(401).json({ message: "Admin login required hai." });
  req.admin = session;
  next();
}
function requireSuperAdmin(req, res, next) {
  if (req.admin?.role !== "super")
    return res
      .status(403)
      .json({ message: "Sirf super-admin ye action kar sakta hai." });
  next();
}
function clientIp(req) {
  return String(
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown",
  )
    .split(",")[0]
    .trim();
}
function loginAllowed(req) {
  const now = Date.now();
  const ip = clientIp(req);
  const record = adminLoginAttempts.get(ip);
  if (!record || record.windowStarted + ADMIN_LOGIN_WINDOW_MS <= now) {
    adminLoginAttempts.set(ip, { windowStarted: now, attempts: 0 });
    return true;
  }
  return record.attempts < ADMIN_LOGIN_MAX_ATTEMPTS;
}
function recordLoginFailure(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const record = adminLoginAttempts.get(ip);
  if (!record || record.windowStarted + ADMIN_LOGIN_WINDOW_MS <= now)
    adminLoginAttempts.set(ip, { windowStarted: now, attempts: 1 });
  else record.attempts += 1;
}
function clearLoginFailures(req) {
  adminLoginAttempts.delete(clientIp(req));
}
function adminCookie(token, maxAge = ADMIN_SESSION_TTL_MS, secure = false) {
  return `mm_admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=${ADMIN_ROUTE}; Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}${secure ? "; Secure" : ""}`;
}
function sameOriginAdminRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}
function adminDashboardState() {
  const contest = ensureVoiceContest();
  const submissions = db
    .prepare(
      "SELECT id, slot, author, title, text, votes, created_at FROM voice_submissions WHERE contest_id = ? ORDER BY slot ASC",
    )
    .all(contest.id);
  return {
    contest: {
      id: contest.id,
      status: contest.status,
      starts_at: contest.starts_at,
      ends_at: contest.ends_at,
      submissions,
    },
    history: voiceMantriHistory(),
    channels: publicChannels(),
    memesCount: db
      .prepare("SELECT COUNT(*) AS c FROM memes WHERE status = 'published'")
      .get().c,
    pendingPetitions: db
      .prepare("SELECT COUNT(*) AS c FROM petitions WHERE status = 'pending'")
      .get().c,
    ministriesCount: activeMinistries().length,
    ipBansCount: db.prepare("SELECT COUNT(*) AS c FROM ip_bans").get().c,
    settings: allSettings(),
    health: { ok: true, service: "Meme Adda online matchmaking chat" },
  };
}
app.post(`${ADMIN_ROUTE}/api/login`, (req, res) => {
  if (!ADMIN_PASSWORD)
    return res
      .status(503)
      .json({
        message:
          "Admin panel configured nahi hai. Render environment mein ADMIN_PASSWORD set karo.",
      });
  if (!loginAllowed(req))
    return res
      .status(429)
      .json({ message: "Too many login attempts. 15 minutes baad try karo." });
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  let role = null;
  if (
    secureEqual(username, ADMIN_USERNAME) &&
    secureEqual(password, ADMIN_PASSWORD)
  )
    role = "super";
  else {
    const dbUser = db
      .prepare("SELECT * FROM admin_users WHERE username = ?")
      .get(username);
    if (dbUser && verifyPassword(password, dbUser.password_hash))
      role = dbUser.role;
  }
  if (!role) {
    recordLoginFailure(req);
    return res.status(401).json({ message: "Username ya password galat hai." });
  }
  clearLoginFailures(req);
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, {
    username,
    role,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
  });
  res.setHeader(
    "Set-Cookie",
    adminCookie(
      token,
      ADMIN_SESSION_TTL_MS,
      req.secure || process.env.NODE_ENV === "production",
    ),
  );
  logActivity(username, "login", "");
  res.json({ user: { username, role } });
});
app.post(`${ADMIN_ROUTE}/api/logout`, (req, res) => {
  if (!sameOriginAdminRequest(req))
    return res.status(403).json({ message: "Invalid admin request origin." });
  const token = parseCookies(req.headers.cookie).mm_admin_session;
  if (token) adminSessions.delete(token);
  res.setHeader(
    "Set-Cookie",
    adminCookie("", 0, req.secure || process.env.NODE_ENV === "production"),
  );
  res.json({ ok: true });
});
app.get(`${ADMIN_ROUTE}/api/me`, requireAdmin, (req, res) =>
  res.json({ user: { username: req.admin.username, role: req.admin.role } }),
);
app.get(`${ADMIN_ROUTE}/api/dashboard`, requireAdmin, (_req, res) =>
  res.json(adminDashboardState()),
);

/* -- guard: every admin-mutating route below requires same-origin + admin session -- */
function adminWrite(req, res, next) {
  if (!sameOriginAdminRequest(req))
    return res.status(403).json({ message: "Invalid admin request origin." });
  next();
}

/* VoiceMantri contest control */
app.post(
  `${ADMIN_ROUTE}/api/contest/settle`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const contest = openVoiceContest();
    if (!contest)
      return res.status(409).json({ message: "Koi open contest nahi hai." });
    settleVoiceContest(contest.id);
    broadcastVoiceBattle("battle:settled");
    logActivity(req.admin.username, "contest:settle", `contest #${contest.id}`);
    res.json({
      ok: true,
      message: "Current VoiceMantri contest settle kar diya gaya.",
    });
  },
);
app.post(
  `${ADMIN_ROUTE}/api/contest/new`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    if (openVoiceContest())
      return res
        .status(409)
        .json({
          message: "Current contest abhi open hai. Pehle usse settle karo.",
        });
    const id = createVoiceContest();
    broadcastVoiceBattle("battle:update");
    logActivity(req.admin.username, "contest:new", `contest #${id}`);
    res.json({
      ok: true,
      contestId: id,
      message: "Naya 24-hour VoiceMantri contest start ho gaya.",
    });
  },
);
app.post(
  `${ADMIN_ROUTE}/api/contest/extend`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const contest = openVoiceContest();
    if (!contest)
      return res.status(409).json({ message: "Koi open contest nahi hai." });
    const hours = Math.max(1, Math.min(72, Number(req.body?.hours) || 24));
    db.prepare(
      "UPDATE voice_contests SET ends_at = ends_at + ? WHERE id = ?",
    ).run(hours * 60 * 60 * 1000, contest.id);
    broadcastVoiceBattle("battle:update");
    logActivity(
      req.admin.username,
      "contest:extend",
      `contest #${contest.id} +${hours}h`,
    );
    res.json({
      ok: true,
      message: `Contest ${hours} ghante ke liye extend ho gaya.`,
    });
  },
);
app.delete(
  `${ADMIN_ROUTE}/api/contest/submissions/:id`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const id = Number(req.params.id);
    const sub = db
      .prepare("SELECT * FROM voice_submissions WHERE id = ?")
      .get(id);
    if (!sub) return res.status(404).json({ message: "Submission nahi mila." });
    db.prepare("DELETE FROM voice_submissions WHERE id = ?").run(id);
    db.prepare("DELETE FROM voice_votes WHERE submission_id = ?").run(id);
    broadcastVoiceBattle("battle:update");
    logActivity(
      req.admin.username,
      "contest:remove-submission",
      `submission #${id}`,
    );
    res.json({ ok: true, message: "Submission remove kar diya gaya." });
  },
);

/* Chat channel + moderation */
app.post(
  `${ADMIN_ROUTE}/api/channels/:id/remove`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const id = String(req.params.id || "");
    const channel = channels.get(id);
    if (!channel)
      return res.status(404).json({ message: "Channel nahi mila." });
    for (const memberId of channel.members) {
      const member = io.sockets.sockets.get(memberId);
      if (member) {
        member.leave(id);
        member.data.channelId = null;
        member.emit("channel:left");
      }
    }
    channels.delete(id);
    io.emit("channel:list", publicChannels());
    logActivity(req.admin.username, "channel:remove", channel.name);
    res.json({
      ok: true,
      message: `#${channel.name} channel remove kar diya gaya.`,
    });
  },
);
app.get(
  `${ADMIN_ROUTE}/api/moderation/banned-words`,
  requireAdmin,
  (_req, res) => res.json(bannedWordsList()),
);
app.post(
  `${ADMIN_ROUTE}/api/moderation/banned-words`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const word = String(req.body?.word || "")
      .trim()
      .toLowerCase();
    if (!word) return res.status(400).json({ message: "Word required hai." });
    db.prepare("INSERT OR IGNORE INTO banned_words (word) VALUES (?)").run(
      word,
    );
    logActivity(req.admin.username, "moderation:add-word", word);
    res.json({ ok: true, words: bannedWordsList() });
  },
);
app.delete(
  `${ADMIN_ROUTE}/api/moderation/banned-words/:id`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    db.prepare("DELETE FROM banned_words WHERE id = ?").run(
      Number(req.params.id),
    );
    logActivity(req.admin.username, "moderation:remove-word", req.params.id);
    res.json({ ok: true, words: bannedWordsList() });
  },
);
app.get(`${ADMIN_ROUTE}/api/moderation/ip-bans`, requireAdmin, (_req, res) =>
  res.json(db.prepare("SELECT * FROM ip_bans ORDER BY created_at DESC").all()),
);
app.post(
  `${ADMIN_ROUTE}/api/moderation/ip-bans`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const ip = String(req.body?.ip || "").trim();
    const reason = String(req.body?.reason || "")
      .trim()
      .slice(0, 200);
    if (!ip) return res.status(400).json({ message: "IP required hai." });
    banIpRecord(ip, reason);
    logActivity(req.admin.username, "moderation:ban-ip", ip);
    res.json({ ok: true, message: `${ip} ban ho gaya.` });
  },
);
app.delete(
  `${ADMIN_ROUTE}/api/moderation/ip-bans/:id`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    db.prepare("DELETE FROM ip_bans WHERE id = ?").run(Number(req.params.id));
    logActivity(req.admin.username, "moderation:unban-ip", req.params.id);
    res.json({ ok: true });
  },
);
/* Warned IPs: a lighter tier below a full ban — they keep normal access,
   the site just shows them a warning. Enough strikes (or promoting one
   here) escalates into ip_bans, which is a hard block. */
app.get(
  `${ADMIN_ROUTE}/api/moderation/ip-warnings`,
  requireAdmin,
  (_req, res) =>
    res.json(
      db.prepare("SELECT * FROM ip_warnings ORDER BY updated_at DESC").all(),
    ),
);
app.post(
  `${ADMIN_ROUTE}/api/moderation/ip-warnings`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const ip = String(req.body?.ip || "").trim();
    const reason = String(req.body?.reason || "Manual admin warning")
      .trim()
      .slice(0, 200);
    if (!ip) return res.status(400).json({ message: "IP required hai." });
    if (isIpBanned(ip))
      return res
        .status(400)
        .json({ message: "Ye IP already fully banned hai." });
    const result = warnIp(ip, reason);
    logActivity(req.admin.username, "moderation:warn-ip", ip);
    res.json({
      ok: true,
      escalatedToBan: !!result.escalatedToBan,
      message: result.escalatedToBan
        ? `${ip} strikes threshold cross kar gaya — ab poori tarah ban hai.`
        : `${ip} ko warning de di gayi (strike ${result.strikes}/${AUTO_BAN_STRIKES}).`,
    });
  },
);
app.delete(
  `${ADMIN_ROUTE}/api/moderation/ip-warnings/:ip`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    db.prepare("DELETE FROM ip_warnings WHERE ip = ?").run(req.params.ip);
    logActivity(req.admin.username, "moderation:clear-warning", req.params.ip);
    res.json({ ok: true });
  },
);
app.post(
  `${ADMIN_ROUTE}/api/moderation/ip-warnings/:ip/promote`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const ip = req.params.ip;
    banIpRecord(ip, "Promoted from warning by admin");
    logActivity(req.admin.username, "moderation:promote-warning-to-ban", ip);
    res.json({ ok: true, message: `${ip} ab poori tarah ban hai.` });
  },
);
app.get(
  `${ADMIN_ROUTE}/api/moderation/adda-reports`,
  requireAdmin,
  (_req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM adda_reports ORDER BY created_at DESC LIMIT 200")
        .all(),
    ),
);

/* Memes CRUD */
app.get(`${ADMIN_ROUTE}/api/memes`, requireAdmin, (_req, res) =>
  res.json(allMemesAdmin()),
);
app.post(`${ADMIN_ROUTE}/api/memes`, requireAdmin, adminWrite, (req, res) => {
  const { title, category, creator, text } = req.body || {};
  if (!title || !category || !creator || !text)
    return res
      .status(400)
      .json({ message: "Title, category, creator, text sab required hain." });
  const info = db
    .prepare(
      "INSERT INTO memes (title, category, creator, text, likes, plays, featured, radio_enabled, status, source, created_at) VALUES (?, ?, ?, ?, 0, 0, 0, 1, 'published', 'admin', ?)",
    )
    .run(
      String(title).slice(0, 120),
      String(category).slice(0, 40),
      String(creator).slice(0, 60),
      String(text).slice(0, 800),
      Date.now(),
    );
  logActivity(req.admin.username, "meme:create", title);
  res.json({ ok: true, id: info.lastInsertRowid });
});
app.put(
  `${ADMIN_ROUTE}/api/memes/:id`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare("SELECT * FROM memes WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ message: "Meme nahi mila." });
    const { title, category, creator, text, featured, radio_enabled, status } =
      req.body || {};
    db.prepare(
      "UPDATE memes SET title=?, category=?, creator=?, text=?, featured=?, radio_enabled=?, status=? WHERE id=?",
    ).run(
      String(title ?? existing.title).slice(0, 120),
      String(category ?? existing.category).slice(0, 40),
      String(creator ?? existing.creator).slice(0, 60),
      String(text ?? existing.text).slice(0, 800),
      featured != null ? (featured ? 1 : 0) : existing.featured,
      radio_enabled != null ? (radio_enabled ? 1 : 0) : existing.radio_enabled,
      String(status ?? existing.status),
      id,
    );
    logActivity(req.admin.username, "meme:update", `#${id}`);
    res.json({ ok: true });
  },
);
app.delete(
  `${ADMIN_ROUTE}/api/memes/:id`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    db.prepare("DELETE FROM memes WHERE id = ?").run(Number(req.params.id));
    logActivity(req.admin.username, "meme:delete", `#${req.params.id}`);
    res.json({ ok: true });
  },
);

/* Ministries CRUD */
app.get(`${ADMIN_ROUTE}/api/ministries`, requireAdmin, (_req, res) =>
  res.json(allMinistries()),
);
app.post(
  `${ADMIN_ROUTE}/api/ministries`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const key = String(req.body?.key || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    const name = String(req.body?.name || "")
      .trim()
      .slice(0, 60);
    const emoji = String(req.body?.emoji || "🏛").slice(0, 8);
    if (!key || !name)
      return res.status(400).json({ message: "Key aur name required hain." });
    const maxOrder = db
      .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM ministries")
      .get().m;
    try {
      db.prepare(
        "INSERT INTO ministries (key, name, emoji, sort_order, active) VALUES (?, ?, ?, ?, 1)",
      ).run(key, name, emoji, maxOrder + 1);
    } catch {
      return res
        .status(409)
        .json({ message: "Ye key already exist karti hai." });
    }
    logActivity(req.admin.username, "ministry:create", key);
    res.json({ ok: true });
  },
);
app.put(
  `${ADMIN_ROUTE}/api/ministries/:id`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const id = Number(req.params.id);
    const existing = db
      .prepare("SELECT * FROM ministries WHERE id = ?")
      .get(id);
    if (!existing)
      return res.status(404).json({ message: "Ministry nahi mili." });
    const { name, emoji, active, sort_order } = req.body || {};
    db.prepare(
      "UPDATE ministries SET name=?, emoji=?, active=?, sort_order=? WHERE id=?",
    ).run(
      String(name ?? existing.name).slice(0, 60),
      String(emoji ?? existing.emoji).slice(0, 8),
      active != null ? (active ? 1 : 0) : existing.active,
      sort_order != null ? Number(sort_order) : existing.sort_order,
      id,
    );
    logActivity(req.admin.username, "ministry:update", `#${id}`);
    res.json({ ok: true });
  },
);
app.delete(
  `${ADMIN_ROUTE}/api/ministries/:id`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    db.prepare("DELETE FROM ministries WHERE id = ?").run(
      Number(req.params.id),
    );
    logActivity(req.admin.username, "ministry:delete", `#${req.params.id}`);
    res.json({ ok: true });
  },
);

/* Ticker CRUD */
app.get(`${ADMIN_ROUTE}/api/ticker`, requireAdmin, (_req, res) =>
  res.json(allTicker()),
);
app.post(`${ADMIN_ROUTE}/api/ticker`, requireAdmin, adminWrite, (req, res) => {
  const text = String(req.body?.text || "")
    .trim()
    .slice(0, 200);
  if (!text) return res.status(400).json({ message: "Text required hai." });
  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM ticker_items")
    .get().m;
  db.prepare(
    "INSERT INTO ticker_items (text, sort_order, active) VALUES (?, ?, 1)",
  ).run(text, maxOrder + 1);
  logActivity(req.admin.username, "ticker:create", text);
  res.json({ ok: true });
});
app.put(
  `${ADMIN_ROUTE}/api/ticker/:id`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const id = Number(req.params.id);
    const existing = db
      .prepare("SELECT * FROM ticker_items WHERE id = ?")
      .get(id);
    if (!existing)
      return res.status(404).json({ message: "Ticker item nahi mila." });
    const { text, active } = req.body || {};
    db.prepare("UPDATE ticker_items SET text=?, active=? WHERE id=?").run(
      String(text ?? existing.text).slice(0, 200),
      active != null ? (active ? 1 : 0) : existing.active,
      id,
    );
    logActivity(req.admin.username, "ticker:update", `#${id}`);
    res.json({ ok: true });
  },
);
app.delete(
  `${ADMIN_ROUTE}/api/ticker/:id`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    db.prepare("DELETE FROM ticker_items WHERE id = ?").run(
      Number(req.params.id),
    );
    logActivity(req.admin.username, "ticker:delete", `#${req.params.id}`);
    res.json({ ok: true });
  },
);

/* Site settings (MOTD pin, title, tagline, maintenance mode) */
app.get(`${ADMIN_ROUTE}/api/settings`, requireAdmin, (_req, res) =>
  res.json(allSettings()),
);
app.put(`${ADMIN_ROUTE}/api/settings`, requireAdmin, adminWrite, (req, res) => {
  const body = req.body || {};
  Object.keys(DEFAULT_SETTINGS).forEach((key) => {
    if (body[key] !== undefined) setSetting(key, body[key]);
  });
  logActivity(
    req.admin.username,
    "settings:update",
    Object.keys(body).join(","),
  );
  res.json({ ok: true, settings: allSettings() });
});

/* Petitions moderation */
app.get(`${ADMIN_ROUTE}/api/petitions`, requireAdmin, (req, res) => {
  const status = ["pending", "approved", "rejected"].includes(req.query.status)
    ? req.query.status
    : "pending";
  res.json(
    db
      .prepare(
        "SELECT * FROM petitions WHERE status = ? ORDER BY created_at DESC",
      )
      .all(status),
  );
});
app.post(
  `${ADMIN_ROUTE}/api/petitions/:id/approve`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const petition = db
      .prepare("SELECT * FROM petitions WHERE id = ?")
      .get(Number(req.params.id));
    if (!petition || petition.status !== "pending")
      return res.status(404).json({ message: "Pending petition nahi mili." });
    db.prepare(
      "INSERT INTO memes (title, category, creator, text, likes, plays, featured, radio_enabled, status, source, created_at, scope, country, continent, language, petition_id) VALUES (?, ?, ?, ?, 0, 0, 0, 1, 'published', 'petition', ?, ?, ?, ?, ?, ?)",
    ).run(
      petition.title,
      petition.category,
      petition.creator,
      petition.text,
      Date.now(),
      petition.scope || "local",
      petition.country || "",
      petition.continent || "",
      petition.language || "hinglish",
      petition.id,
    );
    db.prepare(
      "UPDATE petitions SET status='approved', reviewed_at=? WHERE id=?",
    ).run(Date.now(), petition.id);
    logActivity(req.admin.username, "petition:approve", petition.title);
    res.json({
      ok: true,
      message: "Petition approve karke feed me add kar diya gaya.",
    });
  },
);
app.post(
  `${ADMIN_ROUTE}/api/petitions/:id/reject`,
  requireAdmin,
  adminWrite,
  (req, res) => {
    const note = String(req.body?.note || "").slice(0, 200);
    const result = db
      .prepare(
        "UPDATE petitions SET status='rejected', reviewed_at=?, review_note=? WHERE id=? AND status='pending'",
      )
      .run(Date.now(), note, Number(req.params.id));
    if (!result.changes)
      return res.status(404).json({ message: "Pending petition nahi mili." });
    logActivity(req.admin.username, "petition:reject", String(req.params.id));
    res.json({ ok: true, message: "Petition reject kar di gayi." });
  },
);

/* Admin users + roles (super-admin only) */
app.get(
  `${ADMIN_ROUTE}/api/admins`,
  requireAdmin,
  requireSuperAdmin,
  (_req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id, username, role, created_at FROM admin_users ORDER BY created_at DESC",
        )
        .all(),
    ),
);
app.post(
  `${ADMIN_ROUTE}/api/admins`,
  requireAdmin,
  requireSuperAdmin,
  adminWrite,
  (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const role = ["admin", "moderator"].includes(req.body?.role)
      ? req.body.role
      : "moderator";
    if (!username || password.length < 6)
      return res
        .status(400)
        .json({
          message: "Username aur kam se kam 6-character password required hai.",
        });
    try {
      db.prepare(
        "INSERT INTO admin_users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
      ).run(username, hashPassword(password), role, Date.now());
    } catch {
      return res
        .status(409)
        .json({ message: "Ye username already exist karta hai." });
    }
    logActivity(req.admin.username, "admin:create", `${username} (${role})`);
    res.json({ ok: true });
  },
);
app.delete(
  `${ADMIN_ROUTE}/api/admins/:id`,
  requireAdmin,
  requireSuperAdmin,
  adminWrite,
  (req, res) => {
    db.prepare("DELETE FROM admin_users WHERE id = ?").run(
      Number(req.params.id),
    );
    logActivity(req.admin.username, "admin:delete", req.params.id);
    res.json({ ok: true });
  },
);

/* Activity log + DB backup */
app.get(`${ADMIN_ROUTE}/api/activity`, requireAdmin, (_req, res) =>
  res.json(
    db
      .prepare(
        "SELECT * FROM admin_activity ORDER BY created_at DESC LIMIT 200",
      )
      .all(),
  ),
);
app.get(
  `${ADMIN_ROUTE}/api/backup`,
  requireAdmin,
  requireSuperAdmin,
  (req, res) => {
    logActivity(req.admin.username, "backup:download", "");
    res.download(BATTLE_DB_PATH, "mememantri-backup.db");
  },
);

app.get([`${ADMIN_ROUTE}/`, ADMIN_ROUTE], (req, res) => {
  if (!req.path.endsWith("/")) return res.redirect(301, `${ADMIN_ROUTE}/`);
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "admin.html"));
});
app.get(`${ADMIN_ROUTE}/admin.js`, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "admin.js"));
});
app.get(["/admin", "/admin/", "/admin.html", "/admin.js"], (_req, res) =>
  res.status(404).send("Not found"),
);

/* ---------------------------------------------------------------------
   Public (no-auth) API — used by index.html/mm.js so admin changes show
   up live on the real site.
   --------------------------------------------------------------------- */
app.get("/api/public/site", (_req, res) => {
  const settings = allSettings();
  res.json({
    siteTitle: settings.site_title,
    tagline: settings.site_tagline,
    maintenance: settings.maintenance_mode === "1",
    maintenanceMessage: settings.maintenance_message,
    ministries: activeMinistries().map((m) => [m.key, m.name, m.emoji]),
    ticker: activeTicker().map((t) => t.text),
    motdMemeId: settings.motd_meme_id ? Number(settings.motd_meme_id) : null,
  });
});

app.get("/api/public/turn-credentials", async (_req, res) => {
  const iceServers = await getTurnCredentials();
  if (!iceServers)
    return res
      .status(503)
      .json({ error: "Voice call service abhi unavailable hai." });
  res.json({ iceServers });
});
app.get("/api/public/memes", (_req, res) => res.json(publishedMemes()));
app.get("/api/public/global-memes", (req, res) => res.json(publicGlobalMemeRows(req)));
app.post("/api/public/global-memes/:id/play", (req, res) => {
  const id = numericMemeId(req.params.id);
  const result = id && db.prepare("UPDATE memes SET plays = plays + 1 WHERE id = ? AND scope = 'global' AND status = 'published'").run(id);
  if (!result?.changes) return res.status(404).json({ message: "Global meme not found." });
  res.json({ ok: true, plays: db.prepare("SELECT plays FROM memes WHERE id = ?").get(id).plays });
});
app.post("/api/public/global-memes/:id/report", ipModerationGate, rateLimit({ windowMs: 60 * 60 * 1000, max: 15, bucket: "report" }), (req, res) => {
  const id = numericMemeId(req.params.id); const profile = ensureProfile(publicProfileToken(req));
  const reason = String(req.body?.reason || "other").trim().slice(0, 60);
  if (!id || !db.prepare("SELECT 1 FROM memes WHERE id = ? AND status = 'published'").get(id)) return res.status(404).json({ message: "Meme not found." });
  try { db.prepare("INSERT INTO meme_reports (meme_id, profile_token, reason, created_at) VALUES (?, ?, ?, ?)").run(id, profile.token, reason, Date.now()); } catch {}
  res.json({ ok: true, message: "Report receive ho gaya. Team review karegi.", warning: res.locals.moderationWarning });
});
app.post("/api/public/global-submissions", ipModerationGate, rateLimit({ windowMs: 30 * 60 * 1000, max: 6, bucket: "submission" }), (req, res) => {
  const profile = ensureProfile(publicProfileToken(req));
  const ip = httpClientIp(req);
  const title = String(req.body?.title || "").trim().slice(0, 120);
  const rawText = String(req.body?.text || "").trim().slice(0, 800);
  const { text, flagged } = censorTextFlagged(rawText);
  const country = String(req.body?.country || "world").trim().slice(0, 40);
  const continent = String(req.body?.continent || "world").trim().slice(0, 40);
  const language = String(req.body?.language || "english").trim().slice(0, 30);
  const creatorRaw = String(req.body?.creator || "").trim().slice(0, 60);
  if (!title || !text) return res.status(400).json({ message: "Title aur meme text dono zaroori hain." });
  if (flagged) {
    const strike = warnIp(ip, "inappropriate text in global meme submission");
    if (strike.escalatedToBan)
      return res.status(403).json({ message: "Baar-baar inappropriate content ki wajah se aapka IP poori tarah ban ho gaya hai." });
  }
  const creator = creatorRaw ? (creatorRaw.startsWith("@") ? creatorRaw : "@" + creatorRaw) : "@anonymous";
  db.prepare("INSERT INTO petitions (title, category, creator, text, creator_token, status, created_at, scope, country, continent, language) VALUES (?, ?, ?, ?, ?, 'pending', ?, 'global', ?, ?, ?)").run(title, "global", creator, text, profile.token, Date.now(), country, continent, language);
  awardPoints(profile.token, 10);
  res.json({ ok: true, message: "Global meme moderation ke liye submit ho gaya — +10 karma points.", warning: flagged ? warningMessageFor(ip) : res.locals.moderationWarning });
});
app.get("/api/public/identity", (req, res) => {
  const current = profileTokenFrom(req);
  const profile = ensureProfile(current);
  res.setHeader("Set-Cookie", `mm_citizen=${encodeURIComponent(profile.token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`);
  res.json({ ok: true, token: profile.token, profile: { ...profilePayload(profile.token), rank: profileRank(profile.token) } });
});
app.get("/api/public/community", (req, res) => {
  const token = publicProfileToken(req);
  const profile = profilePayload(token);
  res.json({
    profile: { ...profile, rank: profileRank(profile.token) },
    trending: trendingMemeRows(),
    leaderboard: publicLeaderboard(),
    onlineCount: onlineCount(),
    ministries: activeMinistries().map((m) => ({
      key: m.key,
      name: m.name,
      emoji: m.emoji,
    })),
  });
});
app.post("/api/public/profile", (req, res) => {
  const profile = ensureProfile(
    publicProfileToken(req),
    req.body?.nickname,
    req.body?.avatar,
  );
  res.json({
    ok: true,
    profile: {
      ...profilePayload(profile.token),
      rank: profileRank(profile.token),
    },
  });
});
app.post("/api/public/profile/follows", (req, res) => {
  const profile = ensureProfile(publicProfileToken(req));
  const ministryKey = String(req.body?.ministryKey || "")
    .trim()
    .slice(0, 40);
  if (!activeMinistries().some((ministry) => ministry.key === ministryKey))
    return res.status(400).json({ message: "Ministry not found." });
  const exists = db
    .prepare(
      "SELECT 1 FROM profile_follows WHERE profile_token = ? AND ministry_key = ?",
    )
    .get(profile.token, ministryKey);
  if (exists)
    db.prepare(
      "DELETE FROM profile_follows WHERE profile_token = ? AND ministry_key = ?",
    ).run(profile.token, ministryKey);
  else
    db.prepare(
      "INSERT INTO profile_follows (profile_token, ministry_key, created_at) VALUES (?, ?, ?)",
    ).run(profile.token, ministryKey, Date.now());
  res.json({
    ok: true,
    profile: {
      ...profilePayload(profile.token),
      rank: profileRank(profile.token),
    },
  });
});
app.post("/api/public/memes/:id/like", ipModerationGate, rateLimit({ windowMs: 5 * 60 * 1000, max: 60, bucket: "like" }), (req, res) => {
  const memeId = numericMemeId(req.params.id);
  const profile = ensureProfile(publicProfileToken(req));
  const meme =
    memeId &&
    db
      .prepare(
        "SELECT id, likes FROM memes WHERE id = ? AND status = 'published'",
      )
      .get(memeId);
  if (!meme) return res.status(404).json({ message: "Meme not found." });
  const existing = db
    .prepare("SELECT 1 FROM meme_likes WHERE meme_id = ? AND profile_token = ?")
    .get(meme.id, profile.token);
  if (existing)
    db.prepare(
      "DELETE FROM meme_likes WHERE meme_id = ? AND profile_token = ?",
    ).run(meme.id, profile.token);
  else {
    db.prepare(
      "INSERT INTO meme_likes (meme_id, profile_token, created_at) VALUES (?, ?, ?)",
    ).run(meme.id, profile.token, Date.now());
    awardPoints(profile.token, 2);
  }
  const likes = db
    .prepare(
      "SELECT likes + (SELECT COUNT(*) FROM meme_likes WHERE meme_id = ?) AS likes FROM memes WHERE id = ?",
    )
    .get(meme.id, meme.id).likes;
  res.json({
    ok: true,
    liked: !existing,
    likes,
    profile: {
      ...profilePayload(profile.token),
      rank: profileRank(profile.token),
    },
    warning: res.locals.moderationWarning,
  });
});
app.post("/api/public/memes/:id/save", ipModerationGate, rateLimit({ windowMs: 5 * 60 * 1000, max: 60, bucket: "save" }), (req, res) => {
  const memeId=numericMemeId(req.params.id); const profile=ensureProfile(publicProfileToken(req));
  if(!memeId || !db.prepare("SELECT 1 FROM memes WHERE id=? AND status='published'").get(memeId)) return res.status(404).json({message:"Meme not found."});
  const existing=db.prepare("SELECT 1 FROM saved_memes WHERE meme_id=? AND profile_token=?").get(memeId,profile.token);
  if(existing) db.prepare("DELETE FROM saved_memes WHERE meme_id=? AND profile_token=?").run(memeId,profile.token); else db.prepare("INSERT INTO saved_memes (meme_id,profile_token,created_at) VALUES (?,?,?)").run(memeId,profile.token,Date.now());
  res.json({ok:true,saved:!existing,profile:{...profilePayload(profile.token),rank:profileRank(profile.token)},warning:res.locals.moderationWarning});
});
app.get("/api/public/memes/:id/comments", (req, res) => {
  const memeId = numericMemeId(req.params.id);
  if (
    !memeId ||
    !db
      .prepare("SELECT 1 FROM memes WHERE id = ? AND status = 'published'")
      .get(memeId)
  )
    return res.status(404).json({ message: "Meme not found." });
  res.json({ comments: getComments(memeId) });
});
app.post("/api/public/memes/:id/comments", ipModerationGate, rateLimit({ windowMs: 5 * 60 * 1000, max: 12, bucket: "comment" }), (req, res) => {
  const memeId = numericMemeId(req.params.id);
  const ip = httpClientIp(req);
  const profile = ensureProfile(
    publicProfileToken(req),
    req.body?.nickname,
    req.body?.avatar,
  );
  const rawText = String(req.body?.text || "")
    .trim()
    .slice(0, 280);
  const { text, flagged } = censorTextFlagged(rawText);
  if (
    !memeId ||
    !db
      .prepare("SELECT 1 FROM memes WHERE id = ? AND status = 'published'")
      .get(memeId)
  )
    return res.status(404).json({ message: "Meme not found." });
  if (!text)
    return res.status(400).json({ message: "Comment empty nahi ho sakta." });
  if (flagged) {
    const strike = warnIp(ip, "inappropriate comment text");
    if (strike.escalatedToBan)
      return res.status(403).json({
        message:
          "Baar-baar inappropriate comments ki wajah se aapka IP poori tarah ban ho gaya hai.",
      });
  }
  db.prepare(
    "INSERT INTO meme_comments (meme_id, profile_token, text, created_at) VALUES (?, ?, ?, ?)",
  ).run(memeId, profile.token, text, Date.now());
  awardPoints(profile.token, 3);
  res.json({
    ok: true,
    comments: getComments(memeId),
    profile: {
      ...profilePayload(profile.token),
      rank: profileRank(profile.token),
    },
    warning: flagged ? warningMessageFor(ip) : res.locals.moderationWarning,
  });
});
app.get("/api/public/memes/:id/court", (req, res) => {
  const memeId = numericMemeId(req.params.id);
  if (
    !memeId ||
    !db.prepare("SELECT 1 FROM memes WHERE id = ? AND status = 'published'").get(memeId)
  )
    return res.status(404).json({ message: "Meme not found." });
  const token = publicProfileToken(req);
  res.json({ ok: true, ...courtPayload(memeId, token) });
});
app.post(
  "/api/public/memes/:id/court",
  ipModerationGate,
  rateLimit({ windowMs: 10 * 60 * 1000, max: 40, bucket: "court" }),
  (req, res) => {
    const memeId = numericMemeId(req.params.id);
    const verdict = String(req.body?.verdict || "");
    if (!["guilty", "not_funny", "needs_punchline"].includes(verdict))
      return res.status(400).json({ message: "Invalid verdict." });
    if (
      !memeId ||
      !db.prepare("SELECT 1 FROM memes WHERE id = ? AND status = 'published'").get(memeId)
    )
      return res.status(404).json({ message: "Meme not found." });
    const profile = ensureProfile(publicProfileToken(req));
    const existing = db
      .prepare(
        "SELECT verdict FROM meme_court_votes WHERE meme_id = ? AND profile_token = ?",
      )
      .get(memeId, profile.token);
    if (!existing) awardPoints(profile.token, 1);
    db.prepare(
      "INSERT INTO meme_court_votes (meme_id, profile_token, verdict, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(meme_id, profile_token) DO UPDATE SET verdict = excluded.verdict, created_at = excluded.created_at",
    ).run(memeId, profile.token, verdict, Date.now());
    res.json({
      ok: true,
      ...courtPayload(memeId, profile.token),
      profile: { ...profilePayload(profile.token), rank: profileRank(profile.token) },
      warning: res.locals.moderationWarning,
    });
  },
);
app.get("/api/public/passport", (req, res) => {
  const token = publicProfileToken(req);
  res.json({ ok: true, passport: passportPayload(token) });
});
app.post("/api/public/passport/department", (req, res) => {
  const profile = ensureProfile(publicProfileToken(req));
  const key = String(req.body?.departmentKey || "").trim();
  if (key) {
    const valid = db.prepare("SELECT key FROM ministries WHERE key = ?").get(key);
    if (!valid) return res.status(400).json({ ok: false, error: "invalid_department" });
  }
  db.prepare(
    "UPDATE profiles SET favourite_department_override = ?, updated_at = ? WHERE token = ?",
  ).run(key, Date.now(), profile.token);
  res.json({ ok: true, passport: passportPayload(profile.token) });
});
app.get("/api/public/referral/visit", (req, res) => {
  const referrer = String(req.query.ref || "")
    .trim()
    .slice(0, 120);
  const visitor = publicProfileToken(req);
  if (
    referrer &&
    referrer !== visitor &&
    db.prepare("SELECT 1 FROM profiles WHERE token = ?").get(referrer)
  ) {
    const result = db
      .prepare(
        "INSERT OR IGNORE INTO referral_visits (referrer_token, visitor_token, created_at) VALUES (?, ?, ?)",
      )
      .run(referrer, visitor, Date.now());
    if (result.changes) awardPoints(referrer, 5);
  }
  res.json({ ok: true });
});
app.get("/api/public/submissions", (req,res)=>{ const token=publicProfileToken(req); res.json({submissions:db.prepare("SELECT p.id,p.title,p.category,p.creator,p.text,p.status,p.scope,p.created_at,p.reviewed_at,p.review_note,m.id AS published_meme_id,m.likes AS published_likes,m.plays AS published_plays FROM petitions p LEFT JOIN memes m ON m.petition_id=p.id AND m.status='published' WHERE p.creator_token=? ORDER BY p.created_at DESC").all(token)}); });
app.post("/api/public/generate", async (req, res) => {
  const topic = String(req.body?.topic || "Monday morning traffic").trim().slice(0, 160);
  const language = String(req.body?.language || "hinglish").toLowerCase();
  const labels = { hinglish: "Hinglish", english: "English", hindi: "Hindi", marathi: "Marathi", tamil: "Tamil", bengali: "Bengali" };
  if (process.env.OPENAI_API_KEY) {
    try {
      const base = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.9,
          max_tokens: 100,
          messages: [
            { role: "system", content: `Write one short, natural, funny Indian meme line in ${labels[language] || "Hinglish"}. Use native script where appropriate. No explanation, no hashtags.` },
            { role: "user", content: `Topic: ${topic}` },
          ],
        }),
      });
      const result = await response.json();
      const text = result.choices?.[0]?.message?.content?.trim();
      if (text) return res.json({ ok: true, text, source: "ai" });
    } catch {}
  }
  const fallbackTemplates = {
    marathi: [
      (t) => `${t} चा प्लॅन भारी होता, पण डेडलाईनने सगळा खेळ बिघडवला.`,
      (t) => `ताजी बातमी: ${t} मुळे चहाची तातडीची बैठक बोलावली गेली.`,
      (t) => `${t} सुरू होताच सगळ्यांनी तेच केलं जे नेहमी करतात — उद्यावर ढकललं.`,
    ],
    tamil: [
      (t) => `${t} திட்டம் செம்மையாக இருந்தது; ஆனால் deadline வந்து எல்லாவற்றையும் மாற்றிவிட்டது.`,
      (t) => `செய்தி: ${t} காரணமாக முழு குழுவும் அவசர meeting வைத்தது.`,
      (t) => `${t} தொடங்கியதும் எல்லோரும் செய்தது ஒன்றுதான் — "நாளை பார்க்கலாம்" என்று group-ல் போட்டது.`,
    ],
    bengali: [
      (t) => `${t}-এর প্ল্যান দারুণ ছিল, কিন্তু deadline এসে সব গুলিয়ে দিল।`,
      (t) => `ব্রেকিং নিউজ: ${t} নিয়ে পুরো গ্রুপ চ্যাটে জরুরি সভা বসেছে।`,
      (t) => `${t} শুরু হতেই সবাই একটাই কাজ করল — "কাল দেখা যাবে" বলে চ্যাটে পাঠিয়ে দিল।`,
    ],
    hindi: [
      (t) => `${t} का प्लान बहुत शानदार था, बस असली ज़िंदगी ने सहयोग नहीं किया।`,
      (t) => `ताज़ा खबर: ${t} के कारण पूरी चाय समिति की बैठक बुलानी पड़ी।`,
      (t) => `${t} शुरू होते ही सबने वही किया जो हमेशा करते हैं — कल पर टाल दिया।`,
    ],
    english: [
      (t) => `I had a plan for ${t}. Then reality opened the group chat.`,
      (t) => `${t}: because apparently normal solutions were too boring.`,
      (t) => `Breaking: local group chat declares a state of emergency over ${t}.`,
      (t) => `Step 1: encounter ${t}. Step 2: panic. Step 3: make chai. Step 4: still panic.`,
    ],
    hinglish: [
      (t) => `${t} ka plan simple tha: chai, thoda jugaad, aur deadline ko ignore karna.`,
      (t) => `Breaking news: ${t} ne poore group chat ko emergency meeting mein daal diya.`,
      (t) => `${t} shuru hote hi sabne ek hi kaam kiya — group mein "kal dekhte hain" bhej diya.`,
      (t) => `Scene: ${t}. Cut to: sab log chai bana rahe hain aur samasya waisi ki waisi hai.`,
    ],
  };
  const options = fallbackTemplates[language] || fallbackTemplates.hinglish;
  const text = options[Math.floor(Math.random() * options.length)](topic);
  res.json({ ok: true, text, source: "curated" });
});
app.post("/api/public/petitions", ipModerationGate, rateLimit({ windowMs: 30 * 60 * 1000, max: 6, bucket: "submission" }), (req, res) => {
  const ip = httpClientIp(req);
  const title = String(req.body?.title || "")
    .trim()
    .slice(0, 120);
  const rawText = String(req.body?.text || "")
    .trim()
    .slice(0, 800);
  const category = String(req.body?.category || "funny")
    .trim()
    .slice(0, 40);
  const creatorRaw = String(req.body?.creator || "")
    .trim()
    .slice(0, 60);
  const profile = ensureProfile(publicProfileToken(req));
  if (!title || !rawText)
    return res
      .status(400)
      .json({ message: "Title aur meme text dono zaroori hain." });
  const { text, flagged } = censorTextFlagged(rawText);
  if (flagged) {
    const strike = warnIp(ip, "inappropriate text in meme petition");
    if (strike.escalatedToBan)
      return res.status(403).json({
        message:
          "Baar-baar inappropriate content ki wajah se aapka IP poori tarah ban ho gaya hai.",
      });
  }
  const creator = creatorRaw
    ? creatorRaw.startsWith("@")
      ? creatorRaw
      : "@" + creatorRaw
    : "@anonymous";
  db.prepare(
    "INSERT INTO petitions (title, category, creator, text, creator_token, status, created_at, scope) VALUES (?, ?, ?, ?, ?, 'pending', ?, 'local')",
  ).run(title, category, creator, text, profile.token, Date.now());
  awardPoints(profile.token, 10);
  res.json({
    ok: true,
    message:
      "Petition file ho gayi — +10 karma points. Admin review ke baad feed me aa jaayegi.",
    profile: {
      ...profilePayload(profile.token),
      rank: profileRank(profile.token),
    },
    warning: flagged ? warningMessageFor(ip) : res.locals.moderationWarning,
  });
});

function maintenanceGate(req, res, next) {
  if (getSetting("maintenance_mode", "0") !== "1") return next();
  if (
    req.path.startsWith(ADMIN_ROUTE) ||
    req.path.startsWith("/api/") ||
    req.path === "/health" ||
    req.path.endsWith(".css") ||
    req.path.endsWith(".js")
  )
    return next();
  res.set("Cache-Control", "no-store");
  res
    .status(503)
    .send(
      `<!doctype html><meta charset="utf-8"><title>MemeMantri — Maintenance</title><body style="background:#0e100f;color:#f7f2e9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px"><div><h1>🛠 MemeMantri</h1><p>${censorText(getSetting("maintenance_message", "Site abhi maintenance mein hai."))}</p></div></body>`,
    );
}
app.use(maintenanceGate);
app.get("/m/:id", (req, res, next) => {
  const meme = publicMemeByShareId(req.params.id);
  if (!meme) return next();
  const protocol = String(req.headers["x-forwarded-proto"] || req.protocol)
    .split(",")[0]
    .trim();
  const publicUrl = `${protocol}://${req.get("host")}/m/${encodeURIComponent(String(meme.id))}`;
  const title = `${meme.title} — MemeMantri`;
  const description = String(meme.text || "").slice(0, 180);
  const metadata = `
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="MemeMantri">
    <meta property="og:title" content="${escapeHtmlAttribute(title)}">
    <meta property="og:description" content="${escapeHtmlAttribute(description)}">
    <meta property="og:url" content="${escapeHtmlAttribute(publicUrl)}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtmlAttribute(title)}">
    <meta name="twitter:description" content="${escapeHtmlAttribute(description)}">`;
  let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtmlAttribute(title)}</title>`,
  );
  html = html.replace(
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtmlAttribute(description)}">`,
  );
  html = html.replace("</head>", `${metadata}\n</head>`);
  res.set("Cache-Control", "public, max-age=60");
  res.type("html").send(html);
});
app.get("/sitemap.xml", (req, res) => {
  const protocol = String(req.headers["x-forwarded-proto"] || req.protocol)
    .split(",")[0]
    .trim();
  const base = `${protocol}://${req.get("host")}`;
  const urls = [
    `${base}/`,
    ...db
      .prepare(
        "SELECT id FROM memes WHERE status = 'published' ORDER BY id DESC",
      )
      .all()
      .map((row) => `${base}/m/${row.id}`),
  ];
  res
    .type("application/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escapeHtmlAttribute(url)}</loc></url>`).join("")}</urlset>`,
    );
});
app.get("/robots.txt", (_req, res) =>
  res.type("text").send("User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n"),
);
app.use(express.static(__dirname));
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "Meme Adda online matchmaking chat" }),
);

function clientSocketIp(socket) {
  return String(
    socket.handshake.headers["x-forwarded-for"] ||
      socket.handshake.address ||
      "unknown",
  )
    .split(",")[0]
    .trim();
}
function randomName() {
  return (
    names[Math.floor(Math.random() * names.length)] +
    " #" +
    Math.floor(10 + Math.random() * 90)
  );
}
function publicChannels() {
  return [...channels.values()]
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      members: channel.members.size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function broadcastPresence() {
  io.emit("presence:update", { onlineCount: onlineCount() });
}
function channelPayload(channel) {
  return { id: channel.id, name: channel.name, members: channel.members.size };
}
function leaveChannel(socket, notify = true) {
  const id = socket.data.channelId;
  if (!id) return;
  const channel = channels.get(id);
  socket.data.channelId = null;
  if (!channel) return;
  channel.members.delete(socket.id);
  if (notify) io.to(id).emit("channel:members", channelPayload(channel));
  if (!channel.members.size) channels.delete(id);
}
function uniqueChannelId() {
  return `channel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function safeChannelName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 50);
}
function removeFromWaiting(socketId) {
  const index = waiting.indexOf(socketId);
  if (index >= 0) waiting.splice(index, 1);
}
function sanitizeContext(payload = {}) {
  const mode = ["chat", "debate", "meme"].includes(payload.mode)
    ? payload.mode
    : "chat";
  const topic =
    typeof payload.topic === "string" ? payload.topic.trim().slice(0, 160) : "";
  const meme =
    payload.meme && typeof payload.meme === "object"
      ? {
          title: String(payload.meme.title || "Selected meme").slice(0, 160),
          text: String(payload.meme.text || "").slice(0, 700),
        }
      : null;
  return { mode, topic, meme };
}
function clearInvite(inviteId, notify = false) {
  const invite = pendingInvites.get(inviteId);
  if (!invite) return;
  pendingInvites.delete(inviteId);
  inviteBySocket.delete(invite.a);
  inviteBySocket.delete(invite.b);
  if (notify) {
    const a = io.sockets.sockets.get(invite.a);
    const b = io.sockets.sockets.get(invite.b);
    if (a) a.emit("adda:invite-rejected");
    if (b) b.emit("adda:invite-rejected");
  }
}
function makeInvite(a, b, context) {
  const inviteId = `invite_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const invite = { inviteId, a: a.id, b: b.id, context, accepted: new Set() };
  pendingInvites.set(inviteId, invite);
  inviteBySocket.set(a.id, inviteId);
  inviteBySocket.set(b.id, inviteId);
  a.emit("adda:invite", {
    inviteId,
    partnerName: b.data.displayName,
    ...context,
  });
  b.emit("adda:invite", {
    inviteId,
    partnerName: a.data.displayName,
    ...context,
  });
}
function isBlockedPair(tokenA, tokenB) {
  if (!tokenA || !tokenB) return false;
  return !!db
    .prepare(
      "SELECT 1 FROM adda_blocks WHERE (blocker_token = ? AND blocked_token = ?) OR (blocker_token = ? AND blocked_token = ?)",
    )
    .get(tokenA, tokenB, tokenB, tokenA);
}
function findMatch(socket, payload) {
  removeFromWaiting(socket.id);
  const context = sanitizeContext(payload);
  let matchId;
  for (let i = 0; i < waiting.length; i += 1) {
    const candidate = io.sockets.sockets.get(waiting[i]);
    if (!candidate) {
      waiting.splice(i, 1);
      i -= 1;
      continue;
    }
    if (
      candidate.data.mode === context.mode &&
      !isBlockedPair(socket.data.profileToken, candidate.data.profileToken)
    ) {
      matchId = candidate.id;
      waiting.splice(i, 1);
      break;
    }
  }
  if (!matchId) {
    socket.data.mode = context.mode;
    socket.data.context = context;
    waiting.push(socket.id);
    socket.emit("adda:waiting", { mode: context.mode });
    return;
  }
  const other = io.sockets.sockets.get(matchId);
  if (!other) {
    waiting.push(socket.id);
    socket.emit("adda:waiting", { mode: context.mode });
    return;
  }
  const merged = other.data.context || context;
  makeInvite(other, socket, {
    mode: context.mode,
    topic: context.topic || merged.topic,
    meme: context.meme || merged.meme,
  });
}
function leaveSession(socket, notifyPartner = true) {
  removeFromWaiting(socket.id);
  const inviteId = inviteBySocket.get(socket.id);
  if (inviteId) clearInvite(inviteId, true);
  const partnerId = partnerOf.get(socket.id);
  partnerOf.delete(socket.id);
  if (!partnerId) return;
  partnerOf.delete(partnerId);
  const partner = io.sockets.sockets.get(partnerId);
  if (partner && notifyPartner) partner.emit("adda:partner-left");
}
function establishPair(invite) {
  const a = io.sockets.sockets.get(invite.a);
  const b = io.sockets.sockets.get(invite.b);
  if (!a || !b) {
    clearInvite(invite.inviteId, true);
    return;
  }
  partnerOf.set(a.id, b.id);
  partnerOf.set(b.id, a.id);
  pendingInvites.delete(invite.inviteId);
  inviteBySocket.delete(a.id);
  inviteBySocket.delete(b.id);
  const payload = {
    mode: invite.context.mode,
    topic: invite.context.topic,
    meme: invite.context.meme,
  };
  a.emit("adda:paired", { partnerName: b.data.displayName, ...payload });
  b.emit("adda:paired", { partnerName: a.data.displayName, ...payload });
}

io.use((socket, next) => {
  if (isIpBanned(clientSocketIp(socket))) return next(new Error("banned"));
  next();
});
io.on("connection", (socket) => {
  socket.data.displayName = randomName();
  socket.on("channel:list", () =>
    socket.emit("channel:list", publicChannels()),
  );
  socket.on("channel:create", (payload) => {
    const name = safeChannelName(payload?.name);
    if (!name)
      return socket.emit("channel:error", {
        message: "Channel name required hai.",
      });
    const duplicate = [...channels.values()].find(
      (channel) => channel.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate)
      return socket.emit("channel:error", {
        message: "Is naam ka channel already exist karta hai.",
      });
    const channel = { id: uniqueChannelId(), name, members: new Set() };
    channels.set(channel.id, channel);
    socket.emit("channel:created", channelPayload(channel));
    io.emit("channel:list", publicChannels());
  });
  socket.on("channel:join", (payload) => {
    const channel = channels.get(String(payload?.id || ""));
    if (!channel)
      return socket.emit("channel:error", {
        message: "Channel nahi mila. List refresh karo.",
      });
    leaveChannel(socket, false);
    channel.members.add(socket.id);
    socket.join(channel.id);
    socket.data.channelId = channel.id;
    socket.emit("channel:joined", channelPayload(channel));
    io.to(channel.id).emit("channel:members", channelPayload(channel));
  });
  socket.on("channel:leave", () => {
    const id = socket.data.channelId;
    leaveChannel(socket);
    if (id) socket.leave(id);
    socket.emit("channel:left");
    io.emit("channel:list", publicChannels());
  });
  socket.on("channel:message", (payload) => {
    const id = socket.data.channelId;
    const channel = channels.get(id);
    if (!channel || !channel.members.has(socket.id)) return;
    const message = String(payload?.text || "")
      .trim()
      .slice(0, 500);
    if (!message) return;
    const { text, flagged } = censorTextFlagged(message);
    if (flagged) {
      const strike = warnIp(clientSocketIp(socket), "inappropriate channel message");
      if (strike.escalatedToBan) return socket.disconnect(true);
      const warning = warningMessageFor(clientSocketIp(socket));
      if (warning) socket.emit("moderation:warning", { message: warning });
    }
    io.to(id)
      .except(socket.id)
      .emit("channel:message", {
        fromName: socket.data.displayName,
        text,
      });
  });
  socket.data.voiceBattleToken = String(
    socket.handshake.auth?.voiceBattleToken ||
      crypto.randomBytes(18).toString("hex"),
  ).slice(0, 120);
  socket.data.profileToken = String(
    socket.handshake.auth?.profileToken || socket.data.voiceBattleToken,
  ).slice(0, 120);
  ensureProfile(socket.data.profileToken);
  broadcastPresence();
  socket.on("battle:state", () =>
    socket.emit("battle:state", voiceBattleState(socket)),
  );
  socket.on("battle:submit", (payload) => {
    const contest = ensureVoiceContest();
    const total = db
      .prepare(
        "SELECT COUNT(*) AS count FROM voice_submissions WHERE contest_id = ?",
      )
      .get(contest.id).count;
    if (total >= 2)
      return socket.emit("battle:error", {
        message:
          "Is 24-hour VoiceMantri contest ke dono slots fill ho chuke hain.",
      });
    if (
      db
        .prepare(
          "SELECT 1 FROM voice_submissions WHERE contest_id = ? AND owner_token = ?",
        )
        .get(contest.id, socket.data.voiceBattleToken)
    )
      return socket.emit("battle:error", {
        message: "Aap is contest mein already ek meme submit kar chuke ho.",
      });
    const author = String(payload?.handle || "")
      .trim()
      .replace(/^@+/, "@")
      .slice(0, 60);
    const title = String(payload?.title || "")
      .trim()
      .slice(0, 120);
    const memeText = String(payload?.text || "")
      .trim()
      .slice(0, 700);
    if (!author || !title || !memeText)
      return socket.emit("battle:error", {
        message: "Name/handle, title aur meme text required hain.",
      });
    const slot = total === 0 ? "A" : "B";
    if (total === 0 && contest.starts_at === 0) activateVoiceContest(contest.id);
    db.prepare(
      "INSERT INTO voice_submissions (contest_id, slot, owner_token, author, title, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      contest.id,
      slot,
      socket.data.voiceBattleToken,
      author,
      title,
      memeText,
      Date.now(),
    );
    awardPoints(socket.data.profileToken, 15);
    socket.emit("battle:submitted");
    broadcastVoiceBattle();
    socket.emit("profile:update", profilePayload(socket.data.profileToken));
  });
  socket.on("battle:vote", (payload) => {
    const contest = ensureVoiceContest();
    const submission = db
      .prepare(
        "SELECT * FROM voice_submissions WHERE id = ? AND contest_id = ?",
      )
      .get(Number(payload?.submissionId), contest.id);
    if (!submission)
      return socket.emit("battle:error", {
        message: "Ye meme current contest ka hissa nahi hai.",
      });
    if (submission.owner_token === socket.data.voiceBattleToken)
      return socket.emit("battle:error", {
        message: "Aap apne khud ke meme ko vote nahi kar sakte.",
      });
    if (
      db
        .prepare(
          "SELECT 1 FROM voice_votes WHERE contest_id = ? AND voter_token = ?",
        )
        .get(contest.id, socket.data.voiceBattleToken)
    )
      return socket.emit("battle:error", {
        message: "Aap is contest mein already vote kar chuke ho.",
      });
    if (
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM voice_submissions WHERE contest_id = ?",
        )
        .get(contest.id).count < 2
    )
      return socket.emit("battle:error", {
        message: "Voting tab shuru hogi jab dono users meme submit kar denge.",
      });
    const vote = db.transaction(() => {
      db.prepare(
        "INSERT INTO voice_votes (contest_id, submission_id, voter_token, created_at) VALUES (?, ?, ?, ?)",
      ).run(
        contest.id,
        submission.id,
        socket.data.voiceBattleToken,
        Date.now(),
      );
      db.prepare(
        "UPDATE voice_submissions SET votes = votes + 1 WHERE id = ?",
      ).run(submission.id);
    });
    vote();
    awardPoints(socket.data.profileToken, 4);
    socket.emit("battle:vote-accepted");
    broadcastVoiceBattle();
    socket.emit("profile:update", profilePayload(socket.data.profileToken));
  });
  socket.on("adda:find", (payload) => {
    const channelId = socket.data.channelId;
    if (channelId) {
      leaveChannel(socket);
      socket.leave(channelId);
      socket.emit("channel:left");
      io.emit("channel:list", publicChannels());
    }
    leaveSession(socket, true);
    findMatch(socket, payload);
  });
  socket.on("adda:accept", ({ inviteId } = {}) => {
    const invite = pendingInvites.get(inviteId);
    if (!invite || (invite.a !== socket.id && invite.b !== socket.id)) return;
    invite.accepted.add(socket.id);
    socket.emit("adda:accepted", { inviteId });
    if (invite.accepted.size === 2) establishPair(invite);
  });
  socket.on("adda:reject", ({ inviteId } = {}) => {
    const invite = pendingInvites.get(inviteId);
    if (!invite || (invite.a !== socket.id && invite.b !== socket.id)) return;
    const otherId = invite.a === socket.id ? invite.b : invite.a;
    const other = io.sockets.sockets.get(otherId);
    if (other) other.emit("adda:invite-rejected");
    clearInvite(inviteId, false);
    socket.emit("adda:invite-rejected");
  });
  socket.on("adda:message", (payload) => {
    const partnerId = partnerOf.get(socket.id);
    const partner = partnerId && io.sockets.sockets.get(partnerId);
    if (!partner || !payload || typeof payload !== "object") return;
    if (payload.kind === "meme" && payload.meme) {
      partner.emit("adda:message", {
        kind: "meme",
        fromName: socket.data.displayName,
        meme: {
          title: String(payload.meme.title || "Selected meme").slice(0, 160),
          text: String(payload.meme.text || "").slice(0, 700),
        },
      });
    } else if (typeof payload.text === "string") {
      const raw = payload.text.trim().slice(0, 500);
      if (!raw) return;
      const { text, flagged } = censorTextFlagged(raw);
      if (flagged) {
        const strike = warnIp(clientSocketIp(socket), "inappropriate Meme Adda message");
        if (strike.escalatedToBan) return socket.disconnect(true);
        const warning = warningMessageFor(clientSocketIp(socket));
        if (warning) socket.emit("moderation:warning", { message: warning });
      }
      partner.emit("adda:message", {
        kind: "text",
        fromName: socket.data.displayName,
        text,
      });
    }
  });
  /* Report the current chat partner. Recorded against both their
     profile token and IP; enough reports/strikes escalate the reported
     IP straight to a full ban via the shared warnIp() pipeline. */
  socket.on("adda:report", (payload) => {
    const partnerId = partnerOf.get(socket.id);
    const partner = partnerId && io.sockets.sockets.get(partnerId);
    if (!partner) return socket.emit("adda:report-ack", { ok: false, message: "Koi active partner nahi mila." });
    const reason = String(payload?.reason || "other").trim().slice(0, 60);
    const detail = String(payload?.detail || "").trim().slice(0, 300) || null;
    db.prepare(
      "INSERT INTO adda_reports (reporter_token, reported_token, reported_ip, reason, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      socket.data.profileToken,
      partner.data.profileToken || null,
      clientSocketIp(partner),
      reason,
      detail,
      Date.now(),
    );
    const strike = warnIp(
      clientSocketIp(partner),
      `reported in Meme Adda: ${reason}${detail ? ` (${detail})` : ""}`,
    );
    if (strike.escalatedToBan) partner.disconnect(true);
    socket.emit("adda:report-ack", { ok: true, message: "Report darj ho gaya. Team review karegi." });
  });
  /* Permanently avoid being re-matched with this partner. Blocks are
     stored per profile-token pair so they persist across reconnects. */
  socket.on("adda:block", () => {
    const partnerId = partnerOf.get(socket.id);
    const partner = partnerId && io.sockets.sockets.get(partnerId);
    if (!partner || !socket.data.profileToken || !partner.data.profileToken)
      return socket.emit("adda:block-ack", { ok: false, message: "Koi active partner nahi mila." });
    db.prepare(
      "INSERT OR IGNORE INTO adda_blocks (blocker_token, blocked_token, created_at) VALUES (?, ?, ?)",
    ).run(socket.data.profileToken, partner.data.profileToken, Date.now());
    socket.emit("adda:block-ack", { ok: true, message: "Ye user ab dobara match nahi hoga." });
  });

  socket.on("adda:call-request", () => {
    const partnerId = partnerOf.get(socket.id);
    const partner = partnerId && io.sockets.sockets.get(partnerId);
    if (!partner)
      return socket.emit("adda:call-failed", {
        message: "Partner ab connected nahi hai.",
      });
    socket.data.callRequested = true;
    partner.emit("adda:call-request", { fromName: socket.data.displayName });
  });
  socket.on("adda:call-accept", () => {
    const partnerId = partnerOf.get(socket.id);
    const partner = partnerId && io.sockets.sockets.get(partnerId);
    if (!partner || !partner.data.callRequested) {
      // Stale/expired call request (partner already left, reconnected, or
      // cancelled) — previously this returned silently and the person who
      // hit Accept saw nothing happen at all.
      return socket.emit("adda:call-failed", {
        message: "Ye call ab valid nahi hai — partner disconnect ho gaya tha.",
      });
    }
    socket.data.inCall = true;
    partner.data.inCall = true;
    partner.data.callRequested = false;
    socket.data.callRequested = false;
    socket.emit("adda:call-start", { initiator: true });
    partner.emit("adda:call-start", { initiator: false });
  });
  socket.on("adda:call-reject", () => {
    const partnerId = partnerOf.get(socket.id);
    const partner = partnerId && io.sockets.sockets.get(partnerId);
    socket.data.callRequested = false;
    if (partner) {
      partner.data.callRequested = false;
      partner.emit("adda:call-rejected");
    }
  });
  socket.on("adda:call-signal", (payload) => {
    const partnerId = partnerOf.get(socket.id);
    const partner = partnerId && io.sockets.sockets.get(partnerId);
    if (!partner || !payload || typeof payload !== "object") return;
    partner.emit("adda:call-signal", payload);
  });
  socket.on("adda:call-end", () => {
    const partnerId = partnerOf.get(socket.id);
    const partner = partnerId && io.sockets.sockets.get(partnerId);
    socket.data.inCall = false;
    socket.data.callRequested = false;
    if (partner) {
      partner.data.inCall = false;
      partner.data.callRequested = false;
      partner.emit("adda:call-end");
    }
  });
  socket.on("adda:leave", () => leaveSession(socket));
  socket.on("disconnect", () => {
    leaveChannel(socket);
    leaveSession(socket);
    broadcastPresence();
  });
});

httpServer.listen(PORT, () =>
  console.log(`MemeMantri online server running on http://localhost:${PORT}`),
);
