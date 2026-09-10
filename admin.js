const ADMIN_ROUTE = window.ADMIN_ROUTE || location.pathname.replace(/\/+$/, "");
const $ = (id) => document.getElementById(id);
const loginView = $("loginView");
const dashboardView = $("dashboardView");
const loginForm = $("loginForm");
const loginMsg = $("loginMsg");
const logoutBtn = $("logoutBtn");
const whoami = $("whoami");
let currentUser = null;
let editingMemeId = null;

function setNotice(element, message, kind = "") {
  element.textContent = message;
  element.className = `notice ${kind}`.trim();
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function fmtDate(ms) {
  return ms ? new Date(ms).toLocaleString("en-IN") : "—";
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {}
  if (!response.ok)
    throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}
const A = (path) => `${ADMIN_ROUTE}${path}`;

/* ---------------- auth / shell ---------------- */
function showDashboard(user) {
  currentUser = user;
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  whoami.classList.remove("hidden");
  whoami.textContent = `${user.username} · ${user.role}`;
  $("welcomeText").textContent =
    `Logged in as ${user.username}. Role: ${user.role}.`;
  $("adminAddForm").classList.toggle("hidden", user.role !== "super");
  $("usersSub").textContent =
    user.role === "super"
      ? "Naye admin/moderator accounts banao."
      : "Sirf super-admin naye admin bana sakta hai. Aap list dekh sakte ho.";
  loadEverything();
}
function showLogin() {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  whoami.classList.add("hidden");
}
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.onclick = () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.toggle("active", b === btn));
    document
      .querySelectorAll(".tabpanel")
      .forEach((p) =>
        p.classList.toggle("active", p.id === `tab-${btn.dataset.tab}`),
      );
  };
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setNotice(loginMsg, "Checking credentials…");
  try {
    const data = await api(A("/api/login"), {
      method: "POST",
      body: JSON.stringify({
        username: $("username").value.trim(),
        password: $("password").value,
      }),
    });
    loginForm.reset();
    showDashboard(data.user);
  } catch (error) {
    setNotice(loginMsg, error.message, "error");
  }
});
logoutBtn.onclick = async () => {
  try {
    await api(A("/api/logout"), { method: "POST" });
  } finally {
    showLogin();
  }
};
$("refreshBtn").onclick = loadEverything;

async function loadEverything() {
  try {
    await Promise.all([
      loadDashboard(),
      loadMemes(),
      loadPetitions(),
      loadMinistries(),
      loadTicker(),
      loadSettingsTab(),
      loadWords(),
      loadIpBans(),
      loadIpWarnings(),
      loadAddaReports(),
      loadAdmins(),
      loadActivity(),
    ]);
  } catch (error) {
    if (/401|403|login/i.test(error.message)) {
      showLogin();
      setNotice(
        loginMsg,
        "Session expire ho gaya. Dobara login karo.",
        "error",
      );
    }
  }
}

/* ---------------- dashboard + contest ---------------- */
async function loadDashboard() {
  const data = await api(A("/api/dashboard"));
  const contest = data.contest;
  $("serverMetric").textContent = data.health.ok ? "Online" : "Issue";
  $("memesMetric").textContent = data.memesCount;
  $("petitionsMetric").textContent = data.pendingPetitions;
  $("ministriesMetric").textContent = data.ministriesCount;
  $("channelsMetric").textContent = data.channels.length;
  $("ipbansMetric").textContent = data.ipBansCount;
  const pill = $("contestPill");
  pill.textContent = contest.status === "open" ? "Open" : "Settled";
  pill.className = `pill${contest.status === "open" ? "" : " warn"}`;
  $("contestRows").innerHTML = contest.submissions.length
    ? contest.submissions
        .map(
          (item) =>
            `<div class="row"><div class="row-top"><strong>Slot ${escapeHtml(item.slot)} · ${escapeHtml(item.author)}</strong><span>${item.votes} votes</span></div><small><b>${escapeHtml(item.title)}</b><br />${escapeHtml(item.text)}</small><div class="row-actions"><button class="danger small" data-del-sub="${item.id}">Remove</button></div></div>`,
        )
        .join("")
    : '<div class="empty">Abhi dono slots empty hain.</div>';
  $("historyRows").innerHTML = data.history.length
    ? data.history
        .map(
          (item, index) =>
            `<div class="row"><div class="row-top"><strong>#${data.history.length - index} ${escapeHtml(item.author)}</strong><span>${item.votes} votes</span></div><small>${escapeHtml(item.title)} · ${fmtDate(item.settled_at)}</small></div>`,
        )
        .join("")
    : '<div class="empty">No retired winners yet.</div>';
  $("channelRows").innerHTML = data.channels.length
    ? data.channels
        .map(
          (channel) =>
            `<div class="row"><div class="row-top"><strong>#${escapeHtml(channel.name)}</strong><button class="danger small" data-remove-channel="${escapeHtml(channel.id)}">Remove</button></div><small>${channel.members} members online</small></div>`,
        )
        .join("")
    : '<div class="empty">No live channels right now.</div>';
  $("settleBtn").disabled = contest.status !== "open";
  $("newContestBtn").disabled = contest.status === "open";
}
$("settleBtn").onclick = async () => {
  if (!confirm("Current contest settle karna hai?")) return;
  try {
    const d = await api(A("/api/contest/settle"), { method: "POST" });
    setNotice($("contestMsg"), d.message, "ok");
    loadDashboard();
  } catch (e) {
    setNotice($("contestMsg"), e.message, "error");
  }
};
$("newContestBtn").onclick = async () => {
  if (!confirm("Naya contest start karna hai?")) return;
  try {
    const d = await api(A("/api/contest/new"), { method: "POST" });
    setNotice($("contestMsg"), d.message, "ok");
    loadDashboard();
  } catch (e) {
    setNotice($("contestMsg"), e.message, "error");
  }
};
$("extendBtn").onclick = async () => {
  try {
    const d = await api(A("/api/contest/extend"), {
      method: "POST",
      body: JSON.stringify({ hours: Number($("extendHours").value) || 24 }),
    });
    setNotice($("contestMsg"), d.message, "ok");
    loadDashboard();
  } catch (e) {
    setNotice($("contestMsg"), e.message, "error");
  }
};
$("contestRows").onclick = async (e) => {
  const btn = e.target.closest("[data-del-sub]");
  if (!btn || !confirm("Ye submission delete karni hai?")) return;
  try {
    await api(A(`/api/contest/submissions/${btn.dataset.delSub}`), {
      method: "DELETE",
    });
    loadDashboard();
  } catch (err) {
    setNotice($("contestMsg"), err.message, "error");
  }
};
$("channelRows").onclick = async (e) => {
  const btn = e.target.closest("[data-remove-channel]");
  if (!btn || !confirm("Is channel ko remove karna hai?")) return;
  try {
    const d = await api(
      A(
        `/api/channels/${encodeURIComponent(btn.dataset.removeChannel)}/remove`,
      ),
      { method: "POST" },
    );
    setNotice($("contestMsg"), d.message, "ok");
    loadDashboard();
  } catch (err) {
    setNotice($("contestMsg"), err.message, "error");
  }
};

/* ---------------- memes ---------------- */
async function loadMemes() {
  const memes = await api(A("/api/memes"));
  $("memeCount").textContent = `${memes.length} memes total`;
  $("memeRows").innerHTML = memes.length
    ? memes
        .map(
          (m) => `
    <div class="row">
      <div class="row-top"><strong>${escapeHtml(m.title)}</strong><span class="pill${m.status === "published" ? "" : " off"}">${escapeHtml(m.status)}</span></div>
      <small>#${m.id} · ${escapeHtml(m.category)} · ${escapeHtml(m.creator)} ${m.featured ? "· ⭐ featured" : ""} ${m.radio_enabled ? "· 📻 on radio" : "· 📻 off"}</small>
      <small>${escapeHtml(m.text).slice(0, 140)}${m.text.length > 140 ? "…" : ""}</small>
      <div class="row-actions">
        <button class="secondary small" data-edit-meme="${m.id}">Edit</button>
        <button class="secondary small" data-toggle-status="${m.id}" data-status="${m.status}">${m.status === "published" ? "Unpublish" : "Publish"}</button>
        <button class="danger small" data-del-meme="${m.id}">Delete</button>
      </div>
    </div>`,
        )
        .join("")
    : '<div class="empty">Koi meme nahi hai.</div>';
  window.__memes = memes;
}
function resetMemeForm() {
  editingMemeId = null;
  $("memeFormTitle").textContent = "Add New Meme";
  $("memeTitle").value = "";
  $("memeCategory").value = "";
  $("memeCreator").value = "";
  $("memeText").value = "";
  $("memeFeatured").checked = false;
  $("memeRadio").checked = true;
  $("memeCancelBtn").classList.add("hidden");
}
$("memeCancelBtn").onclick = resetMemeForm;
$("memeSaveBtn").onclick = async () => {
  const payload = {
    title: $("memeTitle").value.trim(),
    category: $("memeCategory").value.trim(),
    creator: $("memeCreator").value.trim(),
    text: $("memeText").value.trim(),
    featured: $("memeFeatured").checked,
    radio_enabled: $("memeRadio").checked,
  };
  if (
    !payload.title ||
    !payload.category ||
    !payload.creator ||
    !payload.text
  ) {
    setNotice($("memeMsg"), "Sab fields required hain.", "error");
    return;
  }
  try {
    if (editingMemeId) {
      await api(A(`/api/memes/${editingMemeId}`), {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setNotice($("memeMsg"), "Meme update ho gaya.", "ok");
    } else {
      await api(A("/api/memes"), {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice($("memeMsg"), "Naya meme add ho gaya.", "ok");
    }
    resetMemeForm();
    loadMemes();
    loadDashboard();
  } catch (e) {
    setNotice($("memeMsg"), e.message, "error");
  }
};
$("memeRows").onclick = async (e) => {
  const editBtn = e.target.closest("[data-edit-meme]");
  const delBtn = e.target.closest("[data-del-meme]");
  const toggleBtn = e.target.closest("[data-toggle-status]");
  if (editBtn) {
    const m = window.__memes.find(
      (x) => String(x.id) === editBtn.dataset.editMeme,
    );
    if (!m) return;
    editingMemeId = m.id;
    $("memeFormTitle").textContent = `Editing Meme #${m.id}`;
    $("memeTitle").value = m.title;
    $("memeCategory").value = m.category;
    $("memeCreator").value = m.creator;
    $("memeText").value = m.text;
    $("memeFeatured").checked = !!m.featured;
    $("memeRadio").checked = !!m.radio_enabled;
    $("memeCancelBtn").classList.remove("hidden");
    window.scrollTo({
      top: $("memeFormTitle").offsetTop - 100,
      behavior: "smooth",
    });
  } else if (delBtn) {
    if (!confirm("Ye meme delete karna hai?")) return;
    try {
      await api(A(`/api/memes/${delBtn.dataset.delMeme}`), {
        method: "DELETE",
      });
      loadMemes();
      loadDashboard();
    } catch (err) {
      setNotice($("memeMsg"), err.message, "error");
    }
  } else if (toggleBtn) {
    const newStatus =
      toggleBtn.dataset.status === "published" ? "unpublished" : "published";
    try {
      await api(A(`/api/memes/${toggleBtn.dataset.toggleStatus}`), {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      loadMemes();
      loadDashboard();
    } catch (err) {
      setNotice($("memeMsg"), err.message, "error");
    }
  }
};

/* ---------------- petitions ---------------- */
async function loadPetitions() {
  const petitions = await api(A("/api/petitions?status=pending"));
  $("petitionRows").innerHTML = petitions.length
    ? petitions
        .map(
          (p) => `
    <div class="row">
      <div class="row-top"><strong>${escapeHtml(p.title)}</strong><span class="pill warn">pending</span></div>
      <small>${escapeHtml(p.category)} · ${escapeHtml(p.creator)} · ${fmtDate(p.created_at)}</small>
      <small>${escapeHtml(p.text)}</small>
      <div class="row-actions"><button class="green small" data-approve="${p.id}">Approve → Publish</button><button class="danger small" data-reject="${p.id}">Reject</button></div>
    </div>`,
        )
        .join("")
    : '<div class="empty">Koi pending petition nahi hai.</div>';
}
$("petitionRows").onclick = async (e) => {
  const approve = e.target.closest("[data-approve]");
  const reject = e.target.closest("[data-reject]");
  try {
    if (approve) {
      const d = await api(
        A(`/api/petitions/${approve.dataset.approve}/approve`),
        { method: "POST" },
      );
      setNotice($("petitionMsg"), d.message, "ok");
      loadPetitions();
      loadMemes();
      loadDashboard();
    } else if (reject) {
      const d = await api(A(`/api/petitions/${reject.dataset.reject}/reject`), {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNotice($("petitionMsg"), d.message, "ok");
      loadPetitions();
      loadDashboard();
    }
  } catch (err) {
    setNotice($("petitionMsg"), err.message, "error");
  }
};

/* ---------------- ministries ---------------- */
async function loadMinistries() {
  const ministries = await api(A("/api/ministries"));
  $("ministryRows").innerHTML = ministries.length
    ? ministries
        .map(
          (m) => `
    <div class="row">
      <div class="row-top"><strong>${m.emoji} ${escapeHtml(m.name)}</strong><span class="pill${m.active ? "" : " off"}">${m.active ? "active" : "hidden"}</span></div>
      <small>key: ${escapeHtml(m.key)}</small>
      <div class="row-actions"><button class="secondary small" data-toggle-min="${m.id}" data-active="${m.active}">${m.active ? "Hide" : "Show"}</button><button class="danger small" data-del-min="${m.id}">Delete</button></div>
    </div>`,
        )
        .join("")
    : '<div class="empty">Koi ministry nahi hai.</div>';
}
$("minSaveBtn").onclick = async () => {
  const payload = {
    key: $("minKey").value.trim(),
    name: $("minName").value.trim(),
    emoji: $("minEmoji").value.trim() || "🏛",
  };
  if (!payload.key || !payload.name) {
    setNotice($("minMsg"), "Key aur name required hain.", "error");
    return;
  }
  try {
    await api(A("/api/ministries"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
    $("minKey").value = "";
    $("minName").value = "";
    $("minEmoji").value = "";
    setNotice($("minMsg"), "Ministry add ho gayi.", "ok");
    loadMinistries();
    loadDashboard();
  } catch (e) {
    setNotice($("minMsg"), e.message, "error");
  }
};
$("ministryRows").onclick = async (e) => {
  const toggle = e.target.closest("[data-toggle-min]");
  const del = e.target.closest("[data-del-min]");
  try {
    if (toggle) {
      await api(A(`/api/ministries/${toggle.dataset.toggleMin}`), {
        method: "PUT",
        body: JSON.stringify({ active: toggle.dataset.active === "0" }),
      });
      loadMinistries();
      loadDashboard();
    } else if (del) {
      if (!confirm("Ministry delete karni hai?")) return;
      await api(A(`/api/ministries/${del.dataset.delMin}`), {
        method: "DELETE",
      });
      loadMinistries();
      loadDashboard();
    }
  } catch (err) {
    setNotice($("minMsg"), err.message, "error");
  }
};

/* ---------------- ticker + motd ---------------- */
async function loadTicker() {
  const items = await api(A("/api/ticker"));
  $("tickerRows").innerHTML = items.length
    ? items
        .map(
          (t) => `
    <div class="row"><div class="row-top"><strong>${escapeHtml(t.text)}</strong><span class="pill${t.active ? "" : " off"}">${t.active ? "active" : "hidden"}</span></div>
    <div class="row-actions"><button class="secondary small" data-toggle-ticker="${t.id}" data-active="${t.active}">${t.active ? "Hide" : "Show"}</button><button class="danger small" data-del-ticker="${t.id}">Delete</button></div></div>`,
        )
        .join("")
    : '<div class="empty">Koi ticker line nahi hai.</div>';
}
$("tickerSaveBtn").onclick = async () => {
  const text = $("tickerText").value.trim();
  if (!text) return;
  try {
    await api(A("/api/ticker"), {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    $("tickerText").value = "";
    setNotice($("tickerMsg"), "Line add ho gayi.", "ok");
    loadTicker();
  } catch (e) {
    setNotice($("tickerMsg"), e.message, "error");
  }
};
$("tickerRows").onclick = async (e) => {
  const toggle = e.target.closest("[data-toggle-ticker]");
  const del = e.target.closest("[data-del-ticker]");
  try {
    if (toggle) {
      await api(A(`/api/ticker/${toggle.dataset.toggleTicker}`), {
        method: "PUT",
        body: JSON.stringify({ active: toggle.dataset.active === "0" }),
      });
      loadTicker();
    } else if (del) {
      await api(A(`/api/ticker/${del.dataset.delTicker}`), {
        method: "DELETE",
      });
      loadTicker();
    }
  } catch (err) {
    setNotice($("tickerMsg"), err.message, "error");
  }
};
async function loadSettingsTab() {
  const settings = await api(A("/api/settings"));
  $("motdMemeId").value = settings.motd_meme_id || "";
  $("siteTitle").value = settings.site_title || "";
  $("siteTagline").value = settings.site_tagline || "";
  $("maintenanceMode").checked = settings.maintenance_mode === "1";
  $("maintenanceMessage").value = settings.maintenance_message || "";
}
$("motdSaveBtn").onclick = async () => {
  try {
    await api(A("/api/settings"), {
      method: "PUT",
      body: JSON.stringify({ motd_meme_id: $("motdMemeId").value.trim() }),
    });
    setNotice($("motdMsg"), "MOTD saved.", "ok");
  } catch (e) {
    setNotice($("motdMsg"), e.message, "error");
  }
};
$("motdClearBtn").onclick = async () => {
  $("motdMemeId").value = "";
  try {
    await api(A("/api/settings"), {
      method: "PUT",
      body: JSON.stringify({ motd_meme_id: "" }),
    });
    setNotice($("motdMsg"), "Auto-rotate ON.", "ok");
  } catch (e) {
    setNotice($("motdMsg"), e.message, "error");
  }
};
$("settingsSaveBtn").onclick = async () => {
  try {
    await api(A("/api/settings"), {
      method: "PUT",
      body: JSON.stringify({
        site_title: $("siteTitle").value.trim(),
        site_tagline: $("siteTagline").value.trim(),
        maintenance_mode: $("maintenanceMode").checked ? "1" : "0",
        maintenance_message: $("maintenanceMessage").value.trim(),
      }),
    });
    setNotice($("settingsMsg"), "Settings saved.", "ok");
  } catch (e) {
    setNotice($("settingsMsg"), e.message, "error");
  }
};
$("backupBtn").onclick = () => {
  window.location.href = A("/api/backup");
};

/* ---------------- chat moderation ---------------- */
async function loadWords() {
  const words = await api(A("/api/moderation/banned-words"));
  $("wordRows").innerHTML = words.length
    ? words
        .map(
          (w) =>
            `<div class="row"><div class="row-top"><strong>${escapeHtml(w.word)}</strong><button class="danger small" data-del-word="${w.id}">Remove</button></div></div>`,
        )
        .join("")
    : '<div class="empty">Koi banned word nahi hai.</div>';
}
$("wordSaveBtn").onclick = async () => {
  const word = $("wordInput").value.trim();
  if (!word) return;
  try {
    await api(A("/api/moderation/banned-words"), {
      method: "POST",
      body: JSON.stringify({ word }),
    });
    $("wordInput").value = "";
    loadWords();
  } catch (e) {
    setNotice($("chatMsg"), e.message, "error");
  }
};
$("wordRows").onclick = async (e) => {
  const btn = e.target.closest("[data-del-word]");
  if (!btn) return;
  try {
    await api(A(`/api/moderation/banned-words/${btn.dataset.delWord}`), {
      method: "DELETE",
    });
    loadWords();
  } catch (err) {
    setNotice($("chatMsg"), err.message, "error");
  }
};
async function loadIpBans() {
  const bans = await api(A("/api/moderation/ip-bans"));
  $("ipBanRows").innerHTML = bans.length
    ? bans
        .map(
          (b) =>
            `<div class="row"><div class="row-top"><strong>${escapeHtml(b.ip)}</strong><button class="danger small" data-unban="${b.id}">Unban</button></div><small>${escapeHtml(b.reason || "No reason given")} · ${fmtDate(b.created_at)}</small></div>`,
        )
        .join("")
    : '<div class="empty">Koi IP banned nahi hai.</div>';
}
$("banSaveBtn").onclick = async () => {
  const ip = $("banIp").value.trim();
  if (!ip) return;
  try {
    const d = await api(A("/api/moderation/ip-bans"), {
      method: "POST",
      body: JSON.stringify({ ip, reason: $("banReason").value.trim() }),
    });
    $("banIp").value = "";
    $("banReason").value = "";
    setNotice($("chatMsg"), d.message, "ok");
    loadIpBans();
    loadDashboard();
  } catch (e) {
    setNotice($("chatMsg"), e.message, "error");
  }
};
$("ipBanRows").onclick = async (e) => {
  const btn = e.target.closest("[data-unban]");
  if (!btn) return;
  try {
    await api(A(`/api/moderation/ip-bans/${btn.dataset.unban}`), {
      method: "DELETE",
    });
    loadIpBans();
    loadDashboard();
  } catch (err) {
    setNotice($("chatMsg"), err.message, "error");
  }
};

/* ---------------- IP warnings (soft tier below a full ban) ---------------- */
async function loadIpWarnings() {
  const warnings = await api(A("/api/moderation/ip-warnings"));
  $("ipWarningRows").innerHTML = warnings.length
    ? warnings
        .map(
          (w) =>
            `<div class="row"><div class="row-top"><strong>${escapeHtml(w.ip)}</strong><span>Strike ${w.strikes}/3</span></div><small>${escapeHtml(w.reason || "No reason given")} · ${fmtDate(w.updated_at)}</small><div class="form-actions" style="margin-top: 8px"><button class="danger small" data-promote-warning="${escapeHtml(w.ip)}">Promote to Ban</button><button class="small" data-clear-warning="${escapeHtml(w.ip)}">Clear Warning</button></div></div>`,
        )
        .join("")
    : '<div class="empty">Koi IP warned nahi hai.</div>';
}
$("warnSaveBtn").onclick = async () => {
  const ip = $("warnIp").value.trim();
  if (!ip) return;
  try {
    const d = await api(A("/api/moderation/ip-warnings"), {
      method: "POST",
      body: JSON.stringify({ ip, reason: $("warnReason").value.trim() }),
    });
    $("warnIp").value = "";
    $("warnReason").value = "";
    setNotice($("warnMsg"), d.message, d.escalatedToBan ? "error" : "ok");
    loadIpWarnings();
    loadIpBans();
    loadDashboard();
  } catch (e) {
    setNotice($("warnMsg"), e.message, "error");
  }
};
$("ipWarningRows").onclick = async (e) => {
  const promoteBtn = e.target.closest("[data-promote-warning]");
  const clearBtn = e.target.closest("[data-clear-warning]");
  try {
    if (promoteBtn) {
      const d = await api(
        A(`/api/moderation/ip-warnings/${encodeURIComponent(promoteBtn.dataset.promoteWarning)}/promote`),
        { method: "POST" },
      );
      setNotice($("warnMsg"), d.message, "ok");
      loadIpWarnings();
      loadIpBans();
      loadDashboard();
    } else if (clearBtn) {
      await api(
        A(`/api/moderation/ip-warnings/${encodeURIComponent(clearBtn.dataset.clearWarning)}`),
        { method: "DELETE" },
      );
      loadIpWarnings();
    }
  } catch (err) {
    setNotice($("warnMsg"), err.message, "error");
  }
};

/* ---------------- Meme Adda partner reports (read-only list) ---------------- */
async function loadAddaReports() {
  const reports = await api(A("/api/moderation/adda-reports"));
  $("addaReportRows").innerHTML = reports.length
    ? reports
        .map(
          (r) =>
            `<div class="row"><div class="row-top"><strong>${escapeHtml(r.reason)}</strong><small>${fmtDate(r.created_at)}</small></div>${r.detail ? `<small>Detail: ${escapeHtml(r.detail)}</small>` : ""}<small>Reported IP: ${escapeHtml(r.reported_ip || "unknown")} · Reporter token: ${escapeHtml((r.reporter_token || "").slice(0, 12))}…</small></div>`,
        )
        .join("")
    : '<div class="empty">Koi Meme Adda report nahi hai.</div>';
}

/* ---------------- admin users ---------------- */
async function loadAdmins() {
  if (currentUser?.role !== "super") {
    $("adminUserRows").innerHTML =
      '<div class="empty">Sirf super-admin ye list dekh sakta hai.</div>';
    return;
  }
  try {
    const admins = await api(A("/api/admins"));
    $("adminUserRows").innerHTML = admins.length
      ? admins
          .map(
            (a) =>
              `<div class="row"><div class="row-top"><strong>${escapeHtml(a.username)}</strong><span class="pill">${escapeHtml(a.role)}</span></div><small>Created ${fmtDate(a.created_at)}</small><div class="row-actions"><button class="danger small" data-del-admin="${a.id}">Remove</button></div></div>`,
          )
          .join("")
      : '<div class="empty">Koi extra admin nahi hai.</div>';
  } catch {
    /* not super, ignore */
  }
}
$("newAdminBtn").onclick = async () => {
  const payload = {
    username: $("newAdminUser").value.trim(),
    password: $("newAdminPass").value,
    role: $("newAdminRole").value,
  };
  try {
    await api(A("/api/admins"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
    $("newAdminUser").value = "";
    $("newAdminPass").value = "";
    setNotice($("usersMsg"), "Naya admin ban gaya.", "ok");
    loadAdmins();
  } catch (e) {
    setNotice($("usersMsg"), e.message, "error");
  }
};
$("adminUserRows").onclick = async (e) => {
  const btn = e.target.closest("[data-del-admin]");
  if (!btn || !confirm("Is admin ko remove karna hai?")) return;
  try {
    await api(A(`/api/admins/${btn.dataset.delAdmin}`), { method: "DELETE" });
    loadAdmins();
  } catch (err) {
    setNotice($("usersMsg"), err.message, "error");
  }
};

/* ---------------- activity log ---------------- */
async function loadActivity() {
  const rows = await api(A("/api/activity"));
  $("activityRows").innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            `<div class="row"><div class="row-top"><strong>${escapeHtml(r.action)}</strong><span class="sub">${fmtDate(r.created_at)}</span></div><small>${escapeHtml(r.actor)} ${r.detail ? "· " + escapeHtml(r.detail) : ""}</small></div>`,
        )
        .join("")
    : '<div class="empty">Koi activity nahi hai abhi.</div>';
}

(async () => {
  try {
    const data = await api(A("/api/me"));
    showDashboard(data.user);
  } catch {
    showLogin();
  }
})();