/* =========================================================================
   MemeMantri — mm.js
   CHANGES IN THIS VERSION:
   1. Fixed a real bug: the voice <select> dropdowns were populated from
      VOICE_STYLES (ids like "anchor","hero"...) but speak() looked up
      voices from a different object keyed by "news_anchor","radio_jockey"...
      So the voice you picked was NEVER actually used. Fixed by using one
      single VOICES array as the source of truth everywhere.
   2. Added 16 Indian/Hindi-oriented browser voice personas. The browser
      selects the best installed Hindi/Indian voice and tunes pitch/rate.
   3. Removed two dead lines (`#seats`, `#badges`) that referenced
      elements not present in the HTML — they were throwing errors and
      could silently break every script below them (generator, submit,
      smooth-scroll).
   4. Added Indian city/state memes and a dedicated Hindi (Devanagari) meme category;
      all international and universal content lives in global.js/global.html.
   5. Added "Meme Adda" — random-pairing chat + meme-sharing + debate
      feature using Socket.IO. Needs a small backend addition — see
      CHAT_SERVER_SETUP.md for the chat-server setup.
   6. FIX (this patch): added the missing exportGeneratedMeme() function.
      The "🖼️ Save as image" button next to the generator called
      exportGeneratedMeme() but that function was never defined anywhere
      in the file, so every click crashed with
      "Uncaught ReferenceError: exportGeneratedMeme is not defined" and
      no image was ever produced. Nothing else was touched.
   ========================================================================= */

/* ---------------------------------------------------------------------
   VOICES — one persona, two genders each = 16 real Indian voices.
   Replace every "REPLACE_WITH_..." with a real voice ID from your TTS
   provider. On ElevenLabs, search their Voice Library for Indian /
   Hindi-accented voices (filter by language "Hindi" or accent "Indian"),
   pick a male and a female voice per persona, and paste the voice_id.
   --------------------------------------------------------------------- */
const VOICES = [
  {
    id: "anchor_m",
    persona: "News Anchor",
    gender: "male",
    emoji: "🎙️",
    lang: "en-IN",
    pitch: 0.92,
    rate: 0.94,
    patterns: ["en-in", "india", "male", "ravi", "hemant", "prabhat"],
    pause: 220,
  },
  {
    id: "anchor_f",
    persona: "News Anchor",
    gender: "female",
    emoji: "🎙️",
    lang: "hi-IN",
    pitch: 1.08,
    rate: 0.93,
    patterns: ["hindi", "india", "hi-in", "heera"],
    pause: 240,
  },
  {
    id: "rj_m",
    persona: "Radio Jockey",
    gender: "male",
    emoji: "📻",
    lang: "hi-IN",
    pitch: 1.02,
    rate: 1.04,
    patterns: ["hindi", "india", "hi-in", "ravi"],
    pause: 200,
  },
  {
    id: "rj_f",
    persona: "Radio Jockey",
    gender: "female",
    emoji: "📻",
    lang: "hi-IN",
    pitch: 1.16,
    rate: 1.05,
    patterns: ["hindi", "india", "hi-in", "heera"],
    pause: 240,
  },
  {
    id: "bolly_m",
    persona: "Bollywood Narrator",
    gender: "male",
    emoji: "🎬",
    lang: "hi-IN",
    pitch: 0.82,
    rate: 0.88,
    patterns: ["hindi", "india", "hi-in", "ravi"],
    pause: 200,
  },
  {
    id: "bolly_f",
    persona: "Bollywood Narrator",
    gender: "female",
    emoji: "🎬",
    lang: "hi-IN",
    pitch: 1.22,
    rate: 0.9,
    patterns: ["hindi", "india", "hi-in", "heera"],
    pause: 240,
  },
  {
    id: "cric_m",
    persona: "Cricket Commentator",
    gender: "male",
    emoji: "🏏",
    lang: "en-IN",
    pitch: 0.9,
    rate: 1.08,
    patterns: ["en-in", "india", "ravi"],
    pause: 180,
  },
  {
    id: "cric_f",
    persona: "Cricket Commentator",
    gender: "female",
    emoji: "🏏",
    lang: "en-IN",
    pitch: 1.1,
    rate: 1.06,
    patterns: ["en-in", "india", "heera"],
    pause: 190,
  },
  {
    id: "comic_m",
    persona: "Stand-up Comic",
    gender: "male",
    emoji: "😂",
    lang: "hi-IN",
    pitch: 1.0,
    rate: 0.98,
    patterns: ["hindi", "india", "hi-in", "ravi"],
    pause: 200,
  },
  {
    id: "comic_f",
    persona: "Stand-up Comic",
    gender: "female",
    emoji: "😂",
    lang: "hi-IN",
    pitch: 1.2,
    rate: 0.98,
    patterns: ["hindi", "india", "hi-in", "heera"],
    pause: 240,
  },
  {
    id: "roast_m",
    persona: "Roast Master",
    gender: "male",
    emoji: "🔥",
    lang: "en-IN",
    pitch: 0.78,
    rate: 1.02,
    patterns: ["en-in", "india", "male", "ravi", "prabhat"],
    pause: 200,
  },
  {
    id: "roast_f",
    persona: "Roast Master",
    gender: "female",
    emoji: "🔥",
    lang: "hi-IN",
    pitch: 1.15,
    rate: 1.02,
    patterns: ["hindi", "india", "hi-in", "heera"],
    pause: 240,
  },
  {
    id: "uncle_m",
    persona: "Desi Uncle",
    gender: "male",
    emoji: "👴",
    lang: "hi-IN",
    pitch: 0.72,
    rate: 0.86,
    patterns: ["hindi", "india", "hi-in", "ravi"],
    pause: 200,
  },
  {
    id: "aunty_f",
    persona: "Desi Aunty",
    gender: "female",
    emoji: "👵",
    lang: "hi-IN",
    pitch: 1.28,
    rate: 0.87,
    patterns: ["hindi", "india", "hi-in", "heera"],
    pause: 240,
  },
  {
    id: "dada_m",
    persona: "Dada Storyteller",
    gender: "male",
    emoji: "👴",
    lang: "hi-IN",
    pitch: 0.68,
    rate: 0.78,
    patterns: ["hindi", "india", "hi-in", "ravi"],
    pause: 200,
  },
  {
    id: "dadi_f",
    persona: "Dadi Storyteller",
    gender: "female",
    emoji: "👵",
    lang: "hi-IN",
    pitch: 1.12,
    rate: 0.8,
    patterns: ["hindi", "india", "hi-in", "heera"],
    pause: 240,
  },
];

let CATEGORIES = [
  ["all", "All India", "🇮🇳"],
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

const MEMES = [
  {
    id: "m1",
    title: "Breaking: Student Opens Book",
    category: "student",
    creator: "@sarkari_savage",
    likes: 12400,
    plays: 88200,
    text: "Breaking news! A local engineering student has opened a textbook for the first time in six months. Scientists say the dust cloud was visible from space.",
  },
  {
    id: "m2",
    title: "Chai Over Everything",
    category: "desi",
    creator: "@chaiwala_coder",
    likes: 9800,
    plays: 60110,
    text: "Indian problem-solving flowchart. Step one: drink chai. Step two: discuss problem for two hours. Step three: drink more chai. Problem still unsolved, but friendship level maximum.",
  },
  {
    id: "m3",
    title: "Last Over Panic",
    category: "cricket",
    creator: "@gully_gavaskar",
    likes: 15200,
    plays: 120300,
    text: "Eighteen runs needed off six balls, and my heart is playing its own match. The bowler is nervous, the batsman is nervous, but my mother is calmly asking if I have eaten dinner.",
  },
  {
    id: "m4",
    title: "It Works On My Machine",
    category: "tech",
    creator: "@semicolon_sardar",
    likes: 21100,
    plays: 143000,
    text: "The developer said, it works on my machine. So the manager shipped the machine to production. And that, my friends, is how cloud computing was invented in India.",
  },
  {
    id: "m5",
    title: "Manifesto Of Memes",
    category: "politics",
    creator: "@meme_neta",
    likes: 30400,
    plays: 288000,
    text: "My fellow citizens! If elected, I promise free WiFi in every classroom, and mandatory nap time after lunch. Vote for me, and I shall make the syllabus fifty percent shorter!",
  },
  {
    id: "m6",
    title: "Bollywood Slow Motion",
    category: "bollywood",
    creator: "@filmy_frames",
    likes: 18700,
    plays: 99000,
    text: "He walks in slow motion. The wind blows. Three hundred goons attack. He removes his sunglasses. Physics resigns and leaves the theatre quietly.",
  },
  {
    id: "m7",
    title: "Situationship Status",
    category: "love",
    creator: "@delulu_dilse",
    likes: 25600,
    plays: 176000,
    text: "We are not dating. We are not friends. We are in a quantum state of a relationship. Observation collapses it into ignored messages.",
  },
  {
    id: "m8",
    title: "One More Match",
    category: "gaming",
    creator: "@noob_nawab",
    likes: 14300,
    plays: 87000,
    text: "It is two in the morning. He says just one more match. Six matches later, the sun rises, the rank drops, and the mother enters with the legendary slipper of judgement.",
  },
  {
    id: "m9",
    title: "Physics Ka Pyaar",
    category: "science",
    creator: "@lab_lafanga",
    likes: 11200,
    plays: 65400,
    text: "Newton's fourth law, discovered in India. Every action has an equal and opposite relative who compares your marks with the neighbour's child.",
  },
  {
    id: "m10",
    title: "Aura Farming",
    category: "genz",
    creator: "@vibecheck_vishal",
    likes: 33200,
    plays: 240100,
    text: "He did not study, he did not revise, he did not even bring a pen. He walked into the exam hall with pure vibes and left with pure trauma. Absolute aura, zero marks.",
  },
  {
    id: "m11",
    title: "Uncle Ki Advice",
    category: "funny",
    creator: "@whatsapp_university",
    likes: 27800,
    plays: 198000,
    text: "Beta, in our time we walked twenty kilometres to school, uphill, both directions, without shoes, and still topped the class. Also beta, please recharge my phone, I cannot find the button.",
  },
  {
    id: "m12",
    title: "Trending On Every App",
    category: "trending",
    creator: "@reel_rishi",
    likes: 41000,
    plays: 320000,
    text: "Today's trend is doing nothing productive, but filming it in cinematic mode with sad background music. Congratulations, you are now a content creator.",
  },

  /* ---- pure Hindi (Devanagari) memes ---- */
  {
    id: "h1",
    title: "सोमवार का सन्नाटा",
    category: "hindi",
    creator: "@dilli_ka_dimaag",
    likes: 13500,
    plays: 62000,
    text: "सोमवार सुबह अलार्म बजते ही शरीर कहता है, अभी नहीं, बस पांच मिनट और। दो घंटे बाद वही पांच मिनट, तब तक ऑफिस पहुंचने की सारी योजना बदल चुकी होती है।",
  },
  {
    id: "h2",
    title: "मम्मी का सीसीटीवी",
    category: "hindi",
    creator: "@ghar_ki_khabrein",
    likes: 18900,
    plays: 91000,
    text: "घर में मम्मी से बड़ा कोई जासूस नहीं होता। कमरे का दरवाज़ा बंद करते ही आवाज़ आती है, अंदर क्या कर रहे हो, दरवाज़ा क्यों बंद किया है?",
  },
  {
    id: "h3",
    title: "परीक्षा से एक रात पहले",
    category: "hindi",
    creator: "@topper_ki_tabahi",
    likes: 21400,
    plays: 105000,
    text: "परीक्षा से एक रात पहले अचानक कमरा साफ करने का मन करता है, अलमारी व्यवस्थित होती है, और पूरा सिलेबस एक ही रात में खत्म करने का हौसला अचानक जाग जाता है।",
  },
  {
    id: "h4",
    title: "पड़ोसी का बेटा",
    category: "hindi",
    creator: "@tulna_ka_tandav",
    likes: 16700,
    plays: 78000,
    text: "हर घर में एक काल्पनिक किरदार होता है, पड़ोसी का बेटा, जो हमेशा टॉप करता है, हमेशा समय पर सोता है, और कभी मोबाइल नहीं चलाता।",
  },
];

const EXTRA_MEMES = [
  {
    id: "h5",
    title: "ऑनलाइन क्लास का कैमरा",
    category: "hindi",
    creator: "@mute_mode_maharaj",
    likes: 19800,
    plays: 93000,
    text: "ऑनलाइन क्लास में कैमरा बंद था, माइक्रोफोन बंद था, लेकिन मम्मी की आवाज़ पूरे लेक्चर में लाइव थी।",
  },
  {
    id: "h6",
    title: "चाय और बारिश",
    category: "hindi",
    creator: "@baarish_babu",
    likes: 17600,
    plays: 81000,
    text: "बारिश शुरू होते ही भारतीय मन में दो विचार आते हैं: पकौड़े बनेंगे और आज काम बिल्कुल नहीं होगा।",
  },
  {
    id: "r1",
    title: "Mumbai Local Olympics",
    category: "desi",
    creator: "@platform_pundit",
    likes: 14500,
    plays: 69000,
    text: "Mumbai local mein seat milna koi coincidence nahi, ye timing, strategy aur halka sa Olympic-level shoulder movement ka result hai.",
  },
  {
    id: "r2",
    title: "Bengaluru Traffic Meditation",
    category: "desi",
    creator: "@silicon_samosa",
    likes: 16300,
    plays: 74000,
    text: "Bengaluru traffic ne mujhe patience, podcast aur ek hi signal par teen naye life goals de diye.",
  },
  {
    id: "r3",
    title: "Chennai Heat Mode",
    category: "desi",
    creator: "@filtercoffee_fury",
    likes: 12100,
    plays: 55000,
    text: "Chennai ki garmi mein phone bhi bolta hai: bhai mujhe charge mat karo, main already 100 percent emotional hoon.",
  },
  {
    id: "r4",
    title: "Kolkata Adda",
    category: "desi",
    creator: "@adda_archivist",
    likes: 13200,
    plays: 58000,
    text: "Kolkata adda starts with one question and ends three hours later with politics, poetry, football and no final answer.",
  },
  {
    id: "r5",
    title: "Punjabi Wedding Budget",
    category: "desi",
    creator: "@dhol_department",
    likes: 18700,
    plays: 88000,
    text: "Punjabi wedding budget: 20 percent food, 10 percent venue, 70 percent proving that the DJ can hear us from the next district.",
  },
];

const INDIAN_CATEGORIES = new Set([
  "funny",
  "trending",
  "desi",
  "hindi",
  "genz",
  "bollywood",
  "cricket",
  "politics",
  "science",
  "tech",
  "gaming",
  "love",
  "student",
]);
let MAIN_MEMES = MEMES.concat(EXTRA_MEMES).filter((m) =>
  INDIAN_CATEGORIES.has(m.category),
);
let motdPinnedId = null;

const ARENAS = [
  ["😂 Laugh Sabha", "a-orange", "comic_m"],
  ["🤣 Party Firki", "a-green", "comic_f"],
  ["🅱️ Free Bekari", "a-blue", "anchor_f"],
  ["🔴 Zero% Vaada", "a-red", "roast_m"],
];

const ROASTS = [
  "Our opponents promised roads. They delivered potholes with premium seating.",
  "They said they would digitise the village. Now even the buffalo has a QR code.",
  "Their manifesto had four hundred pages. Three hundred ninety nine were photographs of themselves.",
  "They promised twenty-four hour electricity. Technically true, spread across one full week.",
];
const TICKER = [
  "BREAKING: Local student opens book after 6 months",
  "EXCLUSIVE: Chai declared official debugging tool",
  "LIVE: Meme Parliament passes bill for shorter syllabus",
  "ALERT: Desi uncle forwards 47 good-morning memes",
  "BREAKING: Indian WiFi router receives family blessings in twelve languages",
];

/* ---- local storage helpers (likes, plays, liked-state, user memes) ---- */
const LS_KEYS = {
  likeExtra: "mv_like_extra",
  likedIds: "mv_liked_ids",
  savedIds: "mv_saved_ids",
  playExtra: "mv_play_extra",
  userMemes: "mv_user_memes",
  profileToken: "mm_profile_token",
  profile: "mm_profile_cache",
  alerts: "mm_alerts_enabled",
};
let profileToken = localStorage.getItem(LS_KEYS.profileToken) || "";
// Identity is now server-issued and stored in an HttpOnly citizen cookie; localStorage is only a migration hint.
async function hydrateCitizenIdentity() {
  try {
    const res = await fetch("/api/public/identity", {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (data.token) {
      profileToken = data.token;
      localStorage.setItem(LS_KEYS.profileToken, profileToken);
    }
  } catch {}
}
let communityState = loadJSON(LS_KEYS.profile, null);

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v || fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

let likeExtra = loadJSON(LS_KEYS.likeExtra, {});
let likedIds = new Set(loadJSON(LS_KEYS.likedIds, []));
let savedIds = new Set(loadJSON(LS_KEYS.savedIds, []));
let playExtra = loadJSON(LS_KEYS.playExtra, {});
let userMemes = loadJSON(LS_KEYS.userMemes, []);
let serverUserMemes = [];
let serverUserPetitions = [];
let userPetitionsOnly = false;

function getAllMemes() {
  const all = MAIN_MEMES.concat(
    userMemes.filter((m) => INDIAN_CATEGORIES.has(m.category)),
    serverUserMemes,
  );
  const follows = currentProfile()?.follows || [];
  return follows.length
    ? all
        .slice()
        .sort(
          (left, right) =>
            Number(follows.includes(right.category)) -
            Number(follows.includes(left.category)),
        )
    : all;
}
function getLikes(m) {
  return (m.likes || 0) + (likeExtra[m.id] || 0);
}
function getPlays(m) {
  return (m.plays || 0) + (playExtra[m.id] || 0);
}
function toggleLike(id) {
  if (likedIds.has(id)) {
    likedIds.delete(id);
    likeExtra[id] = (likeExtra[id] || 0) - 1;
  } else {
    likedIds.add(id);
    likeExtra[id] = (likeExtra[id] || 0) + 1;
  }
  saveJSON(LS_KEYS.likedIds, [...likedIds]);
  saveJSON(LS_KEYS.likeExtra, likeExtra);
}
function apiHeaders() {
  return {
    "Content-Type": "application/json",
    "X-MemeMantri-Token": profileToken,
  };
}
/* Shows the IP-moderation warning message (returned by the server when an
   IP is on its watch-list, before it escalates to a full ban) as a small
   dismissing toast, without blocking the action that just succeeded. */
function showModerationWarning(message) {
  if (!message) return;
  let el = document.getElementById("moderationWarningToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "moderationWarningToast";
    el.style.cssText =
      "position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:999;max-width:90vw;padding:12px 18px;border-radius:12px;background:rgba(20,16,10,.95);border:1px solid var(--gold, #ffd45e);color:var(--text, #f7f2e9);font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.4);text-align:center";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.style.display = "none";
  }, 6000);
}
function serverMemeId(id) {
  return String(id || "").replace(/^srv/, "");
}
function currentProfile() {
  return communityState?.profile || null;
}
function syncLikedIds() {
  const profile = currentProfile() || {};
  (profile.likedMemeIds || []).forEach((id) => likedIds.add(`srv${id}`));
  (profile.savedMemeIds || []).forEach((id) => savedIds.add(`srv${id}`));
}
async function refreshCommunity() {
  try {
    const response = await fetch(
      `/api/public/community?token=${encodeURIComponent(profileToken)}`,
    );
    if (!response.ok) return;
    communityState = await response.json();
    saveJSON(LS_KEYS.profile, communityState);
    syncLikedIds();
    renderCommunity();
  } catch {}
}
async function toggleSaveForMeme(id) {
  if (!String(id).startsWith("srv")) return;
  const response = await fetch(
    `/api/public/memes/${encodeURIComponent(serverMemeId(id))}/save`,
    { method: "POST", headers: apiHeaders() },
  );
  const data = await response.json();
  if (!response.ok) return;
  data.saved ? savedIds.add(id) : savedIds.delete(id);
  saveJSON(LS_KEYS.savedIds, [...savedIds]);
  communityState = communityState || {};
  communityState.profile = data.profile;
  saveJSON(LS_KEYS.profile, communityState);
  renderGrid();
  renderCommunity();
  showModerationWarning(data.warning);
}
async function toggleLikeForMeme(id) {
  if (!String(id).startsWith("srv")) {
    toggleLike(id);
    return;
  }
  try {
    const response = await fetch(
      `/api/public/memes/${encodeURIComponent(serverMemeId(id))}/like`,
      {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ token: profileToken }),
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Like failed");
    likedIds[data.liked ? "add" : "delete"](id);
    const meme = getAllMemes().find((item) => item.id === id);
    if (meme) meme.likes = data.likes;
    communityState = communityState || {};
    communityState.profile = data.profile;
    saveJSON(LS_KEYS.profile, communityState);
    renderGrid();
    renderUserGrid();
    renderMotd();
    renderCommunity();
    showModerationWarning(data.warning);
  } catch {
    toggleLike(id);
    renderGrid();
  }
}
function bumpPlay(id) {
  playExtra[id] = (playExtra[id] || 0) + 1;
  saveJSON(LS_KEYS.playExtra, playExtra);
}
function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

/* ---- smooth browser-only AI persona narration ---- */
let currentAudio = null;
let currentId = null;
let detailMemeId = null;
let speechTimer = null;
let speechRun = 0;
let browserVoices = [];
let personaVoiceMap = new Map();

function getVoice(styleId) {
  return VOICES.find((v) => v.id === styleId) || VOICES[0];
}
function updateVoiceStatus(text) {
  const el = document.getElementById("voiceStatus");
  if (el) el.textContent = text;
}
function isFemaleName(name) {
  return /female|woman|girl|heera|samantha|zira|susan|karen|veena|lekha/i.test(
    name,
  );
}
function isMaleName(name) {
  return /male|man|boy|ravi|hemant|david|daniel|alex|mark/i.test(name);
}
function refreshBrowserVoices() {
  if (!("speechSynthesis" in window)) {
    browserVoices = [];
    updateVoiceStatus("⚠️ Browser speech is unsupported");
    return;
  }
  browserVoices = window.speechSynthesis.getVoices() || [];
  personaVoiceMap = new Map();
  assignPersonaVoices();
  const indian = browserVoices.filter(
    (v) =>
      /(^|[-_])(IN|hi)([-_]|$)/i.test(v.lang) ||
      /india|hindi|हिन्दी|हिंदी/i.test(v.name),
  );
  updateVoiceStatus(
    `${browserVoices.length} voice${browserVoices.length === 1 ? "" : "s"} found · ${indian.length} Hindi/Indian · persona tuning active`,
  );
}
function scoreVoice(profile, voice, used) {
  const name = `${voice.name} ${voice.lang}`.toLowerCase();
  let score = used.has(voice.name) ? -120 : 0;
  if (voice.lang.toLowerCase() === profile.lang.toLowerCase()) score += 110;
  if (
    voice.lang.toLowerCase().startsWith(profile.lang.slice(0, 2).toLowerCase())
  )
    score += 58;
  if (/india|hindi|hi-in|en-in|हिन्दी|हिंदी/.test(name)) score += 48;
  if (profile.gender === "female" && isFemaleName(name)) score += 42;
  if (profile.gender === "male" && isMaleName(name)) score += 42;
  profile.patterns.forEach((p) => {
    if (name.includes(p.toLowerCase())) score += 24;
  });
  if (voice.default) score += 4;
  return score;
}
function assignPersonaVoices() {
  const used = new Set();
  VOICES.forEach((profile) => {
    const ranked = browserVoices
      .map((v) => ({ voice: v, score: scoreVoice(profile, v, used) }))
      .sort((a, b) => b.score - a.score);
    const chosen = ranked[0]?.voice || null;
    personaVoiceMap.set(profile.id, chosen);
    if (chosen) used.add(chosen.name);
  });
}
function choosePersonaVoice(profile) {
  return personaVoiceMap.get(profile.id) || null;
}
function prepareSpeechText(text, profile) {
  let clean = String(text)
    .replace(/[😂🔥🇮🇳🏏🎬🗳💀🎙🌍🎮📚💘🎓]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Browser Hindi voices handle a lightly punctuated Hinglish line more
  // naturally than symbols, abbreviations, or long unbroken clauses.
  clean = clean
    .replace(/\bWiFi\b/gi, "वाई फाई")
    .replace(/\bGPS\b/g, "जी पी एस")
    .replace(/\bPDF\b/g, "पी डी एफ")
    .replace(/\bAC\b/g, "ए सी")
    .replace(/\s*—\s*/g, ", ");
  if (profile.id === "uncle_m" || profile.id === "aunty_f")
    clean = clean.replace(/!/g, "! ...");
  if (profile.id === "dada_m" || profile.id === "dadi_f")
    clean = clean.replace(/,/g, ", ...");
  return clean;
}
function splitSpeech(text) {
  return (
    String(text)
      .trim()
      .match(/[^.!?।！？]+[.!?।！？]+|[^.!?।！？]+$/g)
      ?.map((s) => s.trim())
      .filter(Boolean) || [String(text)]
  );
}
function finishSpeech(run, onEnd) {
  if (run !== speechRun) return;
  currentId = null;
  currentAudio = null;
  renderGrid();
  renderMotd();
  renderUserGrid();
  if (typeof window.onFmSpeechChange === "function") window.onFmSpeechChange();
  if (onEnd) onEnd();
}
function speak(id, text, styleId, speed = 1, onEnd) {
  stopSpeak();
  if (!("speechSynthesis" in window)) {
    updateVoiceStatus("⚠️ Web Speech API is not available");
    return;
  }
  currentId = id;
  const run = ++speechRun;
  const profile = getVoice(styleId);
  const voice = choosePersonaVoice(profile);
  const parts = splitSpeech(prepareSpeechText(text, profile));
  let i = 0;
  bumpPlay(id);
  renderGrid();
  renderMotd();
  renderUserGrid();
  if (typeof window.onFmSpeechChange === "function") window.onFmSpeechChange();
  const next = () => {
    if (run !== speechRun) return;
    if (i >= parts.length) return finishSpeech(run, onEnd);
    const utterance = new SpeechSynthesisUtterance(parts[i++]);
    utterance.voice = voice || null;
    utterance.lang = voice?.lang || profile.lang;
    utterance.pitch = profile.pitch;
    utterance.rate = Math.max(0.65, Math.min(1.3, profile.rate * speed));
    utterance.volume = 1;
    utterance.onstart = () =>
      updateVoiceStatus(
        `${profile.persona} · ${profile.gender} · ${voice ? voice.name : "browser default"}`,
      );
    utterance.onerror = (error) => {
      if (
        run === speechRun &&
        error.error !== "canceled" &&
        error.error !== "interrupted"
      ) {
        updateVoiceStatus(
          "⚠️ Voice failed; try another persona or install a voice pack",
        );
        finishSpeech(run, onEnd);
      }
    };
    utterance.onend = () => {
      if (run === speechRun)
        speechTimer = setTimeout(
          next,
          /[!?।！？]$/.test(utterance.text)
            ? profile.pause + 160
            : profile.pause,
        );
    };
    window.speechSynthesis.speak(utterance);
  };
  next();
}
function stopSpeak() {
  speechRun++;
  if (speechTimer) clearTimeout(speechTimer);
  speechTimer = null;
  window.speechSynthesis?.cancel();
  currentAudio = null;
  currentId = null;
  renderGrid();
  renderUserGrid();
  if (typeof window.onFmSpeechChange === "function") window.onFmSpeechChange();
  updateVoiceStatus("Voice ready");
}
if ("speechSynthesis" in window) {
  refreshBrowserVoices();
  window.speechSynthesis.onvoiceschanged = refreshBrowserVoices;
}

/* ---- hero + ticker ---- */
["😂", "🔥", "🇮🇳", "🏏", "🎬", "🗳", "💀", "🎙", "🌍"].forEach((e, i) => {
  const s = document.createElement("span");
  s.textContent = e;
  s.style.left = 8 + i * 10 + "%";
  s.style.animationDelay = i * 0.8 + "s";
  document.getElementById("floaters").appendChild(s);
});

document.getElementById("ticker").innerHTML = [0, 1]
  .map(() => TICKER.map((t) => `<span>${t}</span>`).join(""))
  .join("");

/* ---- voice selects (Male/Female optgroups, single source of truth) ---- */
function voiceOptionsHTML() {
  const male = VOICES.filter((v) => v.gender === "male")
    .map(
      (v) => `<option value="${v.id}">${v.emoji} ${v.persona} · Male</option>`,
    )
    .join("");
  const female = VOICES.filter((v) => v.gender === "female")
    .map(
      (v) =>
        `<option value="${v.id}">${v.emoji} ${v.persona} · Female</option>`,
    )
    .join("");
  return `<optgroup label="♂ Male Voices">${male}</optgroup><optgroup label="♀ Female Voices">${female}</optgroup>`;
}

const voiceSel = document.getElementById("voice");
const voiceA = document.getElementById("voiceA");
const voiceB = document.getElementById("voiceB");

voiceSel.innerHTML = voiceOptionsHTML();
voiceA.innerHTML = voiceOptionsHTML();
voiceB.innerHTML = voiceOptionsHTML();
voiceA.value = "anchor_m";
voiceB.value = "roast_f";

/* ---- feed ---- */
let category = "all";
let speedVal = 1;
let searchTerm = "";
let feedGroup = null;
let savedOnly = false;

const feedGroups = document.getElementById("feedGroups");
if (feedGroups) {
  feedGroups.onclick = (e) => {
    const b = e.target.closest("[data-group]");
    if (!b) return;
    feedGroup = b.dataset.group === "none" ? null : b.dataset.group;
    [...feedGroups.children].forEach((c) =>
      c.classList.toggle("active", c.dataset.group === b.dataset.group),
    );
    renderGrid();
    feedGroups.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

const chips = document.getElementById("chips");
chips.innerHTML = CATEGORIES.map(
  ([id, l, e]) =>
    `<button class="chip${id === "all" ? " active" : ""}" data-cat="${id}">${e} ${l}</button>`,
).join("");

chips.onclick = (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  userPetitionsOnly = false;
  document.getElementById("userPetitionsBtn")?.classList.remove("btn-green");
  if (document.getElementById("userPetitionsBtn"))
    document.getElementById("userPetitionsBtn").textContent = "📮 Users petitions";
  category = b.dataset.cat;
  [...chips.children].forEach((c) =>
    c.classList.toggle("active", c.dataset.cat === category),
  );
  resetFeedGroup();
  renderGrid();
};
function resetFeedGroup() {
  feedGroup = null;
  const feedGroups = document.getElementById("feedGroups");
  if (feedGroups)
    [...feedGroups.children].forEach((c) => c.classList.remove("active"));
}
function fmt(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : n;
}

function matchesSearch(m, term) {
  if (!term) return true;
  const t = term.toLowerCase();
  return (
    m.title.toLowerCase().includes(t) ||
    m.text.toLowerCase().includes(t) ||
    m.creator.toLowerCase().includes(t)
  );
}

function requestedMemeId() {
  const params = new URLSearchParams(location.search);
  const queryId = params.get("meme");
  if (queryId) return queryId;
  return (
    location.pathname.match(/^\/m\/(?:srv)?([A-Za-z0-9_-]+)\/?$/)?.[1] || null
  );
}
function idsMatch(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  return (
    a === b ||
    a.replace(/^srv/, "") === b.replace(/^srv/, "") ||
    a === `m${b}` ||
    b === `m${a}`
  );
}
function focusSharedMeme() {
  const requested = requestedMemeId();
  if (!requested) return;
  const meme = getAllMemes().find((item) => idsMatch(item.id, requested));
  if (!meme) return;
  const card = [...document.querySelectorAll(".meme-card")].find((item) =>
    idsMatch(item.dataset.memeId, meme.id),
  );
  if (!card) return;
  card.classList.add("shared-highlight");
  card.scrollIntoView({ behavior: "smooth", block: "center" });
}

function shareIconsHTML(id) {
  return `<div class="share-actions" aria-label="Share this meme">
        <button class="share-btn share-whatsapp" data-meme-share="whatsapp" data-share-id="${escapeHtml(id)}" title="Share on WhatsApp" aria-label="Share on WhatsApp"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.1.2-.3.2-.6.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.5.1-.6l.4-.5c.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5s-.6-1.5-.8-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 2 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3zM12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.5-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg></button>
        <button class="share-btn share-instagram" data-meme-share="instagram" data-share-id="${escapeHtml(id)}" title="Share as Instagram Story" aria-label="Share as Instagram Story"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg></button>
        <button class="share-btn share-link" data-meme-share="link" data-share-id="${escapeHtml(id)}" title="Copy link" aria-label="Copy link"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 1 0-5.7-5.7L11 7"/><path d="M14 10a4 4 0 0 0-5.7 0L6 12.3a4 4 0 1 0 5.7 5.7L13 17"/></svg></button>
      </div>
      <p class="share-status" data-share-status aria-live="polite"></p>`;
}
function openMemeDetail(id) {
  const m = getAllMemes().find((x) => x.id === id);
  if (!m) return;
  detailMemeId = id;
  const liked = likedIds.has(m.id);
  const saved = savedIds.has(m.id);
  document.getElementById("detailBody").innerHTML = `
    <span class="tag">${escapeHtml(m.category)}${m.featured ? " · ⭐ Featured" : ""}</span>
    <h2 id="detailTitle">${escapeHtml(m.title)}</h2>
    <p class="detail-text">${escapeHtml(m.text)}</p>
    <p class="detail-meta">${escapeHtml(m.creator)} · ❤️ ${fmt(getLikes(m))} · ▶ ${fmt(getPlays(m))}</p>
    <div class="global-actions">
      <button class="btn ${currentId === m.id ? "btn-green" : "btn-primary"}" data-play="${escapeHtml(m.id)}" aria-label="Narrate ${escapeHtml(m.title)}">${currentId === m.id ? '<span class="eq"><i></i><i></i><i></i><i></i></span> Playing' : "🔊 Narrate"}</button>
      <button class="icon-action${liked ? " active" : ""}" data-like="${escapeHtml(m.id)}" aria-label="Like meme">${liked ? "❤️" : "🤍"}</button>
      <button class="icon-action${saved ? " active" : ""}" data-save="${escapeHtml(m.id)}" aria-label="Save meme">🔖</button>
      ${String(m.id).startsWith("srv") ? `<button class="icon-action${m.reported ? " reported" : ""}" data-report="${escapeHtml(m.id)}" aria-label="${m.reported ? "Reported — team review karegi" : "Report meme"}"${m.reported ? " disabled" : ""}>${m.reported ? "🚩" : "⚑"}</button>` : ""}
    </div>
    ${shareIconsHTML(m.id)}`;
  document.getElementById("detailBackdrop").hidden = false;
}
async function loadMemeCourt(containerEl, id) {
  if (!containerEl || containerEl.dataset.courtMeme !== String(id)) return;
  try {
    const data = await fetch(
      `/api/public/memes/${encodeURIComponent(serverMemeId(id))}/court`,
      { headers: apiHeaders() },
    ).then((r) => r.json());
    renderMemeCourt(containerEl, id, data);
  } catch {
    containerEl.innerHTML = `<p class="sub">Meme Court abhi load nahi ho paaya.</p>`;
  }
}
function renderMemeCourt(containerEl, id, data) {
  if (!containerEl || containerEl.dataset.courtMeme !== String(id)) return;
  const c = data.counts || { guilty: 0, not_funny: 0, needs_punchline: 0, total: 0 };
  const myVote = data.myVote;
  const verdict = data.verdict || { label: "⚖️ Case under trial — vote to decide" };
  containerEl.innerHTML = `
    <p class="court-case-number">CASE #${escapeHtml(String(data.caseNumber || "----"))}</p>
    <p class="court-question">⚖️ Meme Court: Kya ye meme genuinely funny hai?</p>
    <div class="court-buttons">
      <button class="btn btn-ghost${myVote === "guilty" ? " active" : ""}" data-verdict="guilty">😂 Guilty of making me laugh</button>
      <button class="btn btn-ghost${myVote === "not_funny" ? " active" : ""}" data-verdict="not_funny">🙄 Not funny</button>
      <button class="btn btn-ghost${myVote === "needs_punchline" ? " active" : ""}" data-verdict="needs_punchline">✍️ Needs better punchline</button>
    </div>
    <div class="court-verdict">${escapeHtml(verdict.label)}</div>
    <div class="court-tally"><span>😂 ${c.guilty}</span><span>🙄 ${c.not_funny}</span><span>✍️ ${c.needs_punchline}</span><span>Total: ${c.total}</span></div>
  `;
}
async function castCourtVote(containerEl, id, verdict) {
  try {
    const result = await fetch(
      `/api/public/memes/${encodeURIComponent(serverMemeId(id))}/court`,
      {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ verdict }),
      },
    );
    const data = await result.json();
    if (!result.ok) {
      showModerationWarning(data.message);
      return;
    }
    if (data.profile) {
      communityState = communityState || {};
      communityState.profile = data.profile;
      saveJSON(LS_KEYS.profile, communityState);
    }
    showModerationWarning(data.warning);
    renderMemeCourt(containerEl, id, data);
  } catch {
    showModerationWarning("Court vote submit nahi ho paya. Dobara try karo.");
  }
}
function openCourtCase(containerEl, memeId) {
  if (!containerEl) return;
  containerEl.hidden = false;
  containerEl.dataset.courtMeme = String(memeId);
  containerEl.innerHTML = `<p class="sub">⚖️ Loading Meme Court…</p>`;
  loadMemeCourt(containerEl, memeId);
}
document.getElementById("detailBody")?.addEventListener("click", (e) => {
  const courtBtn = e.target.closest("[data-verdict]");
  if (!courtBtn) return;
  const box = document.getElementById("courtBox");
  const id = box?.dataset.courtMeme;
  if (id) castCourtVote(box, id, courtBtn.dataset.verdict);
});

/* ---------- Meme Court: search & select (Meme Sabha community card) ---------- */
(() => {
  const input = document.getElementById("courtSearchInput");
  const results = document.getElementById("courtSearchResults");
  const box = document.getElementById("communityCourtBox");
  if (!input || !results || !box) return;
  // Same category "kicker" flavor text used by the visual meme cards
  // (e.g. cricket memes are badged "LAST OVER ENERGY"), so a search for
  // that flavor text should still find memes in that category.
  const CATEGORY_KICKERS = {
    cricket: "last over energy",
    student: "exam night files",
    bollywood: "full filmy mode",
    politics: "live from sansad",
    tech: "tech support desk",
    hindi: "हिंदी विभाग",
    desi: "desi department",
    gaming: "rank push live",
    love: "dil ki committee",
    funny: "laughter ministry",
    trending: "trending now",
    genz: "vibe check",
    science: "research wing",
    all: "meme ministry",
  };
  function memeMatches(m, term) {
    const words = term.split(/\s+/).filter(Boolean);
    const haystacks = [
      m.title,
      m.text,
      m.category,
      m.creator,
      CATEGORY_KICKERS[m.category] || "",
    ]
      .filter(Boolean)
      .map((v) => v.toLowerCase());
    const fullText = haystacks.join(" · ");
    // Whole phrase match first (most precise); fall back to "every typed
    // word appears somewhere" so partial/kicker-style searches still work.
    if (fullText.includes(term)) return true;
    return words.every((word) => fullText.includes(word));
  }
  function runSearch() {
    const term = input.value.trim().toLowerCase();
    if (!term) {
      results.innerHTML = "";
      return;
    }
    const matches = getAllMemes()
      .filter((m) => memeMatches(m, term))
      .slice(0, 6);
    results.innerHTML = matches.length
      ? matches
          .map(
            (m) =>
              `<button type="button" class="court-result-item" data-court-pick="${escapeHtml(m.id)}"><span>${escapeHtml(m.title)}</span><span class="result-cat">${escapeHtml(m.category)}</span></button>`,
          )
          .join("")
      : `<p class="sub">Koi meme nahi mila. Kuch aur try karo.</p>`;
  }
  input.addEventListener("input", runSearch);
  results.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-court-pick]");
    if (!pick) return;
    const meme = getAllMemes().find((m) => idsMatch(m.id, pick.dataset.courtPick));
    if (!meme) return;
    input.value = meme.title;
    results.innerHTML = "";
    openCourtCase(box, meme.id);
  });
  box.addEventListener("click", (e) => {
    const courtBtn = e.target.closest("[data-verdict]");
    if (!courtBtn) return;
    const id = box.dataset.courtMeme;
    if (id) castCourtVote(box, id, courtBtn.dataset.verdict);
  });
})();

function closeMemeDetail() {
  const backdrop = document.getElementById("detailBackdrop");
  if (backdrop) backdrop.hidden = true;
  detailMemeId = null;
}
/* ---------- Meme Passport ---------- */
async function openPassport() {
  const backdrop = document.getElementById("passportBackdrop");
  const body = document.getElementById("passportBody");
  if (!backdrop || !body) return;
  backdrop.hidden = false;
  body.innerHTML = `<p class="sub">Loading citizen record…</p>`;
  try {
    const data = await fetch("/api/public/passport", {
      headers: apiHeaders(),
    }).then((r) => r.json());
    const p = data.passport;
    body.innerHTML = `
      <div class="passport-avatar-line">${escapeHtml(p.avatar)}</div>
      <div class="passport-row"><span>Citizen Name</span><span>${escapeHtml(p.nickname)}</span></div>
      <div class="passport-row"><span>Meme Citizenship</span><span>${escapeHtml(p.citizenship)}</span></div>
      <div class="passport-row"><span>Current Rank</span><span>${escapeHtml(p.rankTitle)}</span></div>
      <div class="passport-row"><span>Karma Points</span><span>${escapeHtml(String(p.points))}</span></div>
      <div class="passport-row"><span>Favourite Department</span><span>${escapeHtml(p.favouriteDepartment)}</span></div>
      <div class="passport-row"><span>Reaction Personality</span><span>${escapeHtml(p.reactionPersonality)}</span></div>
      <div class="passport-row"><span>Meme Age</span><span>${escapeHtml(p.memeAge)}</span></div>
    `;
  } catch {
    body.innerHTML = `<p class="sub">Passport load nahi ho paya. Dobara try karo.</p>`;
  }
}
function closePassport() {
  const backdrop = document.getElementById("passportBackdrop");
  if (backdrop) backdrop.hidden = true;
}
document.getElementById("openPassportBtn")?.addEventListener("click", openPassport);
document.getElementById("passportClose")?.addEventListener("click", closePassport);
document.getElementById("passportBackdrop")?.addEventListener("click", (e) => {
  if (e.target.id === "passportBackdrop") closePassport();
});

/* ---------- Meme Fortune Teller ---------- */
const FORTUNE_PREDICTIONS = [
  "Aaj tum 3 baar phone unlock karoge bina kisi reason ke.",
  "Aaj koi tumhara message dekh kar bhi reply nahi karega — aur tum har 5 minute mein check karoge.",
  "Aaj tumhare mooh se 'thoda sa aur' kehke poora packet khatam ho jayega.",
  "Aaj tum ek meeting mein 'haan bilkul' bologe bina sunte hue kya poocha gaya.",
  "Aaj raat ko 'bas 5 minute aur' bolte bolte 2 baj jayenge.",
  "Aaj tum kisi ek WhatsApp group ko mute karoge, phir bhi check karte rahoge.",
  "Aaj tumhara ek purana dost achanak 'kaise ho' likhega, sirf loan maangne ke liye.",
  "Aaj tum fridge khologe 4 baar, har baar khaali haath wapas aaoge.",
  "Aaj koi tumhe 'seen' karke ignore karega — revenge mein tum bhi karoge.",
  "Aaj tumhara internet exactly tab slow hoga jab important call pe ho.",
  "Aaj tum kisi cheez ko dhoondhte hue apne hi haath mein pakdi hui cheez dhoondoge.",
  "Aaj ek random gaana tumhare dimaag mein poora din ghoomega.",
  "Aaj tum 'kal se serious ho jaunga' ka vaada khud se karoge — kal bhi wahi hoga.",
  "Aaj tumhe koi bina maange advice dega, aur tum politely 'haan sahi hai' bologe.",
  "Aaj tum ek notification dekhoge, khologe nahi, phir 10 baar dekhoge.",
  "Aaj tumhara chai/coffee thanda ho jayega kyunki tum busy the scrolling mein.",
  "Aaj koi tumse 'free ho kya' poochega jab tum sabse zyada busy honge.",
  "Aaj tum ek deadline last minute mein complete karoge aur khud pe proud feel karoge.",
  "Aaj tumhara alarm 5 baar snooze hoga, phir bhi tum time pe ready ho jaoge (shayad).",
  "Aaj koi tumhe purani meme bhejega jo tumne khud usko 6 mahine pehle bheji thi.",
];
function randomFortune() {
  return FORTUNE_PREDICTIONS[Math.floor(Math.random() * FORTUNE_PREDICTIONS.length)];
}
document.getElementById("fortuneBtn")?.addEventListener("click", () => {
  const pool = getAllMemes();
  const meme = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  const resultBox = document.getElementById("fortuneResult");
  if (!resultBox) return;
  document.getElementById("fortuneMemeText").textContent = meme
    ? `"${meme.text}" — ${meme.creator || "@anonymous"}`
    : "Aaj ka koi meme available nahi tha, lekin bhavishya toh milega hi.";
  document.getElementById("fortunePrediction").textContent = `🔮 ${randomFortune()}`;
  resultBox.hidden = false;
});

let reportMemeId = null;
function openReportModal(id) {
  reportMemeId = id;
  document.getElementById("reportForm").reset();
  document.getElementById("reportStatus").textContent = "";
  document.getElementById("reportSubmitBtn").disabled = false;
  document.getElementById("reportSubmitBtn").textContent = "🚩 Submit Report";
  document.getElementById("reportBackdrop").hidden = false;
}
function closeReportModal() {
  document.getElementById("reportBackdrop").hidden = true;
  reportMemeId = null;
}
document.getElementById("reportModalClose").onclick = closeReportModal;
document.getElementById("reportCancelBtn").onclick = closeReportModal;
document.getElementById("reportBackdrop").onclick = (e) => {
  if (e.target.id === "reportBackdrop") closeReportModal();
};
document.getElementById("reportForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!reportMemeId) return;
  const reason = document.getElementById("reportReason").value;
  const details = document.getElementById("reportDetails").value.trim();
  const status = document.getElementById("reportStatus");
  const btn = document.getElementById("reportSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Submitting…";
  status.textContent = "⏳ Report bheja ja raha hai…";
  try {
    const r = await fetch(
      `/api/public/global-memes/${encodeURIComponent(serverMemeId(reportMemeId))}/report`,
      {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          reason: details ? `${reason}: ${details}` : reason,
        }),
      },
    );
    const d = await r.json();
    if (!r.ok) throw new Error(d.message);
    status.textContent = `✅ ${d.message || "Report submit ho gaya."}`;
    const m = getAllMemes().find((x) => x.id === reportMemeId);
    if (m) m.reported = true;
    renderGrid();
    renderUserGrid();
    setTimeout(closeReportModal, 1200);
  } catch (err) {
    status.textContent = `⚠️ ${err.message || "Report submit nahi ho paya."}`;
    btn.disabled = false;
    btn.textContent = "🚩 Submit Report";
  }
};
function syncMemeDetail() {
  if (detailMemeId && !document.getElementById("detailBackdrop")?.hidden)
    openMemeDetail(detailMemeId);
}
function memeCardHTML(m) {
  const likes = getLikes(m);
  const plays = getPlays(m);
  const liked = likedIds.has(m.id);
  const saved = savedIds.has(m.id);
  const isServerMeme = String(m.id).startsWith("srv");
  return `
    <article class="card glass meme-card${m.featured ? " is-featured" : ""}" data-meme-id="${escapeHtml(m.id)}">
      <div class="card-topline">
        <span class="tag">${escapeHtml(m.category)}${m.userSubmitted ? " · community" : ""}${m.submissionStatus ? ` · ${escapeHtml(m.submissionStatus)}` : ""}</span>
        ${m.featured ? '<span class="featured">⭐ Featured</span>' : ""}
      </div>
      <h3>${escapeHtml(m.title)}</h3>
      <p>${escapeHtml(m.text)}</p>
      <div class="meta">
        <span>${escapeHtml(m.creator)}</span>
        <span>❤️ ${fmt(likes)} · ▶ ${fmt(plays)}</span>
      </div>
      <div class="global-actions">
        <button class="btn ${currentId === m.id ? "btn-green" : "btn-primary"}" data-play="${escapeHtml(m.id)}" aria-label="Narrate ${escapeHtml(m.title)}">
          ${currentId === m.id ? '<span class="eq"><i></i><i></i><i></i><i></i></span> Playing' : "🔊 Narrate"}
        </button>
        <button class="icon-action${liked ? " active" : ""}" data-like="${escapeHtml(m.id)}" aria-label="Like meme">${liked ? "❤️" : "🤍"}</button>
        <button class="icon-action${saved ? " active" : ""}" data-save="${escapeHtml(m.id)}" aria-label="Save meme">🔖</button>
        ${isServerMeme ? `<button class="icon-action${m.reported ? " reported" : ""}" data-report="${escapeHtml(m.id)}" aria-label="${m.reported ? "Reported — team review karegi" : "Report meme"}"${m.reported ? " disabled" : ""}>${m.reported ? "🚩" : "⚑"}</button>` : ""}
      </div>
      <div class="share-actions" aria-label="Share this meme">
        <button class="share-btn share-whatsapp" data-meme-share="whatsapp" data-share-id="${escapeHtml(m.id)}" title="Share on WhatsApp" aria-label="Share on WhatsApp"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.1.2-.3.2-.6.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.5.1-.6l.4-.5c.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5s-.6-1.5-.8-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 2 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3zM12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.5-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg></button>
        <button class="share-btn share-instagram" data-meme-share="instagram" data-share-id="${escapeHtml(m.id)}" title="Share as Instagram Story" aria-label="Share as Instagram Story"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg></button>
        <button class="share-btn share-link" data-meme-share="link" data-share-id="${escapeHtml(m.id)}" title="Copy link" aria-label="Copy link"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 1 0-5.7-5.7L11 7"/><path d="M14 10a4 4 0 0 0-5.7 0L6 12.3a4 4 0 1 0 5.7 5.7L13 17"/></svg></button>
      </div>
      <p class="share-status" data-share-status aria-live="polite"></p>
      <button class="view-detail-btn" data-detail="${escapeHtml(m.id)}">🔍 View Full Meme</button>
      ${isServerMeme ? `<details class="comments-box"><summary>💬 ${m.comments || 0} comments</summary><div class="comments-content" data-comments-for="${escapeHtml(m.id)}">Open to load comments…</div></details>` : ""}
    </article>`;
}

async function handleMemeShare(event, lookup) {
  const button = event.target.closest("[data-meme-share]");
  if (!button) return false;
  const meme = lookup(button.dataset.shareId);
  if (!meme || !window.MemeShare) return true;
  const card = button.closest(".meme-card, .motd-card");
  const status = card?.querySelector("[data-share-status]");
  const original = button.textContent;
  button.disabled = true;
  if (status) status.textContent = "Share card prepare ho raha hai…";
  try {
    const result = await window.MemeShare.shareMeme(
      meme,
      button.dataset.memeShare,
    );
    if (status) status.textContent = result.message;
  } catch (error) {
    if (status)
      status.textContent = `⚠️ ${error?.message || "Share nahi ho saka."}`;
  } finally {
    button.disabled = false;
    button.textContent = original;
    if (status)
      window.setTimeout(() => {
        status.textContent = "";
      }, 7000);
  }
  return true;
}

async function loadMemeComments(card, id) {
  const box = card?.querySelector(`[data-comments-for="${CSS.escape(id)}"]`);
  if (!box) return;
  box.innerHTML = `<p class="sub">Loading comments…</p>`;
  try {
    const response = await fetch(
      `/api/public/memes/${encodeURIComponent(serverMemeId(id))}/comments`,
    );
    const data = await response.json();
    box.innerHTML =
      (data.comments || [])
        .map(
          (comment) =>
            `<div class="comment-line"><b>${escapeHtml(comment.avatar)} ${escapeHtml(comment.nickname)}</b><span>${escapeHtml(comment.text)}</span></div>`,
        )
        .join("") || "<small>Be the first citizen to comment.</small>";
    box.insertAdjacentHTML(
      "beforeend",
      `<form class="comment-form"><input maxlength="280" placeholder="Drop a reaction…" required /><button>Post</button></form>`,
    );
    box.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const input = box.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      const result = await fetch(
        `/api/public/memes/${encodeURIComponent(serverMemeId(id))}/comments`,
        {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ token: profileToken, text }),
        },
      );
      const payload = await result.json();
      if (!result.ok) {
        showModerationWarning(payload.message);
        return;
      }
      input.value = "";
      loadMemeComments(card, id);
      communityState = communityState || {};
      communityState.profile = payload.profile;
      saveJSON(LS_KEYS.profile, communityState);
      renderCommunity();
      showModerationWarning(payload.warning);
    };
  } catch {
    box.innerHTML = `<p class="sub">Comments server se load nahi ho paaye.</p>`;
  }
}
function renderGrid() {
  const pool = userPetitionsOnly ? serverUserPetitions : getAllMemes();
  const list = pool.filter(
    (m) =>
      (userPetitionsOnly || category === "all" || m.category === category) &&
      (!savedOnly || savedIds.has(m.id)) &&
      matchesSearch(m, searchTerm),
  );
  const half = Math.ceil(list.length / 2);
  const groupA = list.slice(0, half);
  const groupB = list.slice(half);
  const feedGroups = document.getElementById("feedGroups");
  if (feedGroups) {
    feedGroups.style.display = !userPetitionsOnly && list.length > 4 ? "flex" : "none";
    const tabA = feedGroups.querySelector('[data-group="a"]');
    const tabB = feedGroups.querySelector('[data-group="b"]');
    if (tabA) tabA.textContent = `🔥 Top Picks (${groupA.length})`;
    if (tabB) tabB.textContent = `🗂 More Memes (${groupB.length})`;
  }
  const emptyState = document.getElementById("emptyState");
  if (!list.length) {
    document.getElementById("memeGrid").innerHTML = "";
    emptyState.textContent = userPetitionsOnly
      ? "Aapne abhi koi meme petition submit nahi ki."
      : "No memes match your search. Try another keyword 🤔";
    emptyState.classList.remove("empty-state-pill");
    emptyState.style.display = "block";
  } else if (!userPetitionsOnly && feedGroup === null && list.length > 4) {
    document.getElementById("memeGrid").innerHTML = "";
    emptyState.textContent =
      "📢 Desh bhar ke memes report ho chuke hain, ab faisla aapka, koi ek option choose karein.";
    emptyState.classList.add("empty-state-pill");
    emptyState.style.display = "block";
  } else {
    const shown = feedGroup === "b" ? groupB : groupA;
    document.getElementById("memeGrid").innerHTML = shown
      .map(memeCardHTML)
      .join("");
    emptyState.style.display = "none";
  }
  syncMemeDetail();
}

document.getElementById("memeGrid").onclick = async (e) => {
  if (await handleMemeShare(e, (id) => getAllMemes().find((x) => x.id === id)))
    return;
  const detailBtn = e.target.closest("[data-detail]");
  if (detailBtn) {
    openMemeDetail(detailBtn.dataset.detail);
    return;
  }
  const reportBtn = e.target.closest("[data-report]");
  if (reportBtn) {
    openReportModal(reportBtn.dataset.report);
    return;
  }
  const saveBtn = e.target.closest("[data-save]");
  if (saveBtn) {
    await toggleSaveForMeme(saveBtn.dataset.save);
    return;
  }
  const likeBtn = e.target.closest("[data-like]");
  if (likeBtn) {
    await toggleLikeForMeme(likeBtn.dataset.like);
    return;
  }
  const b = e.target.closest("[data-play]");
  if (!b) return;
  const m = getAllMemes().find((x) => x.id === b.dataset.play);
  currentId === m.id
    ? stopSpeak()
    : speak(m.id, m.text, voiceSel.value, speedVal);
};
document.getElementById("memeGrid").addEventListener(
  "toggle",
  (e) => {
    const box = e.target.querySelector?.("[data-comments-for]");
    if (e.target.open && box)
      loadMemeComments(e.target.closest(".meme-card"), box.dataset.commentsFor);
  },
  true,
);
document.getElementById("speed").oninput = (e) => {
  speedVal = +e.target.value;
  updateSpeedVal();
};

function updateSpeedVal() {
  document.getElementById("speedVal").textContent = speedVal.toFixed(2);
}

document.getElementById("stopAll").onclick = stopSpeak;

let searchDebounce;
document.getElementById("savedOnlyBtn")?.addEventListener("click", (event) => {
  savedOnly = !savedOnly;
  userPetitionsOnly = false;
  document.getElementById("userPetitionsBtn")?.classList.remove("btn-green");
  if (document.getElementById("userPetitionsBtn"))
    document.getElementById("userPetitionsBtn").textContent = "📮 Users petitions";
  event.currentTarget.classList.toggle("btn-green", savedOnly);
  event.currentTarget.textContent = savedOnly
    ? "🔖 Showing saved"
    : "🔖 Saved memes";
  resetFeedGroup();
  renderGrid();
});
document.getElementById("search").oninput = (e) => {
  clearTimeout(searchDebounce);
  const val = e.target.value;
  searchDebounce = setTimeout(() => {
    searchTerm = val;
    resetFeedGroup();
    renderGrid();
  }, 150);
};

renderGrid();
window.setTimeout(focusSharedMeme, 80);

/* ---- meme of the day ---- */
function renderMotd() {
  const pool = getAllMemes();
  if (!pool.length) return;
  // The live API orders published memes newest-first, so MOTD always reflects
  // the latest admin-approved or user-approved meme after a refresh.
  const m = pool[0];
  const liked = likedIds.has(m.id);
  const saved = savedIds.has(m.id);
  const isServerMeme = String(m.id).startsWith("srv");
  document.getElementById("motdCard").innerHTML = `
    <h3>${escapeHtml(m.title)}</h3>
    <p style="color:#ddd7cf">${escapeHtml(m.text)}</p>
    <div class="meta"><span>${escapeHtml(m.creator)}</span><span>❤️ ${fmt(getLikes(m))} · ▶ ${fmt(getPlays(m))}</span></div>
    <div class="global-actions">
      <button class="icon-action${liked ? " active" : ""}" data-like="${escapeHtml(m.id)}" aria-label="Like meme">${liked ? "❤️" : "🤍"}</button>
      <button class="icon-action${saved ? " active" : ""}" data-save="${escapeHtml(m.id)}" aria-label="Save meme">🔖</button>
      ${isServerMeme ? `<button class="icon-action${m.reported ? " reported" : ""}" data-report="${escapeHtml(m.id)}" aria-label="${m.reported ? "Reported — team review karegi" : "Report meme"}"${m.reported ? " disabled" : ""}>${m.reported ? "🚩" : "⚑"}</button>` : ""}
    </div>
    <button class="btn btn-primary" data-play-motd="${m.id}" style="align-self:flex-start">
      ${currentId === m.id ? '<span class="eq"><i></i><i></i><i></i><i></i></span> Playing' : "🔊 Narrate"}
    </button>
    <button class="view-detail-btn" data-detail="${escapeHtml(m.id)}">🔍 View Full Meme</button>
    ${isServerMeme ? `<details class="comments-box"><summary>💬 ${m.comments || 0} comments</summary><div class="comments-content" data-comments-for="${escapeHtml(m.id)}">Open to load comments…</div></details>` : ""}
    <div class="share-actions" aria-label="Share Meme of the Day">
      <button class="share-btn share-whatsapp" data-meme-share="whatsapp" data-share-id="${escapeHtml(m.id)}" title="Share on WhatsApp" aria-label="Share on WhatsApp"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.1.2-.3.2-.6.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.5.1-.6l.4-.5c.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5s-.6-1.5-.8-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 2 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3zM12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.5-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg></button>
      <button class="share-btn share-instagram" data-meme-share="instagram" data-share-id="${escapeHtml(m.id)}" title="Share as Instagram Story" aria-label="Share as Instagram Story"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg></button>
      <button class="share-btn share-link" data-meme-share="link" data-share-id="${escapeHtml(m.id)}" title="Copy link" aria-label="Copy link"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 1 0-5.7-5.7L11 7"/><path d="M14 10a4 4 0 0 0-5.7 0L6 12.3a4 4 0 1 0 5.7 5.7L13 17"/></svg></button>
    </div>
    <p class="share-status" data-share-status aria-live="polite"></p>`;
}
document.getElementById("motdCard").onclick = async (e) => {
  if (await handleMemeShare(e, (id) => getAllMemes().find((x) => x.id === id)))
    return;
  const detailBtn = e.target.closest("[data-detail]");
  if (detailBtn) {
    openMemeDetail(detailBtn.dataset.detail);
    return;
  }
  const reportBtn = e.target.closest("[data-report]");
  if (reportBtn) {
    openReportModal(reportBtn.dataset.report);
    return;
  }
  const saveBtn = e.target.closest("[data-save]");
  if (saveBtn) {
    await toggleSaveForMeme(saveBtn.dataset.save);
    return;
  }
  const likeBtn = e.target.closest("[data-like]");
  if (likeBtn) {
    await toggleLikeForMeme(likeBtn.dataset.like);
    return;
  }
  const b = e.target.closest("[data-play-motd]");
  if (!b) return;
  const m = getAllMemes().find((x) => x.id === b.dataset.playMotd);
  if (!m) return;
  currentId === m.id
    ? stopSpeak()
    : speak(m.id, m.text, voiceSel.value, speedVal);
};
document.getElementById("motdCard").addEventListener(
  "toggle",
  (e) => {
    const box = e.target.querySelector?.("[data-comments-for]");
    if (e.target.open && box)
      loadMemeComments(e.target.closest(".motd-card"), box.dataset.commentsFor);
  },
  true,
);
renderMotd();

/* ---- Meme FM 69.9 now lives in fm.js (time-based live-radio simulation) ---- */

/* ---- 24-hour VoiceMantri public meme battle ---- */
let battleSocket = null;
let battleState = null;
const BATTLE_VOTER_TOKEN = (() => {
  const key = "mm_voice_mantri_voter_token";
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID
      ? crypto.randomUUID()
      : `voter_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, token);
  }
  return token;
})();
function battleServerUrl() {
  return (
    window.MEME_CHAT_SERVER_URL ||
    (location.protocol === "file:" ? "http://localhost:3000" : location.origin)
  );
}
function battleMessage(message, error = false) {
  const el = document.getElementById("battleSubmitMsg");
  if (el) {
    el.textContent = message;
    el.style.color = error ? "#ff6b6b" : "var(--muted)";
  }
}
function notifyCitizen(title, body) {
  if (
    localStorage.getItem(LS_KEYS.alerts) === "1" &&
    "Notification" in window &&
    Notification.permission === "granted"
  )
    new Notification(title, { body });
}
function battleSubmission(slot) {
  return battleState?.submissions?.find((s) => s.slot === slot) || null;
}
function battleCountdown() {
  const el = document.getElementById("battleCountdown");
  if (!el || !battleState?.endsAt) return;
  if (!battleState.endsAt) {
    el.textContent = battleState.submissions?.length ? "Waiting for second participant" : "Starts with first participant";
    return;
  }
  const ms = Math.max(0, new Date(battleState.endsAt).getTime() - Date.now());
  const total = Math.floor(ms / 1000);
  el.textContent =
    ms > 0
      ? `${String(Math.floor(total / 3600)).padStart(2, "0")}:${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")} left`
      : "Contest settling…";
}
function renderBattle() {
  if (!battleState) return;
  const open = battleState.status === "open";
  const status = document.getElementById("battleStatus");
  if (status)
    status.textContent = open
      ? battleState.submissions.length === 0
        ? "Waiting for first participant"
        : battleState.submissions.length < 2
          ? "Waiting for second participant"
          : "Voting is live"
      : "Contest settled";
  battleCountdown();
  ["A", "B"].forEach((slot) => {
    const item = battleSubmission(slot);
    const title = document.getElementById(`battleTitle${slot}`);
    const body = document.getElementById(`battleText${slot}`);
    const author = document.getElementById(`battleAuthor${slot}`);
    const votesEl = document.getElementById(`votes${slot}`);
    if (title)
      title.textContent = item
        ? item.title
        : slot === "A"
          ? "Waiting for first user…"
          : "Waiting for second user…";
    if (body)
      body.textContent = item
        ? item.text
        : slot === "A"
          ? "Pehla random user apni choice ke topic par meme submit karega."
          : "Doosra random user apni choice ke topic par competing meme submit karega.";
    if (author) author.textContent = item ? item.author : "Open slot";
    if (votesEl) votesEl.textContent = item ? item.votes : "0";
    document.querySelectorAll(`[data-battle="${slot}"]`).forEach((btn) => {
      btn.disabled = !item;
    });
    document.querySelectorAll(`[data-vote="${slot}"]`).forEach((btn) => {
      btn.disabled =
        !item ||
        !open ||
        battleState.viewerVoted ||
        battleState.viewerSubmissionId === item.id;
    });
  });
  const submitBtn = document.getElementById("battleSubmitBtn");
  if (submitBtn)
    submitBtn.disabled =
      !open ||
      battleState.submissions.length >= 2 ||
      !!battleState.viewerSubmissionId;
  const winner = battleState.todayVoiceMantri;
  const winnerEl = document.getElementById("todayVoiceMantri");
  if (winnerEl)
    winnerEl.textContent = winner
      ? `${winner.author} — ${winner.title} (${winner.votes} votes)`
      : "Aaj ka winner 24-hour contest ke baad yahan show hoga.";
  const historyEl = document.getElementById("retiredVoiceMantriList");
  if (historyEl) {
    const history = battleState.retiredVoiceMantris || [];
    historyEl.innerHTML = history.length
      ? history
          .map((entry, index) => {
            const date = entry.settled_at
              ? new Date(entry.settled_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Date unavailable";
            return `<div class="glass card" style="margin-top:10px;padding:12px"><div class="meta"><strong>#${history.length - index} Retired VoiceMantri</strong><span>${date}</span></div><p style="margin:8px 0 4px"><strong>${entry.author}</strong> — ${entry.title}</p><small class="sub">${entry.votes} votes</small></div>`;
          })
          .join("")
      : '<p class="sub">Abhi koi retired VoiceMantri history available nahi hai.</p>';
  }
}
function connectBattle() {
  if (typeof io === "undefined") {
    battleMessage("Realtime contest client load nahi hua.", true);
    return;
  }
  const serverUrl = battleServerUrl();
  battleSocket = io(serverUrl, {
    transports: ["websocket", "polling"],
    auth: { battleVoterToken: BATTLE_VOTER_TOKEN, profileToken },
    reconnection: true,
    reconnectionAttempts: 8,
    timeout: 8000,
  });
  battleSocket.on("connect", () => {
    battleSocket.emit("battle:state");
  });
  battleSocket.on("battle:state", (state) => {
    const previous = battleState;
    battleState = state;
    renderBattle();
    if (previous && previous.contestId !== state.contestId)
      notifyCitizen(
        "New VoiceMantri contest",
        "A fresh 24-hour meme battle is open now.",
      );
  });
  battleSocket.on("presence:update", ({ onlineCount }) => {
    const counter = document.getElementById("onlineCount");
    if (counter) counter.textContent = onlineCount;
  });
  battleSocket.on("profile:update", (profile) => {
    communityState = communityState || {};
    communityState.profile = profile;
    saveJSON(LS_KEYS.profile, communityState);
    renderCommunity();
  });
  battleSocket.on("battle:update", (state) => {
    battleState = state;
    renderBattle();
  });
  battleSocket.on("battle:error", ({ message }) =>
    battleMessage(message || "Contest request failed.", true),
  );
  battleSocket.on("battle:submitted", () => {
    battleMessage("✅ Aapka meme submit ho gaya. Doosre user ka wait hai.");
    document.getElementById("battleTitle").value = "";
    document.getElementById("battleSubmissionText").value = "";
  });
  battleSocket.on("battle:vote-accepted", () =>
    battleMessage(
      "✅ Vote record ho gaya. Ek user ek contest mein sirf ek vote de sakta hai.",
    ),
  );
  battleSocket.on("battle:settled", (state) => {
    battleState = state;
    renderBattle();
    if (!state?.todayVoiceMantri && !(state?.submissions || []).length) return;
    battleMessage(
      "🏆 24-hour contest settle ho gaya. Today’s VoiceMantri update ho gaya.",
    );
    notifyCitizen(
      "VoiceMantri winner announced",
      state?.todayVoiceMantri
        ? `${state.todayVoiceMantri.author} won the meme battle.`
        : "Today’s winner is live in the Meme Sabha.",
    );
  });
  battleSocket.on("connect_error", (err) => {
    const sameOrigin = (() => {
      try {
        return new URL(serverUrl, location.href).origin === location.origin;
      } catch {
        return true;
      }
    })();
    const netlifyStatic =
      /(^|\\.)netlify\\.app$/i.test(location.hostname) ||
      /(^|\\.)netlify\\.com$/i.test(location.hostname);
    const hint =
      sameOrigin && netlifyStatic
        ? " Netlify par sirf frontend hai—server.js ko HTTPS Node hosting par chalao aur index.html mein MEME_CHAT_SERVER_URL set karo."
        : " Backend URL, HTTPS aur CORS setting check karo.";
    battleMessage(
      `Contest server se connect nahi ho pa raha: ${err?.message || "server unavailable"}.${hint}`,
      true,
    );
  });
}
document.getElementById("battleSubmitBtn").onclick = () => {
  const handle = document.getElementById("battleHandle").value.trim();
  const title = document.getElementById("battleTitle").value.trim();
  const memeText = document.getElementById("battleSubmissionText").value.trim();
  if (!handle || !title || !memeText)
    return battleMessage(
      "Name/handle, title aur meme text teeno bharna zaroori hai.",
      true,
    );
  if (!battleSocket?.connected)
    return battleMessage("Contest server se connection nahi hua.", true);
  battleSocket.emit("battle:submit", { handle, title, text: memeText });
};
document.querySelectorAll("[data-battle]").forEach((button) => {
  button.onclick = () => {
    const item = battleSubmission(button.dataset.battle);
    if (item)
      speak(
        "battle" + button.dataset.battle,
        item.text,
        button.dataset.battle === "A" ? voiceA.value : voiceB.value,
        1,
      );
  };
});
document.querySelectorAll("[data-vote]").forEach((button) => {
  button.onclick = () => {
    const item = battleSubmission(button.dataset.vote);
    if (item && battleSocket?.connected)
      battleSocket.emit("battle:vote", { submissionId: item.id });
  };
});
setInterval(battleCountdown, 1000);
connectBattle();

/* ---- roast arena ---- */
const arenas = document.getElementById("arenas");
arenas.innerHTML = ARENAS.map(
  ([name, cls, voice], i) => `
  <div class="arena ${cls}">
    <h3>${name}</h3>
    <p style="color:#ddd7cf;margin:10px 0 14px">${ROASTS[i]}</p>
    <button class="btn btn-ghost" data-roast="${i}" data-voice="${voice}">🔥 Roast It</button>
  </div>`,
).join("");

arenas.onclick = (e) => {
  const b = e.target.closest("[data-roast]");
  if (!b) return;
  speak(
    "roast" + b.dataset.roast,
    ROASTS[+b.dataset.roast],
    b.dataset.voice,
    1,
  );
};

/* ---- generator (template-based, no API needed) ---- */
const TPL = [
  (t) =>
    `Breaking news from every Indian household: ${t} has officially defeated all productivity. Experts are calling it a national emergency of laughter.`,
  (t) =>
    `Scene one: ${t} enters. Scene two: everyone panics. Scene three: someone makes chai. Interval.`,
  (t) =>
    `Beta, in our time we handled ${t} without internet, without shortcuts, and still topped the class. Now please recharge my phone.`,
  (t) =>
    `My fellow citizens! If elected, I promise to eliminate ${t} within one hundred days. Vote for me and enjoy free WiFi with it.`,
];
const genPlay = document.getElementById("genPlay");
const LOCALIZED_TEMPLATES = {
  hinglish: [
    (t) =>
      `${t} ka plan simple tha: chai, thoda jugaad, aur deadline ko ignore karna.`,
    (t) =>
      `Breaking news: ${t} ne poore group chat ko emergency meeting mein daal diya.`,
  ],
  english: [
    (t) => `I had a plan for ${t}. Then reality opened the group chat.`,
    (t) => `${t}: because apparently normal solutions were too boring.`,
  ],
  hindi: [
    (t) => `${t} का प्लान बहुत शानदार था, बस असली ज़िंदगी ने सहयोग नहीं किया।`,
    (t) => `ताज़ा खबर: ${t} के कारण पूरी चाय समिति की बैठक बुलानी पड़ी।`,
  ],
  marathi: [
    (t) => `${t} चा प्लॅन भारी होता, पण डेडलाईनने सगळा खेळ बिघडवला.`,
    (t) => `ताजी बातमी: ${t} मुळे चहाची तातडीची बैठक बोलावली गेली.`,
  ],
  tamil: [
    (t) =>
      `${t} திட்டம் செம்மையாக இருந்தது; ஆனால் deadline வந்து எல்லாவற்றையும் மாற்றிவிட்டது.`,
    (t) => `செய்தி: ${t} காரணமாக முழு குழுவும் அவசர meeting வைத்தது.`,
  ],
  bengali: [
    (t) => `${t}-এর প্ল্যান দারুণ ছিল, কিন্তু deadline এসে সব গুলিয়ে দিল।`,
    (t) => `ব্রেকিং নিউজ: ${t} নিয়ে পুরো গ্রুপ চ্যাটে জরুরি সভা বসেছে।`,
  ],
};
const TEMPLATE_LIBRARY = [
  ["drama", "Bollywood Drama", "When the topic becomes a full interval scene"],
  ["office", "Office Survival", "Deadline, meeting aur chai ka perfect combo"],
  ["student", "Exam Night", "Syllabus vs confidence — classic format"],
  ["cricket", "Last Over Panic", "One ball, infinite opinions"],
  ["family", "Desi Family", "Mummy, relatives aur unsolicited advice"],
  ["politics", "Meme Parliament", "Promises, manifestos aur public reaction"],
];
const templateLibrary = document.getElementById("templateLibrary");
if (templateLibrary)
  templateLibrary.innerHTML = TEMPLATE_LIBRARY.map(
    ([id, title, desc]) =>
      `<button class="template-card" data-template="${id}"><strong>${title}</strong><span>${desc}</span><small>Use template →</small></button>`,
  ).join("");
templateLibrary?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-template]");
  if (!b) return;
  document.getElementById("topic").value =
    b.querySelector("strong").textContent;
  document.getElementById("genBtn").click();
});
document.getElementById("genBtn").onclick = async () => {
  const t = (
    document.getElementById("topic").value || "Monday morning traffic"
  ).trim();
  const lang = document.getElementById("lang").value;
  const button = document.getElementById("genBtn");
  button.disabled = true;
  button.textContent = "⏳ Creating natural regional meme…";
  let line = "";
  try {
    const res = await fetch("/api/public/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: t, language: lang, tone: "funny" }),
    });
    const data = await res.json();
    line = data.text || "";
  } catch {}
  if (!line) {
    const templates = LOCALIZED_TEMPLATES[lang] || LOCALIZED_TEMPLATES.hinglish;
    line = templates[Math.floor(Math.random() * templates.length)](t);
  }
  document.getElementById("genOut").textContent =
    `${document.getElementById("lang").selectedOptions[0].text}: ${line}`;
  genPlay.disabled = false;
  document.getElementById("genImage").disabled = false;
  genPlay.dataset.text = line;
  button.disabled = false;
  button.textContent = "⚡ Generate Meme";
};
genPlay.onclick = () => speak("gen", genPlay.dataset.text, voiceSel.value, 1);

/* ---- FIX: exportGeneratedMeme() was referenced by the genImage button
   but never defined anywhere in the file. Added here, self-contained —
   it builds its own off-screen canvas and downloads a PNG, so it does
   not touch memePreviewCanvas or any of the uploaded-image editor state
   used elsewhere (uploadedImage, selectedSticker, drawImageMeme, etc). */
function exportGeneratedMeme() {
  const text = (
    genPlay.dataset.text ||
    document.getElementById("genOut").textContent ||
    ""
  )
    .replace(/^[^:]*:\s*/, "")
    .trim();
  if (!text) {
    const out = document.getElementById("genOut");
    if (out)
      out.textContent = "⚠️ Pehle ek meme generate karo, phir image save karo.";
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#171916");
  gradient.addColorStop(1, "#2c1c0d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.textAlign = "center";
  context.fillStyle = "#ffad3d";
  context.font = "700 42px 'Bebas Neue', 'Space Grotesk', sans-serif";
  context.fillText("MEMEMANTRI", canvas.width / 2, 96);

  const size = 52;
  const outline = 6;
  context.font = `700 ${size}px 'Space Grotesk', sans-serif`;
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = outline;
  context.strokeStyle = "#000";
  context.fillStyle = "#fff";

  const maxWidth = canvas.width - 140;
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  const shown = lines.slice(0, 10);

  const lineHeight = size * 1.2;
  const startY =
    (canvas.height - shown.length * lineHeight) / 2 + lineHeight / 2;
  shown.forEach((entry, i) => {
    const y = startY + i * lineHeight;
    context.strokeText(entry, canvas.width / 2, y);
    context.fillText(entry, canvas.width / 2, y);
  });

  context.font = "16px 'Space Grotesk', sans-serif";
  context.fillStyle = "rgba(255,255,255,0.55)";
  context.fillText("mememantri.app", canvas.width / 2, canvas.height - 36);

  const link = document.createElement("a");
  link.download = "mememantri-generated-meme.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

document.getElementById("genImage").onclick = () => exportGeneratedMeme();
const imageUpload = document.getElementById("memeImageUpload");
const imageCaption = document.getElementById("imageCaption");
const renderImageMemeButton = document.getElementById("renderImageMeme");
const previewCanvas = document.getElementById("memePreviewCanvas");
let uploadedImage = null,
  selectedSticker = "";
const editorInputs = [
  imageCaption,
  document.getElementById("captionPosition"),
  document.getElementById("captionSize"),
  document.getElementById("captionOutline"),
];
function redrawImageMeme() {
  if (uploadedImage)
    drawImageMeme(
      uploadedImage,
      imageCaption.value.trim() || "MemeMantri citizen approved",
      false,
    );
}
imageUpload.onchange = () => {
  const file = imageUpload.files?.[0];
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    uploadedImage = new Image();
    uploadedImage.onload = () => {
      renderImageMemeButton.disabled = false;
      document.getElementById("memePreviewHint").hidden = true;
      document.getElementById("imageFactoryMessage").textContent =
        "Live preview ready. Tune position, size, outline or add a sticker.";
      redrawImageMeme();
    };
    uploadedImage.src = reader.result;
  };
  reader.readAsDataURL(file);
};
editorInputs.forEach((input) =>
  input.addEventListener("input", redrawImageMeme),
);
document.querySelectorAll("[data-sticker]").forEach(
  (b) =>
    (b.onclick = () => {
      selectedSticker = b.dataset.sticker;
      redrawImageMeme();
    }),
);
document.getElementById("clearSticker").onclick = () => {
  selectedSticker = "";
  redrawImageMeme();
};
renderImageMemeButton.onclick = () => {
  if (uploadedImage) {
    drawImageMeme(
      uploadedImage,
      imageCaption.value.trim() || "MemeMantri citizen approved",
      true,
    );
    document.getElementById("imageFactoryMessage").textContent =
      "Captioned image downloaded.";
  }
};
function drawImageMeme(image, caption, download = false) {
  const canvas = previewCanvas;
  const context = canvas.getContext("2d");
  const scale = Math.max(
    canvas.width / image.width,
    canvas.height / image.height,
  );
  const width = image.width * scale,
    height = image.height * scale;
  context.fillStyle = "#111";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    (canvas.width - width) / 2,
    (canvas.height - height) / 2,
    width,
    height,
  );
  context.fillStyle = "rgba(0,0,0,.28)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const size = Number(document.getElementById("captionSize").value),
    outline = Number(document.getElementById("captionOutline").value),
    pos = document.getElementById("captionPosition").value;
  context.font = `700 ${size}px Space Grotesk, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = outline;
  context.strokeStyle = "#000";
  context.fillStyle = "#fff";
  const max = canvas.width - 44,
    lines = [];
  let line = "";
  caption.split(/\s+/).forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > max && line) {
      lines.push(line);
      line = word;
    } else line = test;
  });
  if (line) lines.push(line);
  const shown = lines.slice(0, 5),
    lineHeight = size * 1.12;
  const start =
    pos === "top"
      ? 32 + lineHeight / 2
      : pos === "center"
        ? (canvas.height - shown.length * lineHeight) / 2 + lineHeight / 2
        : canvas.height - 32 - (shown.length - 1) * lineHeight - lineHeight / 2;
  shown.forEach((entry, i) => {
    const y = start + i * lineHeight;
    context.strokeText(entry, canvas.width / 2, y);
    context.fillText(entry, canvas.width / 2, y);
  });
  if (selectedSticker) {
    context.font = "72px sans-serif";
    context.fillText(selectedSticker, canvas.width - 60, 60);
  }
  if (download) {
    const link = document.createElement("a");
    link.download = "mememantri-image-meme.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
}
/* ---- user meme submission ---- */
const subCategory = document.getElementById("subCategory");
subCategory.innerHTML = CATEGORIES.filter(([id]) => id !== "all")
  .map(([id, l, e]) => `<option value="${id}">${e} ${l}</option>`)
  .join("");

function renderUserGrid() {
  const grid = document.getElementById("userMemeGrid");
  if (!grid) return;
  const submittedIndian = userMemes
    .filter((m) => INDIAN_CATEGORIES.has(m.category))
    .concat(serverUserMemes);
  grid.innerHTML = submittedIndian.length
    ? submittedIndian.slice().reverse().map(memeCardHTML).join("")
    : `<p class="empty-state">Koi Indian meme submit nahi hua abhi tak — sabse pehla tum ho jao! 🎤</p>`;
  syncMemeDetail();
}
document.getElementById("userMemeGrid")?.addEventListener("click", async (e) => {
  if (await handleMemeShare(e, (id) => getAllMemes().find((x) => x.id === id)))
    return;
  const detailBtn = e.target.closest("[data-detail]");
  if (detailBtn) {
    openMemeDetail(detailBtn.dataset.detail);
    return;
  }
  const reportBtn = e.target.closest("[data-report]");
  if (reportBtn) {
    openReportModal(reportBtn.dataset.report);
    return;
  }
  const likeBtn = e.target.closest("[data-like]");
  if (likeBtn) {
    await toggleLikeForMeme(likeBtn.dataset.like);
    return;
  }
  const b = e.target.closest("[data-play]");
  if (!b) return;
  const m = getAllMemes().find((x) => x.id === b.dataset.play);
  currentId === m.id
    ? stopSpeak()
    : speak(m.id, m.text, voiceSel.value, speedVal);
});
document.getElementById("detailBody").onclick = async (e) => {
  if (await handleMemeShare(e, (id) => getAllMemes().find((x) => x.id === id)))
    return;
  const reportBtn = e.target.closest("[data-report]");
  if (reportBtn) {
    openReportModal(reportBtn.dataset.report);
    return;
  }
  const saveBtn = e.target.closest("[data-save]");
  if (saveBtn) {
    await toggleSaveForMeme(saveBtn.dataset.save);
    return;
  }
  const likeBtn = e.target.closest("[data-like]");
  if (likeBtn) {
    await toggleLikeForMeme(likeBtn.dataset.like);
    return;
  }
  const b = e.target.closest("[data-play]");
  if (!b) return;
  const m = getAllMemes().find((x) => x.id === b.dataset.play);
  currentId === m.id
    ? stopSpeak()
    : speak(m.id, m.text, voiceSel.value, speedVal);
};
document.getElementById("detailClose").onclick = closeMemeDetail;
document.getElementById("detailBackdrop").onclick = (e) => {
  if (e.target.id === "detailBackdrop") closeMemeDetail();
};
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!document.getElementById("detailBackdrop")?.hidden) closeMemeDetail();
  if (!document.getElementById("reportBackdrop")?.hidden) closeReportModal();
});
document.getElementById("userMemeGrid")?.addEventListener(
  "toggle",
  (e) => {
    const box = e.target.querySelector?.("[data-comments-for]");
    if (e.target.open && box)
      loadMemeComments(e.target.closest(".meme-card"), box.dataset.commentsFor);
  },
  true,
);

async function loadSubmissionStatuses() {
  const list = document.getElementById("submissionStatusList");
  const summary = document.getElementById("submissionStatusSummary");
  if (!list) return;
  try {
    const response = await fetch("/api/public/submissions", {
      headers: apiHeaders(),
    });
    const data = await response.json();
    const rows = data.submissions || [];
    if (summary) summary.textContent = `${rows.length} total`;
    list.innerHTML = rows.length
      ? rows
          .map((item) => {
            const note = item.review_note
              ? `<small>${escapeHtml(item.review_note)}</small>`
              : "";
            return `<div class="submission-row"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${new Date(item.created_at).toLocaleDateString()}</span></div><span class="status-badge status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>${note}</div>`;
          })
          .join("")
      : `<p class="sub">No submissions yet.</p>`;
  } catch {
    if (summary) summary.textContent = "Offline";
  }
}
async function loadMySubmissionsPanel() {
  const list = document.getElementById("mySubmissionsList");
  const summary = document.getElementById("mySubmissionsSummary");
  const count = document.getElementById("mySubmissionsCount");
  if (!list) return;
  try {
    const response = await fetch("/api/public/submissions", {
      headers: apiHeaders(),
    });
    const data = await response.json();
    const rows = data.submissions || [];
    const localRows = rows.filter((item) => (item.scope || (item.category === "global" ? "global" : "local")) === "local");
    serverUserPetitions = localRows.map((item) => ({
      id: item.published_meme_id ? `srv${item.published_meme_id}` : `petition${item.id}`,
      title: item.title,
      category: item.category || "community",
      creator: item.creator || "@anonymous",
      text: item.text,
      likes: item.published_likes || 0,
      plays: item.published_plays || 0,
      userSubmitted: true,
      submissionStatus: item.status,
      featured: false,
    }));
    serverUserMemes = serverUserPetitions.filter((item) => item.submissionStatus === "approved");
    if (count) count.textContent = rows.length;
    if (summary) summary.textContent = `${rows.length} total`;
    list.innerHTML = rows.length
      ? rows.map((item) => {
          const note = item.review_note ? `<small>${escapeHtml(item.review_note)}</small>` : "";
          return `<div class="submission-row"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${new Date(item.created_at).toLocaleDateString()}</span></div><span class="status-badge status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>${note}</div>`;
          }).join("")
      : `<p class="sub">No submissions yet. Drop your first meme below.</p>`;
    renderGrid();
    renderUserGrid();
  } catch {
    if (summary) summary.textContent = "Offline";
    list.innerHTML = `<p class="sub">Submissions load nahi ho paaye.</p>`;
  }
}
document.getElementById("mySubmissionsBtn")?.addEventListener("click", async (event) => {
  const panel = document.getElementById("mySubmissionsPanel");
  if (!panel) return;
  const open = panel.hidden;
  panel.hidden = !open;
  event.currentTarget.setAttribute("aria-expanded", String(open));
  if (open) await loadMySubmissionsPanel();
});
document.getElementById("userPetitionsBtn")?.addEventListener("click", async (event) => {
  userPetitionsOnly = !userPetitionsOnly;
  event.currentTarget.classList.toggle("btn-green", userPetitionsOnly);
  event.currentTarget.textContent = userPetitionsOnly
    ? "📮 Showing your petitions"
    : "📮 Users petitions";
  savedOnly = false;
  document.getElementById("savedOnlyBtn")?.classList.remove("btn-green");
  resetFeedGroup();
  if (userPetitionsOnly && !serverUserPetitions.length) await loadMySubmissionsPanel();
  renderGrid();
  document.getElementById("feed")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("subBtn").onclick = async () => {
  const title = document.getElementById("subTitle").value.trim();
  const text = document.getElementById("subText").value.trim();
  const creatorRaw = document.getElementById("subCreator").value.trim();
  const cat = subCategory.value;
  const msg = document.getElementById("subMsg");

  if (!title || !text) {
    msg.textContent = "⚠️ Title aur meme text dono zaroori hain.";
    msg.style.color = "var(--red)";
    return;
  }
  const creator = creatorRaw
    ? creatorRaw.startsWith("@")
      ? creatorRaw
      : "@" + creatorRaw
    : "@anonymous";
  try {
    const res = await fetch("/api/public/petitions", {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        title,
        text,
        category: cat,
        creator,
        token: profileToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Submit fail ho gaya.");
    msg.textContent = "✅ " + data.message;
    msg.style.color = "var(--green)";
    if (data.profile) {
      communityState = communityState || {};
      communityState.profile = data.profile;
      saveJSON(LS_KEYS.profile, communityState);
      renderCommunity();
    }
    showModerationWarning(data.warning);
    loadSubmissionStatuses();
    loadMySubmissionsPanel();
    document.getElementById("subTitle").value = "";
    document.getElementById("subText").value = "";
    document.getElementById("subCreator").value = "";
  } catch (err) {
    /* server unreachable — fall back to local-only preview so the page still works */
    const meme = {
      id: "u" + Date.now(),
      title,
      text,
      category: cat,
      creator,
      likes: 0,
      plays: 0,
      userSubmitted: true,
    };
    userMemes.push(meme);
    saveJSON(LS_KEYS.userMemes, userMemes);
    msg.textContent = "✅ Submit ho gaya (local preview). Neeche dekho.";
    msg.style.color = "var(--green)";
    renderUserGrid();
    renderGrid();
  }
};

renderUserGrid();

/* Meme Adda now lives on adda.html. */

/* ---- smooth scroll nav ---- */
document.querySelectorAll("[data-jump]").forEach((b) => {
  b.onclick = () => {
    const el = document.getElementById(b.dataset.jump);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
});

const ELEVENLABS_API_KEY = ""; // not used — browser-native speechSynthesis handles narration

/* ---------------------------------------------------------------------
   Live sync with the admin-managed backend (memes, ministries, ticker,
   MOTD pin, maintenance mode). Falls back to the static content above
   if the server is unreachable, so the page still works standalone.
   --------------------------------------------------------------------- */
function showMaintenanceOverlay(message, title) {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:9999;background:#0e100f;color:#f7f2e9;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-family:'Space Grotesk',sans-serif;";
  overlay.innerHTML = `<div><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#ffad3d;">Maintenance</div><h1 style="font-family:'Bebas Neue',sans-serif;font-size:48px;margin:10px 0;">${escapeHtml(title || "MemeMantri")}</h1><p style="color:#a8afa9;max-width:480px;margin:auto">${escapeHtml(message || "Site abhi maintenance mein hai.")}</p></div>`;
  document.body.appendChild(overlay);
}
function renderCommunity() {
  const state = communityState;
  const profile = state?.profile;
  if (!profile) return;
  const name = document.getElementById("profileNameDisplay");
  if (name) name.textContent = profile.nickname;
  const avatar = document.getElementById("profileAvatarPreview");
  if (avatar) avatar.textContent = profile.avatar;
  const points = document.getElementById("profilePoints");
  if (points) points.textContent = profile.points;
  const streak = document.getElementById("profileStreak");
  if (streak) streak.textContent = profile.currentStreak;
  const badgesCount = document.getElementById("profileBadgesCount");
  if (badgesCount) badgesCount.textContent = (profile.badges || []).length;
  const rank = document.getElementById("profileRank");
  if (rank)
    rank.textContent = `Rank #${profile.rank || "—"} · Longest streak ${profile.longestStreak || 1} days`;
  const badgeRow = document.getElementById("badgeRow");
  if (badgeRow)
    badgeRow.innerHTML =
      (profile.badges || [])
        .map(
          (badge) =>
            `<span class="badge-chip" title="${escapeHtml(badge.description)}">${badge.icon} ${escapeHtml(badge.title)}</span>`,
        )
        .join("") || `<span class="sub">Earn badges by participating.</span>`;
  const followList = document.getElementById("followList");
  if (followList)
    followList.innerHTML = (state.ministries || [])
      .map(
        (ministry) =>
          `<button class="follow-item${profile.follows?.includes(ministry.key) ? " active" : ""}" data-follow="${escapeHtml(ministry.key)}">${ministry.emoji} ${escapeHtml(ministry.name)}</button>`,
      )
      .join("");
  const leaderboard = document.getElementById("leaderboardList");
  if (leaderboard)
    leaderboard.innerHTML =
      (state.leaderboard || [])
        .map(
          (row) =>
            `<div class="leader-row"><span class="leader-rank">#${row.rank}</span><span class="leader-avatar">${escapeHtml(row.avatar)}</span><span class="leader-name">${escapeHtml(row.nickname)}${row.streak >= 3 ? " 🔥" : ""}</span><strong class="leader-points">${row.points} pts</strong></div>`,
        )
        .join("") || `<p class="sub">Be the first citizen on the board.</p>`;
  const trending = document.getElementById("trendingList");
  if (trending)
    trending.innerHTML =
      (state.trending || [])
        .map(
          (row) =>
            `<button class="trend-row" data-trending-id="srv${row.id}"><span>🔥</span><span class="trend-copy"><span class="trend-title">${escapeHtml(row.title)}</span><span class="trend-meta">${escapeHtml(row.creator)} · ❤️ ${fmt(row.likes)}</span></span></button>`,
        )
        .join("") || `<p class="sub">Trends are warming up.</p>`;
  const referral = document.getElementById("referralLink");
  if (referral)
    referral.value = `${location.origin}${location.pathname}?ref=${encodeURIComponent(profile.token)}`;
  const nickname = document.getElementById("profileNickname");
  if (nickname && document.activeElement !== nickname)
    nickname.value = profile.nickname;
  const avatarSelect = document.getElementById("profileAvatar");
  if (avatarSelect) avatarSelect.value = profile.avatar;
  const deptSelect = document.getElementById("profileDepartment");
  if (deptSelect && document.activeElement !== deptSelect) {
    const ministries = state.ministries || [];
    deptSelect.innerHTML =
      `<option value="">🏢 Favourite department: Auto</option>` +
      ministries
        .map(
          (m) =>
            `<option value="${escapeHtml(m.key)}">${escapeHtml(m.emoji)} ${escapeHtml(m.name)}</option>`,
        )
        .join("");
    deptSelect.value = profile.favouriteDepartmentOverride || "";
  }
  const online = document.getElementById("onlineCount");
  if (online && state.onlineCount) online.textContent = state.onlineCount;
}
document.getElementById("saveDepartment")?.addEventListener("click", async () => {
  const select = document.getElementById("profileDepartment");
  const message = document.getElementById("departmentMessage");
  if (!select) return;
  try {
    const response = await fetch("/api/public/passport/department", {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ departmentKey: select.value }),
    });
    const data = await response.json();
    if (data.ok) {
      communityState = communityState || {};
      communityState.profile = communityState.profile || {};
      communityState.profile.favouriteDepartmentOverride = select.value;
      saveJSON(LS_KEYS.profile, communityState);
      if (message) {
        message.textContent = "Favourite department updated.";
        message.style.color = "var(--green)";
      }
    } else if (message) message.textContent = "Update nahi ho paya, dobara try karo.";
  } catch {
    if (message) message.textContent = "Update nahi ho paya, dobara try karo.";
  }
});

document.getElementById("saveProfile").onclick = async () => {
  const message = document.getElementById("profileMessage");
  const response = await fetch("/api/public/profile", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      token: profileToken,
      nickname: document.getElementById("profileNickname").value,
      avatar: document.getElementById("profileAvatar").value,
    }),
  });
  const data = await response.json();
  if (data.profile) {
    communityState = communityState || {};
    communityState.profile = data.profile;
    saveJSON(LS_KEYS.profile, communityState);
    renderCommunity();
    message.textContent = "Profile saved. Welcome back, citizen.";
    message.style.color = "var(--green)";
  }
};
document.getElementById("followList")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-follow]");
  if (!button) return;
  const response = await fetch("/api/public/profile/follows", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      token: profileToken,
      ministryKey: button.dataset.follow,
    }),
  });
  const data = await response.json();
  if (data.profile) {
    communityState = communityState || {};
    communityState.profile = data.profile;
    saveJSON(LS_KEYS.profile, communityState);
    renderCommunity();
  }
});
document.getElementById("trendingList")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-trending-id]");
  if (!button) return;
  category = "all";
  searchTerm = "";
  document.getElementById("search").value = "";
  renderGrid();
  const card = document.querySelector(
    `[data-meme-id="${button.dataset.trendingId}"]`,
  );
  card?.scrollIntoView({ behavior: "smooth", block: "center" });
  card?.classList.add("shared-highlight");
});
document.getElementById("copyReferral").onclick = async () => {
  const input = document.getElementById("referralLink");
  try {
    await navigator.clipboard.writeText(input.value);
    document.getElementById("profileMessage").textContent =
      "Invite link copied.";
  } catch {
    input.select();
    document.execCommand("copy");
  }
};
document.getElementById("enableAlerts")?.addEventListener("click", async () => {
  const status = document.getElementById("alertMessage");
  if (!("Notification" in window)) {
    if (status) status.textContent = "This browser does not support alerts.";
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    localStorage.setItem(LS_KEYS.alerts, "1");
    if (status)
      status.textContent =
        "Alerts enabled. We will check trending updates while this page is open.";
  } else if (status) status.textContent = "Alerts remain off until you allow them.";
});
let lastTrendTop = null;
async function checkTrendingAlert() {
  if (
    localStorage.getItem(LS_KEYS.alerts) !== "1" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  const top = communityState?.trending?.[0];
  if (top && lastTrendTop && top.id !== lastTrendTop)
    new Notification("MemeMantri trend alert", {
      body: `${top.title} is trending in the Sabha 🔥`,
    });
  if (top) lastTrendTop = top.id;
}

async function syncWithServer() {
  let site, memes;
  try {
    [site, memes] = await Promise.all([
      fetch("/api/public/site").then((r) => r.json()),
      fetch("/api/public/memes").then((r) => r.json()),
    ]);
  } catch {
    return; /* server unreachable — keep static fallback content */
  }
  fetch(
    `/api/public/referral/visit?ref=${encodeURIComponent(new URLSearchParams(location.search).get("ref") || "")}`,
    { headers: { "X-MemeMantri-Token": profileToken } },
  ).catch(() => {});
  await refreshCommunity();
  loadMySubmissionsPanel();
  checkTrendingAlert();

  if (site.maintenance) {
    showMaintenanceOverlay(site.maintenanceMessage, site.siteTitle);
    return;
  }

  if (site.siteTitle && !requestedMemeId())
    document.title = document.title.replace(/^[^—]+/, site.siteTitle + " ");
  const taglineEl = document.getElementById("siteTagline");
  if (taglineEl && site.tagline) taglineEl.textContent = site.tagline;

  if (Array.isArray(site.ministries) && site.ministries.length) {
    CATEGORIES = [["all", "All India", "🇮🇳"], ...site.ministries];
  }
  if (Array.isArray(memes) && memes.length) {
    MAIN_MEMES = memes.map((m) => ({
      id: "srv" + m.id,
      title: m.title,
      category: m.category,
      creator: m.creator,
      text: m.text,
      likes: m.likes || 0,
      plays: m.plays || 0,
      featured: !!m.featured,
      comments: m.comments || 0,
    }));
  }
  motdPinnedId = site.motdMemeId ? "srv" + site.motdMemeId : null;

  if (Array.isArray(site.ticker) && site.ticker.length) {
    document.getElementById("ticker").innerHTML = [0, 1]
      .map(() =>
        site.ticker.map((t) => `<span>${escapeHtml(t)}</span>`).join(""),
      )
      .join("");
  }

  chips.innerHTML = CATEGORIES.map(
    ([id, l, e]) =>
      `<button class="chip${id === category ? " active" : ""}" data-cat="${id}">${e} ${l}</button>`,
  ).join("");
  subCategory.innerHTML = CATEGORIES.filter(([id]) => id !== "all")
    .map(([id, l, e]) => `<option value="${id}">${e} ${l}</option>`)
    .join("");
  renderGrid();
  renderMotd();
  renderUserGrid();
  window.setTimeout(focusSharedMeme, 80);
}
hydrateCitizenIdentity().then(() => syncWithServer());
setInterval(() => {
  refreshCommunity().then(checkTrendingAlert);
}, 30000);
/* MemeMantri Visual Overhaul — integrated Phase 1/2/3 layer */
(() => {
  const esc = (value) => (typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? ""));
  const categoryVisuals = {
    cricket: ["🏏", "LAST OVER ENERGY"], student: ["📚", "EXAM NIGHT FILES"], bollywood: ["🎬", "FULL FILMY MODE"], politics: ["🏛️", "LIVE FROM SANSAD"], tech: ["💻", "TECH SUPPORT DESK"], hindi: ["🪔", "हिंदी विभाग"], desi: ["☕", "DESI DEPARTMENT"], gaming: ["🎮", "RANK PUSH LIVE"], love: ["💘", "DIL KI COMMITTEE"], funny: ["😂", "LAUGHTER MINISTRY"], trending: ["🔥", "TRENDING NOW"], genz: ["🧠", "VIBE CHECK"], science: ["🔬", "RESEARCH WING"], all: ["🇮🇳", "MEME MINISTRY"]
  };
  const personaInfo = [
    ["anchor_m", "🎙️", "News Anchor", "Breaking delivery"], ["rj_f", "📻", "Radio Jockey", "Full energy"], ["cric_m", "🏏", "Cricket Commentator", "Last-over mode"], ["bolly_f", "🎬", "Bollywood Narrator", "Drama max"], ["roast_m", "🔥", "Roast Master", "No mercy"], ["aunty_f", "👵", "Desi Aunty", "Ghar ki CCTV"], ["comic_m", "😂", "Stand-up Comic", "Punchline pro"], ["dada_m", "👴", "Dada Storyteller", "Classic vibes"]
  ];
  const visualFor = (m) => categoryVisuals[m.category] || categoryVisuals.all;
  // Keep the complete meme copy visible in the visual card; CSS handles sizing.
  const shortPunchline = (text) => String(text || "").trim();

  function visualMemeCardHTML(m) {
    const [emoji, kicker] = visualFor(m);
    const likes = typeof getLikes === "function" ? getLikes(m) : (m.likes || 0);
    const plays = typeof getPlays === "function" ? getPlays(m) : (m.plays || 0);
    const liked = typeof likedIds !== "undefined" && likedIds.has(m.id);
    const saved = typeof savedIds !== "undefined" && savedIds.has(m.id);
    const server = String(m.id).startsWith("srv");
    return `<article class="card glass meme-card visual-card${m.featured ? " is-featured" : ""}" data-meme-id="${esc(m.id)}" data-category="${esc(m.category)}">
      ${m.featured ? '<span class="card-badge">⭐ FEATURED</span>' : ""}
      <div class="meme-visual"><div class="visual-kicker"><span>${esc(kicker)}</span><span>${esc(m.category || "meme")}</span></div><div class="visual-emoji">${emoji}</div><div class="visual-punchline">${esc(shortPunchline(m.text))}</div></div>
      <div class="visual-copy"><div class="card-topline"><span class="tag">${esc(m.category)}${m.userSubmitted ? " · community" : ""}</span></div><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p><div class="meta"><span>${esc(m.creator)}</span><span>❤️ ${typeof fmt === "function" ? fmt(likes) : likes} · ▶ ${typeof fmt === "function" ? fmt(plays) : plays}</span></div>
      <div class="visual-actions"><button class="btn ${typeof currentId !== "undefined" && currentId === m.id ? "btn-green" : "btn-primary"}" data-play="${esc(m.id)}">${typeof currentId !== "undefined" && currentId === m.id ? '<span class="eq"><i></i><i></i><i></i><i></i></span> Playing' : "🔊 Listen"}</button><button class="icon-action${liked ? " active" : ""}" data-like="${esc(m.id)}" aria-label="Like meme">${liked ? "❤️" : "🤍"}</button><button class="icon-action${saved ? " active" : ""}" data-save="${esc(m.id)}" aria-label="Save meme">🔖</button>${server ? `<button class="icon-action" data-report="${esc(m.id)}" aria-label="Report meme">⚑</button>` : ""}</div>
      <div class="share-actions" aria-label="Share this meme">${typeof shareIconsHTML === "function" ? shareIconsHTML(m.id).replace('<div class="share-actions" aria-label="Share this meme">','') : ""}</div><p class="share-status" data-share-status aria-live="polite"></p></div><button class="view-detail-btn" data-detail="${esc(m.id)}">🔍 View Full Meme</button>${server ? `<details class="comments-box"><summary>💬 ${m.comments || 0} reactions</summary><div class="comments-content" data-comments-for="${esc(m.id)}">Open to load comments…</div></details>` : ""}</article>`;
  }
  // Override legacy text cards with visual compositions while preserving all data hooks.
  window.visualMemeCardHTML = visualMemeCardHTML;
  try { memeCardHTML = visualMemeCardHTML; } catch {}

  function injectCommandDeck() {
    const hero = document.querySelector(".hero .wrap");
    if (!hero || document.getElementById("visualCommandDeck")) return;
    const deck = document.createElement("div"); deck.id = "visualCommandDeck"; deck.className = "visual-command-deck";
    deck.innerHTML = `<div class="visual-deck-card"><h3>Read less. Feel more.</h3><p>Har meme ab poster, voice clip aur shareable moment banega.</p><div class="visual-deck-actions"><button class="visual-deck-chip" data-jump="feed">🔥 Explore visual feed</button><button class="visual-deck-chip" data-jump="generator">⚡ Create a meme</button><button class="visual-deck-chip" data-jump="radio">📻 Tune in</button></div></div><div class="visual-deck-card"><div class="visual-deck-stat"><div><strong>3</strong><span>visual modes</span></div><div><strong>16</strong><span>voice personas</span></div><div><strong>∞</strong><span>reactions</span></div></div></div>`;
    hero.appendChild(deck);
    deck.addEventListener("click", (e) => { const b = e.target.closest("[data-jump]"); if (b) document.getElementById(b.dataset.jump)?.scrollIntoView({behavior:"smooth"}); });
  }

  function injectPersonaCards() {
    const voice = document.getElementById("voice");
    if (!voice || document.getElementById("personaCards")) return;
    const holder = document.createElement("div"); holder.className = "persona-picker"; holder.innerHTML = `<div class="persona-picker-head"><span>Choose your narrator character</span><small id="personaHint">Tap to preview a voice style</small></div><div class="persona-cards" id="personaCards"></div>`;
    voice.closest(".controls")?.appendChild(holder);
    const cards = holder.querySelector("#personaCards");
    cards.innerHTML = personaInfo.map(([id, emoji, name, hint]) => `<button type="button" class="persona-card${voice.value === id ? " active" : ""}" data-persona="${id}"><span class="persona-avatar">${emoji}</span><b>${name}</b><small>${hint}</small></button>`).join("");
    cards.addEventListener("click", (e) => { const card = e.target.closest("[data-persona]"); if (!card) return; voice.value = card.dataset.persona; voice.dispatchEvent(new Event("change", {bubbles:true})); cards.querySelectorAll(".persona-card").forEach((c) => c.classList.toggle("active", c === card)); document.getElementById("personaHint").textContent = `${card.querySelector("b").textContent} selected`; });
  }

  function enhanceFM() {
    const player = document.querySelector(".fm-player");
    if (!player || player.querySelector(".fm-visual-stage")) return;
    player.classList.add("visual-fm"); const stage = document.createElement("div"); stage.className = "fm-visual-stage"; stage.innerHTML = `<div class="fm-avatar-orb">📻</div><div><div class="fm-now-copy">NOW BROADCASTING · MEME FM 69.9</div><div class="fm-wave active" aria-hidden="true">${Array.from({length:18},(_,i)=>`<i style="animation-delay:${(i%7)*.08}s"></i>`).join("")}</div><small class="fm-now-copy">Live satire, Indian voices, zero boring minutes.</small></div>`;
    player.insertBefore(stage, player.querySelector(".fm-progress-row"));
    document.getElementById("fmPlay")?.addEventListener("click", () => player.classList.toggle("playing"));
  }
  function enhanceArena() { document.querySelectorAll("#arenas .arena").forEach((arena) => { arena.classList.add("visual-arena"); if (!arena.querySelector(".arena-score")) arena.insertAdjacentHTML("beforeend", `<div class="arena-score"><span>😂 Audience 1.2K</span><span>🔥 Roast meter 78%</span></div>`); }); }
  function enhanceParliament() { document.querySelectorAll(".ministry-card").forEach((card) => { if (!card.querySelector(".ministry-live")) card.insertAdjacentHTML("beforeend", `<div class="ministry-live"><i></i> Ministry active · Public hearing open</div>`); }); }
  function enhanceFactory() { const lib = document.querySelector(".template-library"); if (lib) { lib.classList.add("visual-template-library"); document.getElementById("templateLibrary")?.classList.add("visual-template-grid"); } const imageFactory = document.querySelector(".image-factory"); if (imageFactory && !imageFactory.querySelector(".phase3-rail")) imageFactory.insertAdjacentHTML("beforeend", `<div class="phase3-rail"><div class="phase3-tile">🎨 <b>AI Artwork</b><span>Category-based visual poster foundation.</span><em>PHASE 3 READY</em></div><div class="phase3-tile">🎞️ <b>Short Clips</b><span>Turn a punchline into a vertical moment.</span><em>PHASE 3 READY</em></div><div class="phase3-tile">📱 <b>Reel Mode</b><span>Swipe-first mobile feed foundation.</span><em>PHASE 3 READY</em></div><div class="phase3-tile">🎧 <b>Audio Meme</b><span>Voice-first shareable meme clips.</span><em>PHASE 3 READY</em></div><div class="phase3-tile">👤 <b>Creator Page</b><span>Collect your memes and badges.</span><em>PHASE 3 READY</em></div></div>`); }
  function reRender() { if (typeof renderGrid === "function") renderGrid(); if (typeof renderMotd === "function") renderMotd(); if (typeof renderUserGrid === "function") renderUserGrid(); }
  function initVisualOverhaul() { injectPersonaCards(); enhanceFM(); enhanceArena(); enhanceParliament(); enhanceFactory(); reRender(); const grid = document.getElementById("memeGrid"); grid?.classList.add("visual-masonry"); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initVisualOverhaul); else setTimeout(initVisualOverhaul, 0);
})();
