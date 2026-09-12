const SOCKET_SERVER_URL =
  window.MEME_CHAT_SERVER_URL ||
  (location.protocol === "file:" ? "http://localhost:3000" : location.origin);
const DEBATE_TOPICS = {
  politics: "Politics",
  cricket: "Cricket",
  "movies-series": "Movies / Series",
  behavior: "Human Behavior",
  "technology-ai": "Technology / AI",
  "village-city-life": "Village / City Life",
};
const CALL_ICON_DELAY_MS = 60 * 1000;
const state = {
  mode: "chat",
  socket: null,
  paired: false,
  inviteId: null,
  partnerName: "",
  connected: false,
  searching: false,
  channelId: null,
  channelName: "",
  callIconTimer: null,
  pc: null,
  localStream: null,
  inCall: false,
  callAwaiting: false,
  callTimerInterval: null,
  callStartedAt: null,
  muted: false,
  // Signaling messages (offer/candidates) that arrive from the partner
  // before our own RTCPeerConnection has finished being created (e.g. the
  // callee is still waiting on the mic-permission prompt). These get
  // queued and replayed once state.pc exists, instead of being dropped.
  pendingSignals: null,
};
const statusEl = document.getElementById("addaStatus");
const messagesEl = document.getElementById("addaMessages");
const messageInput = document.getElementById("messageInput");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const debatePanel = document.getElementById("debatePanel");
const channelPanel = document.getElementById("channelPanel");
const debateTopic = document.getElementById("debateTopic");
const customTopic = document.getElementById("customTopic");
const modeHint = document.getElementById("modeHint");
const leaveBtn = document.getElementById("leaveBtn");
const reportPartnerBtn = document.getElementById("reportPartnerBtn");
const blockPartnerBtn = document.getElementById("blockPartnerBtn");
const addaReportBackdrop = document.getElementById("addaReportBackdrop");
const addaReportForm = document.getElementById("addaReportForm");
const addaReportStatus = document.getElementById("addaReportStatus");
const addaReportReasonSelect = document.getElementById("addaReportReason");
const addaReportOtherWrap = document.getElementById("addaReportOtherWrap");
const addaReportOtherText = document.getElementById("addaReportOtherText");
const addaBlockBackdrop = document.getElementById("addaBlockBackdrop");
const acceptBtn = document.getElementById("acceptInviteBtn");
const rejectBtn = document.getElementById("rejectInviteBtn");
const inviteHint = document.getElementById("inviteHint");
const notifyBtn = document.getElementById("notifyBtn");
const callIconBtn = document.getElementById("callIconBtn");
const incomingCallBox = document.getElementById("incomingCallBox");
const callerNameEl = document.getElementById("callerName");
const callAcceptBtn = document.getElementById("callAcceptBtn");
const callRejectBtn = document.getElementById("callRejectBtn");
const outgoingCallBox = document.getElementById("outgoingCallBox");
const callCancelBtn = document.getElementById("callCancelBtn");
const inCallBar = document.getElementById("inCallBar");
const callTimerEl = document.getElementById("callTimer");
const muteBtn = document.getElementById("muteBtn");
const endCallBtn = document.getElementById("endCallBtn");
const remoteAudio = document.getElementById("remoteAudio");
function setStatus(text, strong = false) {
  statusEl.textContent = text;
  if (strong) statusEl.innerHTML = `🟢 <strong>${text}</strong>`;
}
function appendMessage(who, text) {
  const row = document.createElement("div");
  row.className = `adda-msg ${who}`;
  row.textContent = text;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function appendSystem(text) {
  appendMessage("system", text);
}
function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted")
    new Notification(title, { body });
}
async function enableNotifications(showMessage = true) {
  if (!("Notification" in window)) {
    if (showMessage)
      appendSystem("Is browser mein notifications supported nahi hain.");
    return;
  }
  try {
    const result = await Notification.requestPermission();
    if (showMessage)
      appendSystem(
        result === "granted"
          ? "🔔 Browser notifications enabled."
          : "🔕 Permission nahi mili; in-page invite alert available rahega.",
      );
    if (result === "granted")
      notifyBtn.textContent = "🔔 Notifications Enabled";
  } catch {
    if (showMessage)
      appendSystem("Notification permission browser ne block kar di.");
  }
}
function clearInvite() {
  state.inviteId = null;
  acceptBtn.classList.add("adda-hidden");
  rejectBtn.classList.add("adda-hidden");
}
function updateControls() {
  leaveBtn.classList.toggle("adda-hidden", !state.connected);
  reportPartnerBtn.classList.toggle("adda-hidden", !state.paired);
  blockPartnerBtn.classList.toggle("adda-hidden", !state.paired);
}

// ---------- Call icon (appears 60s into a healthy random chat) ----------
function clearCallIconTimer() {
  if (state.callIconTimer) {
    clearTimeout(state.callIconTimer);
    state.callIconTimer = null;
  }
}
function armCallIconTimer() {
  clearCallIconTimer();
  state.callIconTimer = setTimeout(() => {
    if (
      state.mode === "chat" &&
      state.paired &&
      !state.inCall &&
      !state.callAwaiting
    )
      callIconBtn.classList.remove("adda-hidden");
  }, CALL_ICON_DELAY_MS);
}
function hideCallEntryPoints() {
  callIconBtn.classList.add("adda-hidden");
  incomingCallBox.classList.add("adda-hidden");
  outgoingCallBox.classList.add("adda-hidden");
}
function resetCallUi() {
  clearCallIconTimer();
  hideCallEntryPoints();
  inCallBar.classList.add("adda-hidden");
}

// ---------- WebRTC voice call ----------
async function fetchIceServers() {
  // Public STUN alone frequently fails to establish real audio between two
  // strangers on different networks (mobile data / CGNAT / symmetric NAT) —
  // it can look "connected" while no audio ever flows. These free public
  // TURN relays (Open Relay Project / Metered.ca demo credentials) are used
  // as a safety net whenever the server hasn't been given its own TURN
  // account (METERED_DOMAIN / METERED_SECRET_KEY env vars). For reliable,
  // higher-capacity calling in production, set those env vars on the
  // server with your own TURN provider — this fallback is best-effort.
  const fallback = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:global.relay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];
  try {
    const response = await fetch(
      `${SOCKET_SERVER_URL}/api/public/turn-credentials`,
    );
    if (!response.ok) throw new Error("turn-credentials unavailable");
    const data = await response.json();
    return Array.isArray(data.iceServers) && data.iceServers.length
      ? data.iceServers
      : fallback;
  } catch {
    return fallback;
  }
}
function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}
function startCallTimerUi() {
  state.callStartedAt = Date.now();
  callTimerEl.textContent = "00:00";
  state.callTimerInterval = setInterval(() => {
    callTimerEl.textContent = formatDuration(Date.now() - state.callStartedAt);
  }, 1000);
}
function stopCallTimerUi() {
  if (state.callTimerInterval) {
    clearInterval(state.callTimerInterval);
    state.callTimerInterval = null;
  }
  state.callStartedAt = null;
}
function requestCall() {
  if (!state.paired || !state.socket?.connected) return;
  state.callAwaiting = true;
  callIconBtn.classList.add("adda-hidden");
  outgoingCallBox.classList.remove("adda-hidden");
  state.socket.emit("adda:call-request");
}
function cancelOutgoingCall() {
  if (state.socket?.connected) state.socket.emit("adda:call-reject");
  state.callAwaiting = false;
  outgoingCallBox.classList.add("adda-hidden");
  if (state.mode === "chat" && state.paired && !state.inCall)
    callIconBtn.classList.remove("adda-hidden");
}
function acceptIncomingCall() {
  if (!state.socket?.connected) return;
  incomingCallBox.classList.add("adda-hidden");
  state.socket.emit("adda:call-accept");
}
function rejectIncomingCall() {
  if (state.socket?.connected) state.socket.emit("adda:call-reject");
  incomingCallBox.classList.add("adda-hidden");
  if (state.mode === "chat" && state.paired && !state.inCall)
    callIconBtn.classList.remove("adda-hidden");
}
async function startCall(initiator) {
  hideCallEntryPoints();
  state.callAwaiting = false;
  // Start queuing any offer/candidate messages that arrive from the
  // partner while we're still waiting on getUserMedia() / building the
  // peer connection below, so nothing gets silently dropped.
  state.pendingSignals = [];
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
  } catch {
    appendSystem("🎙️ Mic permission nahi mili, call start nahi ho saki.");
    state.pendingSignals = null;
    if (state.socket?.connected) state.socket.emit("adda:call-end");
    return;
  }
  const iceServers = await fetchIceServers();
  state.pc = new RTCPeerConnection({ iceServers });
  state.localStream
    .getTracks()
    .forEach((track) => state.pc.addTrack(track, state.localStream));
  state.pc.onicecandidate = (event) => {
    if (event.candidate && state.socket?.connected)
      state.socket.emit("adda:call-signal", {
        type: "candidate",
        candidate: event.candidate,
      });
  };
  state.pc.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
    // Some browsers (notably Safari/iOS) won't honor the `autoplay`
    // attribute for a srcObject assigned outside a direct user-gesture
    // call stack. Explicitly kick playback so voice is actually audible.
    remoteAudio.play().catch(() => {
      appendSystem(
        "🔊 Audio play block ho gaya — screen par kahin bhi tap karo.",
      );
    });
  };
  state.pc.onconnectionstatechange = () => {
    if (state.pc?.connectionState === "connected" && !state.inCall) {
      state.inCall = true;
      inCallBar.classList.remove("adda-hidden");
      startCallTimerUi();
      appendSystem("📞 Call connected.");
    }
    if (
      ["failed", "disconnected", "closed"].includes(state.pc?.connectionState)
    )
      endCall(false);
  };
  // Replay any offer/candidate messages that arrived while we were still
  // waiting on the mic prompt / RTCPeerConnection setup above.
  const queued = state.pendingSignals || [];
  state.pendingSignals = null;
  for (const payload of queued) {
    await handleCallSignal(payload);
  }
  if (initiator) {
    const offer = await state.pc.createOffer();
    await state.pc.setLocalDescription(offer);
    state.socket.emit("adda:call-signal", { type: "offer", sdp: offer });
  }
}
async function handleCallSignal(payload) {
  if (!payload) return;
  if (!state.pc) {
    // Peer connection isn't ready yet (still awaiting mic permission) —
    // queue this instead of dropping it, so the call can still connect
    // once startCall() finishes setting up.
    if (Array.isArray(state.pendingSignals)) state.pendingSignals.push(payload);
    return;
  }
  if (payload.type === "offer") {
    await state.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    const answer = await state.pc.createAnswer();
    await state.pc.setLocalDescription(answer);
    state.socket.emit("adda:call-signal", { type: "answer", sdp: answer });
  } else if (payload.type === "answer") {
    await state.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
  } else if (payload.type === "candidate" && payload.candidate) {
    try {
      await state.pc.addIceCandidate(payload.candidate);
    } catch {
      /* ignore late candidates */
    }
  }
}
function endCall(notifyServer = true) {
  if (
    notifyServer &&
    state.socket?.connected &&
    (state.inCall || state.callAwaiting)
  )
    state.socket.emit("adda:call-end");
  if (state.pc) {
    state.pc.close();
    state.pc = null;
  }
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
    state.localStream = null;
  }
  remoteAudio.srcObject = null;
  state.pendingSignals = null;
  stopCallTimerUi();
  inCallBar.classList.add("adda-hidden");
  outgoingCallBox.classList.add("adda-hidden");
  incomingCallBox.classList.add("adda-hidden");
  const wasInCall = state.inCall;
  state.inCall = false;
  state.callAwaiting = false;
  state.muted = false;
  muteBtn.textContent = "🎙️ Mute";
  if (wasInCall) appendSystem("📴 Call end ho gayi.");
  if (state.mode === "chat" && state.paired)
    callIconBtn.classList.remove("adda-hidden");
}
function toggleMute() {
  if (!state.localStream) return;
  state.muted = !state.muted;
  state.localStream.getAudioTracks().forEach((track) => {
    track.enabled = !state.muted;
  });
  muteBtn.textContent = state.muted ? "🔇 Unmute" : "🎙️ Mute";
}
function currentTopic() {
  if (debateTopic.value === "custom")
    return customTopic.value.trim().slice(0, 160);
  return DEBATE_TOPICS[debateTopic.value] || DEBATE_TOPICS.politics;
}
function contextFor(mode = state.mode) {
  return mode === "debate" ? { mode, topic: currentTopic() } : { mode: "chat" };
}
function showMode(mode) {
  state.mode = mode;
  modeButtons.forEach((button) =>
    button.classList.toggle("active", button.dataset.mode === mode),
  );
  debatePanel.classList.toggle("adda-hidden", mode !== "debate");
  channelPanel.classList.toggle("adda-hidden", mode !== "channel");
  if (mode === "chat")
    modeHint.textContent =
      "Random chat page open hote hi automatically start hoti hai.";
  if (mode === "debate") {
    modeHint.textContent =
      "Topic choose karo; phir debate partner search hoga.";
    inviteHint.textContent =
      "Fixed topic select karke debate partner dhoondho.";
  }
  if (mode === "channel") {
    modeHint.textContent = "Public Meme Channel create ya join karo.";
    inviteHint.textContent =
      "Channel mode mein group members ke saath chat hogi.";
    if (state.socket?.connected) loadChannels();
  }
  if (mode !== "chat") {
    resetCallUi();
    endCall(true);
  }
}
function connectSocket() {
  if (state.socket?.connected) return state.socket;
  if (typeof io === "undefined") {
    setStatus("Socket.IO load nahi hua. Chat server check karo.");
    return null;
  }
  state.socket = io(SOCKET_SERVER_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 8,
    timeout: 8000,
  });
  state.socket.on("connect", () => {
    state.connected = true;
    updateControls();
    setStatus("Online server connected", true);
    if (state.mode === "chat") findChat();
    if (state.mode === "debate" && state.searching) findDebate();
    if (state.mode === "channel") loadChannels();
  });
  state.socket.on("connect_error", (error) => {
    state.connected = false;
    setStatus(
      `Online server se connect nahi ho pa raha: ${error?.message || "server unavailable"}`,
    );
  });
  state.socket.io.on("reconnect_attempt", (attempt) =>
    setStatus(`Server reconnect attempt ${attempt}/8…`),
  );
  state.socket.io.on("reconnect", () => {
    state.connected = true;
    updateControls();
    if (state.mode === "chat") findChat();
    if (state.mode === "debate" && state.searching) findDebate();
  });
  state.socket.on("adda:waiting", () => {
    state.searching = true;
    setStatus("Doosre meme citizen ko search kiya ja raha hai…");
    notify(
      "Meme Adda",
      "Aap matching queue mein ho. Partner milte hi invite aayega.",
    );
  });
  state.socket.on("adda:invite", (invite) => {
    state.searching = false;
    state.inviteId = invite.inviteId;
    state.partnerName = invite.partnerName || "Meme Citizen";
    acceptBtn.classList.remove("adda-hidden");
    rejectBtn.classList.remove("adda-hidden");
    const label =
      invite.mode === "debate"
        ? `debate: ${invite.topic || "chosen topic"}`
        : "chat";
    inviteHint.textContent = `${state.partnerName} ne ${label} invite bheja hai.`;
    setStatus(`${state.partnerName} ka invite pending hai.`);
    notify(
      "Meme Adda Invite",
      `${state.partnerName} aapse ${label} ke liye connect hona chahte hain.`,
    );
  });
  state.socket.on("adda:invite-rejected", () => {
    clearInvite();
    setStatus("Invite reject ho gaya. Naya partner dhoondho.");
  });
  state.socket.on("adda:paired", (data) => {
    state.paired = true;
    state.searching = false;
    clearInvite();
    state.partnerName = data.partnerName || "Meme Citizen";
    setStatus(`${state.partnerName} ke saath connected`, true);
    appendSystem(
      `✅ Connected with ${state.partnerName}. ${data.mode === "debate" ? `Debate: ${data.topic || "custom topic"}` : "Thought share karo!"}`,
    );
    updateControls();
    notify(
      "Meme Adda Connected",
      `${state.partnerName} ke saath aap connect ho gaye.`,
    );
    resetCallUi();
    if (data.mode === "chat") armCallIconTimer();
  });
  state.socket.on("adda:message", (payload) =>
    appendMessage("them", payload.text || ""),
  );
  state.socket.on("adda:partner-left", () => {
    state.paired = false;
    appendSystem("Partner chat se chala gaya. Find Another Person dabao.");
    setStatus("Partner disconnected");
    updateControls();
    resetCallUi();
    endCall(false);
  });
  state.socket.on("adda:report-ack", (data) => {
    document.getElementById("addaReportSubmitBtn").disabled = false;
    addaReportStatus.textContent = data?.message || "";
    if (data?.ok) {
      setTimeout(() => {
        addaReportBackdrop.hidden = true;
      }, 1200);
    }
  });
  state.socket.on("adda:block-ack", (data) => {
    if (data?.message) appendSystem(data.ok ? `🚫 ${data.message}` : data.message);
    if (data?.ok) leave();
  });
  state.socket.on("moderation:warning", (data) => {
    if (data?.message) appendSystem(data.message);
  });
  state.socket.on("adda:call-request", (payload) => {
    callerNameEl.textContent =
      payload?.fromName || state.partnerName || "Partner";
    callIconBtn.classList.add("adda-hidden");
    incomingCallBox.classList.remove("adda-hidden");
    notify(
      "Meme Adda Call",
      `${callerNameEl.textContent} aapko call kar raha hai.`,
    );
  });
  state.socket.on("adda:call-rejected", () => {
    const wasAwaiting = state.callAwaiting;
    state.callAwaiting = false;
    outgoingCallBox.classList.add("adda-hidden");
    incomingCallBox.classList.add("adda-hidden");
    if (wasAwaiting) appendSystem("📴 Partner ne call decline kar di.");
    if (state.mode === "chat" && state.paired && !state.inCall)
      callIconBtn.classList.remove("adda-hidden");
  });
  state.socket.on("adda:call-start", ({ initiator }) => startCall(initiator));
  state.socket.on("adda:call-signal", handleCallSignal);
  state.socket.on("adda:call-end", () => endCall(false));
  state.socket.on("channel:list", renderChannels);
  state.socket.on("channel:created", (channel) => {
    appendSystem(`📡 Channel created: ${channel.name}`);
    loadChannels();
    joinChannel(channel.id);
  });
  state.socket.on("channel:joined", (channel) => {
    state.channelId = channel.id;
    state.channelName = channel.name;
    document.getElementById("currentChannel").classList.remove("adda-hidden");
    document.getElementById("currentChannelName").textContent =
      `# ${channel.name}`;
    appendSystem(
      `📡 Aap #${channel.name} channel mein join ho gaye. Members: ${channel.members}`,
    );
    setStatus(`#${channel.name} group connected`, true);
  });
  state.socket.on("channel:left", () => {
    state.channelId = null;
    state.channelName = "";
    document.getElementById("currentChannel").classList.add("adda-hidden");
    appendSystem("Aap channel se leave ho gaye.");
  });
  state.socket.on("channel:members", (data) => {
    if (state.channelId === data.id)
      appendSystem(`👥 #${data.name}: ${data.members} members online`);
  });
  state.socket.on("channel:message", (payload) =>
    appendMessage(
      "them",
      `${payload.fromName || "Channel member"}: ${payload.text || ""}`,
    ),
  );
  return state.socket;
}
function findChat() {
  const socket = connectSocket();
  if (!socket) return;
  state.mode = "chat";
  state.searching = true;
  state.paired = false;
  socket.emit("adda:find", { mode: "chat" });
}
function findDebate() {
  const socket = connectSocket();
  if (!socket) return;
  const topic = currentTopic();
  if (!topic) return appendSystem("Custom debate topic likhna zaroori hai.");
  state.searching = true;
  state.paired = false;
  socket.emit("adda:find", { mode: "debate", topic });
  setStatus(`“${topic}” debate partner search ho raha hai…`);
}
function sendText() {
  const text = messageInput.value.trim();
  if (!text || !state.socket?.connected) return;
  if (state.mode === "channel" && state.channelId)
    state.socket.emit("channel:message", { id: state.channelId, text });
  else if (state.paired)
    state.socket.emit("adda:message", { kind: "text", text });
  else
    return appendSystem("Pehle kisi user ya Meme Channel se connect ho jao.");
  appendMessage("me", text);
  messageInput.value = "";
}
function acceptInvite() {
  if (!state.inviteId || !state.socket) return;
  state.socket.emit("adda:accept", { inviteId: state.inviteId });
  appendSystem("Invite accept kiya. Connection establish ho raha hai…");
  acceptBtn.classList.add("adda-hidden");
}
function rejectInvite() {
  if (!state.inviteId || !state.socket) return;
  state.socket.emit("adda:reject", { inviteId: state.inviteId });
  clearInvite();
  setStatus("Invite reject kar diya.");
}
function leave() {
  endCall(false);
  resetCallUi();
  if (state.socket) {
    state.socket.emit("adda:leave");
    state.socket.disconnect();
  }
  state.socket = null;
  state.connected = false;
  state.paired = false;
  state.searching = false;
  state.channelId = null;
  clearInvite();
  setStatus("🔌 Not connected");
  updateControls();
}
function loadChannels() {
  if (state.socket?.connected) state.socket.emit("channel:list");
}
function renderChannels(channels = []) {
  const list = document.getElementById("channelList");
  list.innerHTML = channels.length
    ? channels
        .map(
          (channel) =>
            `<div class="channel-row"><div><strong>#${channel.name}</strong><small>${channel.members} members online</small></div><button class="btn btn-ghost" data-join-channel="${channel.id}">Join</button></div>`,
        )
        .join("")
    : '<p class="sub">Abhi koi public channel nahi hai. Apna channel create karo.</p>';
}
function createChannel() {
  const name = document.getElementById("channelName").value.trim();
  if (!name) return appendSystem("Channel name likho.");
  connectSocket()?.emit("channel:create", { name });
  document.getElementById("channelName").value = "";
}
function joinChannel(id) {
  if (!state.socket?.connected) return;
  if (state.paired || state.searching) state.socket.emit("adda:leave");
  state.mode = "channel";
  state.paired = false;
  state.searching = false;
  state.socket.emit("channel:join", { id });
}
modeButtons.forEach(
  (button) =>
    (button.onclick = () => {
      showMode(button.dataset.mode);
      if (button.dataset.mode === "chat") findChat();
    }),
);
document.getElementById("debateTopic").onchange = () =>
  customTopic.classList.toggle("adda-hidden", debateTopic.value !== "custom");
document.getElementById("debateStartBtn").onclick = findDebate;
document.getElementById("createChannelBtn").onclick = createChannel;
document.getElementById("refreshChannelsBtn").onclick = loadChannels;
document.getElementById("channelList").onclick = (event) => {
  const button = event.target.closest("[data-join-channel]");
  if (button) joinChannel(button.dataset.joinChannel);
};
document.getElementById("leaveChannelBtn").onclick = () => {
  if (state.socket?.connected && state.channelId)
    state.socket.emit("channel:leave", { id: state.channelId });
};
notifyBtn.onclick = () => enableNotifications(true);
document.getElementById("searchAgainBtn").onclick = () => {
  showMode("chat");
  findChat();
};
leaveBtn.onclick = leave;
function openReportModal() {
  addaReportStatus.textContent = "";
  addaReportOtherText.value = "";
  addaReportOtherWrap.hidden = addaReportReasonSelect.value !== "other";
  addaReportBackdrop.hidden = false;
}
function closeReportModal() {
  addaReportBackdrop.hidden = true;
}
function openBlockModal() {
  addaBlockBackdrop.hidden = false;
}
function closeBlockModal() {
  addaBlockBackdrop.hidden = true;
}

reportPartnerBtn.onclick = () => {
  if (!state.paired) return;
  openReportModal();
};
document.getElementById("addaReportCancelBtn").onclick = closeReportModal;
document.getElementById("addaReportModalClose").onclick = closeReportModal;
addaReportReasonSelect.onchange = () => {
  addaReportOtherWrap.hidden = addaReportReasonSelect.value !== "other";
};
addaReportForm.onsubmit = (event) => {
  event.preventDefault();
  if (!state.paired || !state.socket?.connected) {
    closeReportModal();
    return;
  }
  const reason = addaReportReasonSelect.value;
  const detail = addaReportOtherText.value.trim();
  if (reason === "other" && !detail) {
    addaReportStatus.textContent = "Please bataiye ki exactly kya problem hai.";
    addaReportOtherText.focus();
    return;
  }
  state.socket.emit("adda:report", { reason, detail });
  document.getElementById("addaReportSubmitBtn").disabled = true;
};

blockPartnerBtn.onclick = () => {
  if (!state.paired || !state.socket?.connected) return;
  openBlockModal();
};
document.getElementById("addaBlockModalClose").onclick = closeBlockModal;
document.getElementById("addaBlockCancelBtn").onclick = closeBlockModal;
document.getElementById("addaBlockReportInsteadBtn").onclick = () => {
  closeBlockModal();
  if (!state.paired) return;
  openReportModal();
};
document.getElementById("addaBlockConfirmBtn").onclick = () => {
  if (!state.paired || !state.socket?.connected) {
    closeBlockModal();
    return;
  }
  state.socket.emit("adda:block");
  closeBlockModal();
};
acceptBtn.onclick = acceptInvite;
rejectBtn.onclick = rejectInvite;
document.getElementById("sendBtn").onclick = sendText;
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendText();
});
callIconBtn.onclick = requestCall;
callCancelBtn.onclick = cancelOutgoingCall;
callAcceptBtn.onclick = acceptIncomingCall;
callRejectBtn.onclick = rejectIncomingCall;
muteBtn.onclick = toggleMute;
endCallBtn.onclick = () => endCall(true);
window.addEventListener("beforeunload", () => {
  endCall(false);
  state.socket?.disconnect();
});
showMode("chat");
connectSocket();
setTimeout(() => {
  if ("Notification" in window && Notification.permission === "default")
    enableNotifications(false);
}, 500);
