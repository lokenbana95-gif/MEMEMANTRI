MemeMantri browser-only voice setup

AI-persona narration
The final build does not need an API key or a TTS provider. It uses the browser's Web Speech API and presents tuned AI-like personas such as News Anchor, Radio Jockey, Bollywood Narrator, Cricket Commentator, Stand-up Comic, Roast Master, Desi Uncle, Desi Aunty, Dada, and Dadi.
Each persona has its own language preference, gender-oriented voice matching, pitch, rate, punctuation cleanup, sentence splitting, and pause timing. The app detects installed voices, scores them for Hindi/Indian language and gender clues, and avoids reusing the same installed voice during persona assignment when alternatives exist.
The actual vocal timbre still depends on the voices installed in the operating system and exposed by the browser. If only one system voice is available, all personas will necessarily share that underlying timbre, but their delivery, pitch, rate, wording cleanup, and pauses will differ. To get more genuine timbre differences without an API, install multiple Hindi/Indian or male/female voice packs in the device speech settings and reload the page.

Online Meme Adda
True random chat between different users cannot be delivered by static files alone. The included server.js serves the static files and pairs waiting Socket.IO clients in memory. It does not handle TTS, require an API key, or store chat history.
From this directory, run:

```bash
npm install
npm start
```

Then open http://localhost:3000/. For two people to use the same random chat online, deploy this directory to any Node-compatible HTTPS host and set ALLOWED_ORIGIN if you want to restrict which website can connect:

```bash
ALLOWED_ORIGIN="https://your-website.example" npm start
```

If the website and chat server use different domains, set this line before mm.js in index.html:

```html
<script>window.MEME_CHAT_SERVER_URL = "https://your-chat-domain.example";</script>
```

Use HTTPS in production because browsers can block mixed-content realtime requests when the website is HTTPS but the chat server is HTTP.

Automatic chat and debate
The standalone adda.html page automatically starts Find Someone To Chat as soon as the page connects. The visible Notifications On button requests browser notification permission, and the page also attempts to request permission after loading when the browser allows it. If the browser requires a user gesture, click the button. Debate mode uses Politics, Cricket, Movies / Series, Human Behavior, Technology / AI, Village / City Life, and Custom topic. The previous meme-selection controls are not part of the new debate flow.

Meme Channels
Meme Channels are public in-memory group rooms served by server.js. A user can create a channel, see the public list, join a channel, exchange group messages, see online member counts, and leave. Channel names and messages are validated and length-limited by the server. Channels and membership are cleared if the Node process restarts; add durable channel storage and authentication before treating channels as permanent communities.

Global Memes page
global.html is a separate page for country-wise, continent-wise, universal, and extra regional memes. Its search, filters, likes, plays, and browser persona narration run independently from the main page.

Voice Mantri 24-hour contest
The main page includes the Kaun Banega VoiceMantri? contest. Each open contest lasts 24 hours and accepts exactly two submissions from two different users. Every submitter can submit only one meme and cannot vote for their own meme. Topics are completely free-form; the site does not suggest or force a topic. Other users can vote after both entries are present, with one vote per browser voter token. At settlement, the submission with the highest vote count wins and the winning user is shown on the main page as Today’s VoiceMantri. When a newer contest settles, older winners remain available under the collapsible Retired VoiceMantri history option with their handle, meme title, vote count, and settlement date. A tie is resolved by the earlier submission.

Contest data is stored in SQLite at data/voice-mantri.db by default, or at the path supplied through BATTLE_DB_PATH. The voice_contests table preserves every settled winner for Retired VoiceMantri history. Keep this directory on persistent storage in production. The Node server must stay online for Socket.IO updates and the 30-second expiry check; the client also settles an expired contest when it requests fresh state.

If the HTML files are hosted on Netlify but the Node server is hosted separately, add the actual HTTPS server URL before mm.js in index.html:

```html
<script>window.MEME_CHAT_SERVER_URL = "https://your-node-server.example";</script>
```

Never upload the SQLite database or private service secrets to a public static host. Netlify serves the frontend files, while the persistent Node server handles VoiceMantri state, votes, settlement, Meme Adda realtime events, and Meme Channels.

Admin Panel
The first Admin Panel is available at the hidden route configured by `ADMIN_ROUTE` when server.js is running. The default preview route is `/meme-mantri-control-7f2a/`; change it to a private random path in production. The old `/admin`, `/admin.html`, and `/admin.js` paths return 404. This hidden route is only an extra privacy layer: server-side credentials and the protected API are still the real security boundary. The panel uses an HttpOnly session cookie, login attempts are rate-limited, and the password is never placed in admin.html or admin.js. Configure the Render service with environment variables before starting the server:

```bash
ADMIN_USERNAME="your-admin-name"
ADMIN_PASSWORD="use-a-long-random-password"
BATTLE_DB_PATH="/var/data/voice-mantri.db"
```

Open the admin panel on the Node server domain, for example `https://your-node-server.example/your-private-admin-route/`. The protected dashboard currently shows server health, current VoiceMantri submissions and votes, Today’s/Retired VoiceMantri history, and live Meme Channels. It can explicitly settle the current contest, open a new contest after settlement, and remove a live channel. Public meme catalog editing, user accounts, and report moderation will be added in a later admin upgrade. Keep the admin panel on HTTPS and do not commit the real password to Git or upload it to Netlify.

Meme Sabha engagement layer
The homepage now includes a lightweight anonymous citizen profile. A browser-generated token keeps the profile stable on that device; the citizen can choose a nickname and avatar without creating an account. SQLite persists the profile, daily streak, points, badges, followed ministries, meme likes, comments, and referral visits.

The public engagement API is available at `/api/public/community`, `/api/public/profile`, `/api/public/profile/follows`, `/api/public/memes/:id/like`, `/api/public/memes/:id/comments`, and `/api/public/referral/visit`. The browser sends the profile token in the `X-MemeMantri-Token` header. Points are awarded for filing a meme petition, liking, commenting, submitting a VoiceMantri entry, and voting. The leaderboard and trending panel update from SQLite data.

The Meme Factory has two browser-only image workflows: generated text can be exported as a PNG, and a local image can be uploaded, captioned on a canvas, and downloaded as a branded MemeMantri image meme. The uploaded image is not sent to the server.

The app also exposes `/sitemap.xml`, `/robots.txt`, and dynamic `/m/:id` metadata for shareable meme pages. Trending notifications are opt-in browser notifications while the page is open; the existing Meme Adda page continues to handle live chat notifications. Full background Web Push, WhatsApp/Telegram bots, automated social posting, and persistent video/GIF hosting still require a provider, credentials, and a separate media-storage/worker layer.

For deployment, run `npm install` and `npm start` with `PORT` and `BATTLE_DB_PATH` configured as needed. The SQLite database is created at runtime and should be kept on persistent storage in production. Do not commit or ship the local `data/` directory from a development machine.
