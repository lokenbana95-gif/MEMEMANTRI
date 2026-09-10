/* =========================================================================
   Meme FM 69.9 — simulated 24x7 live broadcast
   -------------------------------------------------------------------------
   - The day is split into 48 half-hour "slots" (48 x 30min = 24 hours).
   - Slots alternate between two shows: "Political Satire" and "Roast Hour".
   - Whoever tunes in hears whatever slot is "on air" right now by the
     clock — like a real station, not a per-user playlist that restarts.
   - Which lines play in a given slot are picked by a seeded shuffle of
     (today's date + slot number), so the line-up quietly changes every
     day without needing a server, but everyone on the same day/slot
     hears the same show.
   - Pure audio experience: no on-screen transcript, just a minimal
     "on air" player (show name, voice, countdown, progress).
   ========================================================================= */

const FM_POLITICAL_LINES = [
  "Bhaiyon aur beheno, hamara vision clear hai: har gaadi ke liye ek gaddha, aur har gaddhe ke liye ek naya committee.",
  "Main vaada karta hoon, agar main jeeta, toh Monday ko bhi Sunday jaisa banayenge — sirf naam badlega.",
  "Hamari party ka manifesto sirf ek panne ka hai, kyunki hum promises kam, PDF zyada believe karte hain.",
  "Is baar humne decide kiya hai ki bijli bill nahi, sirf bijli jaayegi — thoda equality toh honi chahiye.",
  "Vote hamein dijiye, hum guarantee dete hain ki agla election bhi hum hi ladenge.",
  "Sadkon ka naam badalna hamari sabse badi achievement hai — GPS ko bhi confuse kar diya.",
  "Humne survey karaya, log bole paani chahiye, humne bola achha, hum toh sirf neta hain, engineer nahi.",
  "Is baar ka slogan hai: 'Pehle vikas, phir vikas ka udghatan, phir agla election'.",
  "Sansad mein is hafte teen ghante bahas hui ki lunch break kitne baje ho.",
  "Humara promise hai ki har gaon mein WiFi hoga, chahe bijli ho ya na ho.",
  "Neta ji ne kaha, 'Main aapke beech ka hoon' — phir five-star hotel mein press conference kiya.",
  "Is baar humne naya scheme launch kiya hai: purani scheme ko naya naam de diya hai.",
  "Opposition kehta hai kuch nahi hua, sarkar kehti hai sab kuch ho gaya — dono sahi hain, apni-apni file mein.",
  "Chunav aate hi sadkein theek hone lagti hain, jaise gaddhon ko bhi vote ka dar ho.",
  "Humne ek naya ministry banaya hai — Ministry of Announcing New Ministries.",
  "Neta ji ka bhashan do ghante chala, usmein se dedh ghanta unhone khud ki tareef ki.",
  "Is saal ka budget itna balanced hai ki kisi ko kuch samajh nahi aaya, sabko khush hona pada.",
  "Humari sarkar transparency mein believe karti hai — isliye sab kuch closed-door meeting mein decide hota hai.",
  "Vikas itni tez raftar se ho raha hai ki abhi tak kisi ko dikha nahi.",
  "Naya highway banaya gaya hai, sirf inauguration ke liye — traffic abhi bhi purane raste se hi jaata hai.",
  "Election se pehle neta ji gaon mein aaye, chai pee, selfie li, aur agle paanch saal ke liye gayab ho gaye.",
  "Humne ek app banaya hai sarkari kaam ke liye — usmein sabse fast feature 'loading' hai.",
  "Is baar manifesto mein likha hai: 'Berozgari khatam karenge' — job ka title tha 'Manifesto Writer'.",
  "Neta ji ne kaha, 'Hum janta ki awaaz hain' — phir apna mic mute kar liya sawalon ke waqt.",
  "Naye airport ka naam rakha gaya, ab bas runway banna baaki hai.",
  "Sarkar ne pradushan control ke liye committee banayi, committee ki pehli meeting traffic jam mein phas gayi.",
  "Is hafte parliament mein sabse zyada time 'point of order' pe discuss karne mein gaya.",
  "Neta ji ne promise kiya sabko ghar denge, unka apna ghar teen states mein hai.",
  "Naya tax lagaya gaya hai 'progress fee' ke naam se — progress abhi dhoondi ja rahi hai.",
  "Chunav ghoshna hote hi sab netaon ko achanak gaon yaad aane lagta hai.",
  "Humari sarkar ka motto hai: 'Sabka saath, sabka WhatsApp forward'.",
  "Is baar budget speech itni lambi thi ki interval mein samosa bhi thanda ho gaya.",
  "Neta ji online ho gaye hain — ab wo bhi memes bante hain aur memes bhi bhejte hain.",
  "Naye niyam ke tehat, ab file ek department se doosre tak jaane mein sirf tees din lagenge — pehle chalis lagte the.",
  "Sarkar ne kaha hum digital ho gaye — offline office abhi bhi register aur pen se chalta hai.",
  "Neta ji ke bhashan mein aaj teesri baar 'ek naya Bharat' aaya, gaadi abhi bhi purani hi hai.",
  "Is baar candidate list itni last-minute aayi ki khud candidates ko bhi surprise laga.",
  "Sansad session mein sabse zyada tāli 'break lene' ke announcement pe bajti hai.",
  "Naya slogan hai: 'Har haath ko kaam' — application form bharne ka kaam sabse zyada mila.",
  "Vikas yatra nikali gayi, gaadi me AC thi, janta dhoop mein khadi thi.",
];

const FM_ROAST_LINES = [
  "Tumhara WiFi password itna lamba hai ki type karte-karte relationship khatam ho jaati hai.",
  "Tum itni der se 'abhi nikla' bol rahe ho ki GPS bhi confuse ho gaya hoga.",
  "Tumhari college attendance itni kam hai ki professor bhi tumhe guest lecture samajhte hain.",
  "Tum itni der so ke uthte ho ki alarm bhi tumse hope chhod deta hai.",
  "Tumhara resume itna ghumaya hua hai ki 'fresher' likha hai par experience 'senior citizen' jaisa hai.",
  "Tumhari typing speed itni slow hai ki autocorrect bhi bore ho jaata hai.",
  "Tum itni baar 'kal se diet start' bolte ho ki calendar bhi thak gaya hoga.",
  "Tumhara Instagram bio itna deep hai, par status update sirf 'busy' rehta hai.",
  "Tum utna hi punctual ho jitna Indian Railways summer mein.",
  "Tumhari excuses itni creative hain ki tumhe screenwriting try karni chahiye.",
  "Tum itni der browser tab khula rakhte ho ki laptop bhi retirement maang raha hai.",
  "Tumhara group project mein contribution sirf WhatsApp group banane tak tha.",
  "Tum itna 'ek minute' bolte ho ki wo minute ab apna alag time zone maang raha hai.",
  "Tumhari handwriting itni unique hai ki khud tumhe bhi decode karne ke liye Google Lens chahiye.",
  "Tum itni der mirror ke saamne khade rehte ho ki mirror bhi ab tumse selfie maangta hai.",
  "Tumhara plan hamesha 'last moment pe dekhenge' hota hai — aur last moment kabhi khush nahi hota.",
  "Tum itna bhool jaate ho ki apna hi birthday reminder set karte ho.",
  "Tumhari savings itni hai ki bank statement mein bhi comedy section likha ho sakta hai.",
  "Tum itni baar 'gym kal se' bolte ho ki gym membership bhi expire ho chuki hai.",
  "Tumhara auto-wala bhi tumse zyada punctual hai, aur wo bhi late hota hai.",
  "Tum itni der Netflix pe 'kya dekhein' scroll karte ho ki wahi time mein movie khatam ho sakti thi.",
  "Tumhara battery percentage aur tumhara motivation ek saath low hote hain.",
  "Tum itni baar plan cancel karte ho ki dost log ab invite bhi 'maybe' bhejte hain.",
  "Tumhari Hindi-English mix itni strong hai ki Google Translate bhi haath khada kar de.",
  "Tum itna 'busy hoon' bolte ho ki busy khud confuse ho gaya hoga uska matlab kya hai.",
  "Tumhara cupboard sirf ek combination pehenne ke liye kaafi bada nahi hai, phir bhi 'kuch pehenne ko nahi hai' bolte ho.",
  "Tum itni der 'seen' pe rakhte ho ki reply karna ek achievement lagta hai.",
  "Tumhara alarm five snooze ke baad bhi tumse haar jaata hai.",
  "Tum itna 'kal se serious' bolte ho ki 'kal' ab permanent resident ban gaya hai tumhare plans mein.",
  "Tumhari chai itni strong hoti hai ki spoon khada reh jaaye.",
  "Tum itni der Maps pe 'shortcut' dhoondte ho ki normal route pe pahunch jaate.",
  "Tumhara WhatsApp status kabhi khatam nahi hota, par assignment kabhi shuru nahi hota.",
  "Tum itna 'aa raha hoon' bolte ho ki wo phrase ab ek myth ban gaya hai.",
  "Tumhari online shopping cart itni bhari hai ki wishlist bhi retirement maang rahi hai.",
  "Tum itni der reels dekhte ho ki khud ek reel ban sakte the is dauraan.",
  "Tumhara plan hamesha budget-friendly hota hai — kyunki plan kabhi execute hi nahi hota.",
  "Tum itna 'ek chai aur' bolte ho ki chai wale ne tumhara naam menu mein likh diya hai.",
  "Tumhari punctuality dekh ke sooraj bhi late uthne laga hai.",
  "Tum itni der 'sorry, network issue' bolte ho ki network bhi ab tumse sharminda hai.",
  "Tumhara motivation Monday subah se Monday dopahar tak hi zinda rehta hai.",
];

const FM_SLOTS_PER_DAY = 48;
const FM_SLOT_MINUTES = 30;
const FM_LINES_PER_SHOW = 14;

const FM_POLITICAL_TITLES = [
  "Sansad Satire",
  "Neta Ki Bhashanbaazi",
  "Manifesto Masala",
  "Kursi Ki Kahani",
];
const FM_ROAST_TITLES = [
  "Roast Hour",
  "Bhasm Aarti",
  "Tapak Ke Roast",
  "Full Tandoor",
];

function fmSeededRandom(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fmShuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmDaySeed(date) {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let h = 0;
  for (let i = 0; i < key.length; i++)
    h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return h;
}
function fmSlotIndexNow(date = new Date()) {
  const mins = date.getHours() * 60 + date.getMinutes();
  return Math.floor(mins / FM_SLOT_MINUTES) % FM_SLOTS_PER_DAY;
}
function fmSlotSecondsLeft(date = new Date()) {
  const secs =
    date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const slotSecs = FM_SLOT_MINUTES * 60;
  return slotSecs - (secs % slotSecs);
}
function fmBuildShow(slotIndex, date = new Date()) {
  const isPolitical = slotIndex % 2 === 0;
  const pool = isPolitical ? FM_POLITICAL_LINES : FM_ROAST_LINES;
  const titles = isPolitical ? FM_POLITICAL_TITLES : FM_ROAST_TITLES;
  const seed = fmDaySeed(date) ^ Math.imul(slotIndex + 1, 2654435761);
  const rnd = fmSeededRandom(seed);
  const shuffled = fmShuffle(pool, rnd);
  const lines = [];
  for (let i = 0; i < FM_LINES_PER_SHOW; i++)
    lines.push(shuffled[i % shuffled.length]);
  const title = titles[Math.floor(rnd() * titles.length)];
  const genderPair = Math.floor(slotIndex / 2) % 2;
  const gender = "female";
  const voiceId = isPolitical
    ? gender === "male"
      ? "anchor_m"
      : "anchor_f"
    : gender === "male"
      ? "roast_m"
      : "roast_f";
  return {
    slotIndex,
    isPolitical,
    lines,
    voiceId,
    title,
    category: isPolitical ? "Political Satire" : "Roast Hour",
  };
}

let fmCurrentShow = null;
let fmLineIdx = 0;
let fmLoopActive = false;
let fmManualOverrideSlot = null;
let fmPlaybackToken = 0;

function fmActiveSlotIndex() {
  return fmManualOverrideSlot !== null
    ? fmManualOverrideSlot
    : fmSlotIndexNow();
}

function fmRenderUI() {
  if (!fmCurrentShow) fmCurrentShow = fmBuildShow(fmActiveSlotIndex());
  const show = fmCurrentShow;
  const titleEl = document.getElementById("fmShowTitle");
  const slotEl = document.getElementById("fmSlotLabel");
  const voiceEl = document.getElementById("fmVoiceLine");
  const fillEl = document.getElementById("fmProgressFill");
  const countdownEl = document.getElementById("fmCountdown");
  const nextUpEl = document.getElementById("fmNextUp");
  const dotEl = document.getElementById("fmDot");
  const onAirLabel = document.getElementById("fmOnAirLabel");
  const btn = document.getElementById("fmPlay");
  if (!titleEl) return;

  titleEl.textContent = show.title;
  slotEl.textContent = `Slot ${show.slotIndex + 1} / ${FM_SLOTS_PER_DAY}`;

  const voice = typeof getVoice === "function" ? getVoice(show.voiceId) : null;
  const genderLabel = show.voiceId.endsWith("_f") ? "Female" : "Male";
  voiceEl.textContent = voice
    ? `${voice.emoji} ${voice.persona} · ${genderLabel} · ${show.category}`
    : `📻 Radio Jockey · ${genderLabel} · ${show.category}`;

  const totalSecs = FM_SLOT_MINUTES * 60;
  const secondsLeft =
    fmManualOverrideSlot !== null ? totalSecs : fmSlotSecondsLeft();
  const pct = Math.max(
    0,
    Math.min(100, ((totalSecs - secondsLeft) / totalSecs) * 100),
  );
  fillEl.style.width = pct + "%";
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  countdownEl.textContent = `${mm}:${ss} left`;

  const nextSlot = (show.slotIndex + 1) % FM_SLOTS_PER_DAY;
  const nextShow = fmBuildShow(nextSlot);
  nextUpEl.textContent = `Up next: ${nextShow.title} · ${nextShow.category}`;

  const isLive = typeof currentId !== "undefined" && currentId === "fm";
  dotEl.classList.toggle("live", isLive);
  onAirLabel.textContent = isLive ? "ON AIR" : "OFF AIR";
  btn.textContent = isLive ? "■ Stop" : "▶ Tune In";
  btn.classList.toggle("btn-green", isLive);
  btn.classList.toggle("btn-primary", !isLive);
}

function fmSpeakLine() {
  if (!fmLoopActive) return;
  const playbackToken = fmPlaybackToken;
  if (fmManualOverrideSlot === null) {
    const liveSlot = fmSlotIndexNow();
    if (!fmCurrentShow || fmCurrentShow.slotIndex !== liveSlot) {
      fmCurrentShow = fmBuildShow(liveSlot);
      fmLineIdx = 0;
    }
  }
  if (!fmCurrentShow) fmCurrentShow = fmBuildShow(fmActiveSlotIndex());
  const line = fmCurrentShow.lines[fmLineIdx % fmCurrentShow.lines.length];
  fmLineIdx++;
  // Ignore callbacks from cancelled/older utterances so FM lines never overlap.
  speak("fm", line, fmCurrentShow.voiceId, 0.96, () => {
    if (fmLoopActive && playbackToken === fmPlaybackToken) fmSpeakLine();
  });
  fmRenderUI();
}

function fmTuneIn() {
  fmPlaybackToken++;
  fmManualOverrideSlot = null;
  fmCurrentShow = fmBuildShow(fmActiveSlotIndex());
  fmLineIdx = 0;
  fmLoopActive = true;
  fmSpeakLine();
}
function fmStop() {
  fmPlaybackToken++;
  fmLoopActive = false;
  if (typeof stopSpeak === "function") stopSpeak();
  fmRenderUI();
}

document.addEventListener("DOMContentLoaded", () => {
  const playBtn = document.getElementById("fmPlay");
  const nextBtn = document.getElementById("fmNextShow");
  if (!playBtn) return;

  playBtn.onclick = () => {
    if (typeof currentId !== "undefined" && currentId === "fm") fmStop();
    else fmTuneIn();
  };
  nextBtn.onclick = () => {
    fmPlaybackToken++;
    const base = fmCurrentShow ? fmCurrentShow.slotIndex : fmActiveSlotIndex();
    fmManualOverrideSlot = (base + 1) % FM_SLOTS_PER_DAY;
    fmCurrentShow = fmBuildShow(fmManualOverrideSlot);
    fmLineIdx = 0;
    if (fmLoopActive) fmSpeakLine();
    fmRenderUI();
  };

  window.onFmSpeechChange = fmRenderUI;
  fmRenderUI();
  setInterval(fmRenderUI, 1000);
});
