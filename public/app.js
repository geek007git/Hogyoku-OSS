const state = {
  user: null,
  documents: [],
  threads: [],
  activeDocumentIds: new Set(),
  currentThreadId: null,
  currentThreadTitle: null,
  turns: [],
  initials: "",
  authMode: "login",
  pollTimer: null,
};

const $ = (selector) => document.querySelector(selector);
const sourceStrip = $("#sourceStrip");
const questionForm = $("#questionForm");
const questionInput = $("#questionInput");
const emptyState = $("#emptyState");
const answerView = $("#answerView");
const conversation = $("#conversation");
const evidenceList = $("#evidenceList");
const evidencePanel = $("#evidencePanel");
const uploadModal = $("#uploadModal");
const authModal = $("#authModal");
const toast = $("#toast");
const evidenceByTurn = new Map();

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/")) showAuth();
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function showToast(message, isError = false) {
  clearTimeout(showToast.timer);
  toast.textContent = message;
  toast.style.background = isError ? "var(--coral)" : "var(--ink)";
  toast.classList.remove("hidden");
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2600);
}

function showAuth() {
  authModal.classList.remove("hidden");
}

function hideAuth() {
  authModal.classList.add("hidden");
}

function toggleProfileMenu(force) {
  $("#profileMenu").classList.toggle("hidden", force);
}

async function logout() {
  toggleProfileMenu(true);
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (error) {
    showToast(error.message, true);
  }
  clearTimeout(state.pollTimer);
  state.user = null;
  state.documents = [];
  state.threads = [];
  state.activeDocumentIds.clear();
  state.currentThreadId = null;
  state.currentThreadTitle = null;
  state.turns = [];
  conversation.innerHTML = "";
  evidenceByTurn.clear();
  sourceStrip.innerHTML = "";
  renderThreads();
  renderEvidence([]);
  answerView.classList.add("hidden");
  emptyState.classList.remove("hidden");
  setAuthMode("login");
  showAuth();
}

function setAuthMode(mode) {
  state.authMode = mode;
  const register = mode === "register";
  $("#authTitle").textContent = register ? "Create your workspace" : "Sign in to Hogyoku";
  $("#authName").parentElement.classList.toggle("hidden", !register);
  $("#authName").required = register;
  $("#authSwitch").textContent = register
    ? "Already have an account? Sign in"
    : "Create a new account";
  $(".auth-submit").textContent = register ? "Create account" : "Sign in";
  $("#authPassword").autocomplete = register ? "new-password" : "current-password";
  $("#authError").classList.add("hidden");
}

async function submitAuth(event) {
  event.preventDefault();
  const error = $("#authError");
  error.classList.add("hidden");
  const body = {
    email: $("#authEmail").value.trim(),
    password: $("#authPassword").value,
  };
  if (state.authMode === "register") body.displayName = $("#authName").value.trim();
  try {
    await api(`/api/auth/${state.authMode}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const session = await api("/api/auth/me");
    state.user = session.user;
    hideAuth();
    updateProfile();
    await Promise.all([loadDocuments(), loadThreads()]);
  } catch (authError) {
    error.textContent = authError.message;
    error.classList.remove("hidden");
  }
}

function updateProfile() {
  if (!state.user) return;
  const initials = state.user.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  state.initials = initials;
  $(".profile-button .avatar").textContent = initials;
  $(".profile-button strong").textContent = state.user.displayName;
  $(".profile-button small").textContent = state.user.email;
}

function updateBreadcrumb() {
  $(".breadcrumb strong").textContent = state.currentThreadTitle || "New thread";
}

async function loadDocuments() {
  const payload = await api("/api/documents");
  state.documents = payload.documents;
  const known = new Set(state.documents.map((document) => document.id));
  state.activeDocumentIds.forEach((id) => {
    if (!known.has(id)) state.activeDocumentIds.delete(id);
  });
  state.documents.forEach((document) => {
    if (!state.activeDocumentIds.has(document.id) && document.status === "ready") {
      state.activeDocumentIds.add(document.id);
    }
  });
  renderDocuments();
  scheduleDocumentPolling();
}

function renderDocuments() {
  sourceStrip.innerHTML = state.documents
    .map((document) => {
      const active = state.activeDocumentIds.has(document.id);
      const visual = document.mimeType.startsWith("image/");
      return `
        <button class="source-chip ${active ? "active" : ""}" data-document="${document.id}">
          <span class="file-type ${visual ? "visual" : ""}">${visual ? "SCAN" : document.mimeType === "application/pdf" ? "PDF" : "DOC"}</span>
          <span>
            <strong>${escapeHtml(document.title)}</strong>
            <small>${document.pageCount || "—"} pages · ${document.chunkCount} chunks</small>
          </span>
          <i class="source-status ${document.status}" title="${document.status}"></i>
        </button>
      `;
    })
    .join("");
  sourceStrip.insertAdjacentHTML(
    "beforeend",
    '<button class="add-source" id="addSourceButton">＋ Add sources</button>',
  );
  sourceStrip.querySelectorAll(".source-chip").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.document;
      if (state.activeDocumentIds.has(id)) state.activeDocumentIds.delete(id);
      else state.activeDocumentIds.add(id);
      renderDocuments();
    });
  });
  $("#addSourceButton").addEventListener("click", openUpload);
  $("#libraryCount").textContent = state.documents.length;
  $("#usageLabel").textContent = `${state.documents.length} / 20`;
  $("#usageBar").style.width = `${Math.min((state.documents.length / 20) * 100, 100)}%`;
  const readyChunks = state.documents.reduce((sum, item) => sum + item.chunkCount, 0);
  $(".index-health > div:last-child > span").innerHTML = `<i></i> ${readyChunks} evidence chunks`;
}

function scheduleDocumentPolling() {
  clearTimeout(state.pollTimer);
  if (state.documents.some((document) => ["queued", "processing"].includes(document.status))) {
    state.pollTimer = setTimeout(() => loadDocuments().catch(console.error), 2500);
  }
}

async function uploadFiles(files) {
  const list = [...files];
  for (const file of list) {
    const row = document.createElement("div");
    row.className = "upload-row";
    row.innerHTML = `
      <span class="file-type">${escapeHtml(file.name.split(".").pop().slice(0, 4).toUpperCase())}</span>
      <div><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)}</small></div>
      <span class="upload-status">Uploading...</span>
    `;
    $("#uploadList").prepend(row);
    const form = new FormData();
    form.append("file", file);
    try {
      const payload = await api("/api/documents", { method: "POST", body: form });
      state.documents.unshift(payload.document);
      row.querySelector(".upload-status").textContent = "Queued ✓";
      renderDocuments();
      scheduleDocumentPolling();
    } catch (error) {
      row.querySelector(".upload-status").textContent = "Failed";
      row.querySelector(".upload-status").style.color = "var(--coral)";
      showToast(error.message, true);
    }
  }
}

async function loadThreads() {
  const payload = await api("/api/threads");
  state.threads = payload.threads;
  renderThreads();
}

function renderThreads() {
  const section = $(".sidebar-section");
  section.querySelectorAll(".thread-item").forEach((item) => item.remove());
  const html = state.threads
    .slice(0, 12)
    .map(
      (thread) => `
    <div class="thread-item ${thread.id === state.currentThreadId ? "active" : ""}">
      <button class="thread-open" data-thread="${thread.id}">
        <span class="thread-dot ${thread.id === state.currentThreadId ? "" : "muted"}"></span>
        <span>
          <strong>${escapeHtml(thread.title)}</strong>
          <small>${thread.messageCount} messages · ${new Date(thread.updatedAt).toLocaleDateString()}</small>
        </span>
      </button>
      <button class="thread-action" data-rename="${thread.id}" title="Rename thread" aria-label="Rename thread">✎</button>
      <button class="thread-action" data-delete="${thread.id}" title="Delete thread" aria-label="Delete thread">×</button>
    </div>
  `,
    )
    .join("");
  section.insertAdjacentHTML(
    "beforeend",
    html ||
      `<div class="thread-item empty"><span class="thread-dot muted"></span><span><strong>No threads yet</strong><small>Ask your first question</small></span></div>`,
  );
}

async function renameThread(threadId) {
  const thread = state.threads.find((item) => item.id === threadId);
  const next = window.prompt("Rename thread", thread?.title || "");
  if (next == null) return;
  const title = next.trim();
  if (!title) return;
  try {
    await api(`/api/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
    if (threadId === state.currentThreadId) {
      state.currentThreadTitle = title;
      updateBreadcrumb();
    }
    await loadThreads();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteThread(threadId) {
  if (!window.confirm("Delete this thread and all of its messages?")) return;
  try {
    await api(`/api/threads/${threadId}`, { method: "DELETE" });
    if (threadId === state.currentThreadId) newThread();
    await loadThreads();
    showToast("Thread deleted");
  } catch (error) {
    showToast(error.message, true);
  }
}

async function openThread(threadId) {
  try {
    const payload = await api(`/api/threads/${threadId}`);
    state.currentThreadId = threadId;
    state.currentThreadTitle = payload.thread.title;
    renderThreads();
    updateBreadcrumb();
    emptyState.classList.add("hidden");
    answerView.classList.remove("hidden");
    renderMessages(payload.messages);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function askQuestion(event) {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;
  const submit = $(".send-button");
  submit.disabled = true;
  submit.textContent = "…";
  try {
    const payload = await api("/api/ask", {
      method: "POST",
      body: JSON.stringify({
        question,
        threadId: state.currentThreadId,
        documentIds: [...state.activeDocumentIds],
      }),
    });
    if (state.currentThreadId !== payload.threadId) {
      state.currentThreadId = payload.threadId;
      state.currentThreadTitle = question.slice(0, 80);
      state.turns = [];
      conversation.innerHTML = "";
      evidenceByTurn.clear();
      updateBreadcrumb();
    }
    appendTurn(question, {
      ...payload.message,
      searchQuery: payload.rewritten ? payload.searchQuery : undefined,
    });
    questionInput.value = "";
    questionInput.style.height = "auto";
    await loadThreads();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    submit.disabled = false;
    submit.textContent = "↑";
  }
}

function formatAnswer(content, turn) {
  return escapeHtml(content)
    .replace(/\n\n+/g, "</p><p>")
    .replace(
      /\[(\d+)\]/g,
      `<button class="citation" data-turn="${turn}" data-citation="$1">[$1]</button>`,
    );
}

function questionBlock(content) {
  return `
    <div class="question-row">
      <span class="avatar small">${escapeHtml(state.initials || "·")}</span>
      <div>
        <small>Your question</small>
        <h2>${escapeHtml(content)}</h2>
      </div>
    </div>`;
}

function answerBlock(message) {
  const turn = message.id;
  const citations = message.citations || [];
  const verification = message.verification || { supported: false, score: 0, claims: [] };
  const note =
    message.searchQuery &&
    message.searchQuery.toLowerCase() !== (message.question || "").toLowerCase()
      ? `<div class="search-note">Searched for <span>${escapeHtml(message.searchQuery)}</span></div>`
      : "";
  const claims = (verification.claims || [])
    .map(
      (claim) =>
        `<span class="claim-pill ${claim.supported === false ? "unmet" : ""}">${escapeHtml(
          (claim.text || "").slice(0, 80),
        )}</span>`,
    )
    .join("");
  return `
    ${note}
    <article class="answer-card">
      <div class="answer-heading">
        <div class="answer-symbol">H</div>
        <div>
          <small>Grounded answer</small>
          <strong>${
            verification.supported
              ? `Verified against ${citations.length} evidence passages`
              : "Evidence verification needs review"
          }</strong>
        </div>
        <span class="confidence-badge ${verification.supported ? "" : "weak"}">${
          verification.supported ? "Verified" : "Evidence too weak"
        }</span>
      </div>
      <div class="answer-copy" data-turn="${turn}"><p>${formatAnswer(message.content, turn)}</p></div>
      <div class="answer-footer">
        <button data-why="${turn}"><span>⌘</span> Why this answer?</button>
        <div>
          <button data-copy="${turn}" aria-label="Copy answer">□</button>
          <span class="answer-mode">${
            message.modelMode === "extractive" ? "Local" : message.modelMode ? "Model" : ""
          }</span>
        </div>
      </div>
    </article>
    <section class="verification-card">
      <div class="verification-title">
        <span class="verified-icon">${verification.supported ? "✓" : "!"}</span>
        <div>
          <strong>Answer verification</strong>
          <small>Every claim checked against retrieved evidence</small>
        </div>
        <strong>${verification.score}%</strong>
      </div>
      <div class="verification-track"><span style="width:${Math.max(0, Math.min(100, verification.score))}%"></span></div>
      <div class="claim-list">${claims}</div>
    </section>`;
}

function turnBlock(question, message) {
  return `<div class="turn">${questionBlock(question)}${answerBlock({ ...message, question })}</div>`;
}

function renderMessages(messages) {
  state.turns = [];
  conversation.innerHTML = "";
  evidenceByTurn.clear();
  let pendingQuestion = "";
  let lastAssistant = null;
  for (const message of messages) {
    if (message.role === "user") {
      pendingQuestion = message.content;
    } else {
      conversation.insertAdjacentHTML("beforeend", turnBlock(pendingQuestion, message));
      evidenceByTurn.set(message.id, message.citations || []);
      state.turns.push({ question: pendingQuestion, message });
      lastAssistant = message;
      pendingQuestion = "";
    }
  }
  if (pendingQuestion) {
    conversation.insertAdjacentHTML(
      "beforeend",
      `<div class="turn">${questionBlock(pendingQuestion)}</div>`,
    );
  }
  if (lastAssistant) {
    renderEvidence(lastAssistant.citations || []);
    updateRetrievalSummary(lastAssistant);
  } else {
    renderEvidence([]);
  }
  scrollConversation();
}

function appendTurn(question, message) {
  emptyState.classList.add("hidden");
  answerView.classList.remove("hidden");
  conversation.insertAdjacentHTML("beforeend", turnBlock(question, message));
  evidenceByTurn.set(message.id, message.citations || []);
  state.turns.push({ question, message });
  renderEvidence(message.citations || []);
  updateRetrievalSummary(message);
  scrollConversation();
}

function updateRetrievalSummary(message) {
  $("#retrievedCount").textContent = (message.citations || []).length;
  $("#latencyValue").textContent = message.modelMode === "extractive" ? "Local" : "Model";
}

function showTurnEvidence(turn) {
  renderEvidence(evidenceByTurn.get(turn) || []);
}

async function copyTurn(turn) {
  const card = conversation.querySelector(`.answer-copy[data-turn="${turn}"]`);
  if (!card) return;
  await navigator.clipboard.writeText(card.innerText);
  showToast("Answer copied");
}

function scrollConversation() {
  answerView.scrollTop = answerView.scrollHeight;
}

function buildMarkdown() {
  const lines = [`# ${state.currentThreadTitle || "Hogyoku research thread"}`, ""];
  for (const { question, message } of state.turns) {
    const verification = message.verification || { supported: false, score: 0 };
    lines.push(`## ${question}`, "");
    lines.push(message.content, "");
    lines.push(
      `> **Verification:** ${verification.score}% — ${verification.supported ? "supported" : "needs review"}`,
      "",
    );
    const citations = message.citations || [];
    if (citations.length) {
      lines.push("### Sources", "");
      for (const citation of citations) {
        lines.push(
          `${citation.index}. **${citation.documentTitle}** — page ${citation.pageNumber ?? "—"} (${citation.kind})`,
        );
        lines.push(`   > ${(citation.snippet || "").replace(/\s+/g, " ").trim()}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function exportConversation() {
  if (!state.turns.length) {
    showToast("Ask a question first", true);
    return;
  }
  const blob = new Blob([buildMarkdown()], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safe =
    (state.currentThreadTitle || "hogyoku-thread")
      .replace(/[^\w.-]+/g, "-")
      .slice(0, 60)
      .toLowerCase() || "hogyoku-thread";
  link.href = url;
  link.download = `${safe}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Conversation exported");
}

function renderEvidence(citations = []) {
  evidenceList.innerHTML = citations.length
    ? citations.map((citation) => `
      <article class="evidence-card" data-rank="${citation.index}">
        <div class="evidence-card-top">
          <span class="evidence-rank">${citation.index}</span>
          <span class="evidence-source">
            <strong>${escapeHtml(citation.documentTitle)}</strong>
            <small>Page ${citation.pageNumber || "—"} · ${escapeHtml(citation.kind.toUpperCase())}</small>
          </span>
        </div>
        <blockquote>${escapeHtml(citation.snippet)}</blockquote>
        <div class="evidence-meta"><span>${escapeHtml(citation.kind)}</span><span>Hybrid + reranked</span></div>
      </article>
    `).join("")
    : `<div class="evidence-placeholder"><span>!</span><strong>No evidence returned</strong><p>Try broadening your source selection.</p></div>`;
}

function focusEvidence(rank) {
  evidencePanel.classList.add("open");
  document.querySelectorAll(".evidence-card").forEach((card) => {
    card.classList.toggle("highlighted", card.dataset.rank === String(rank));
  });
  document.querySelector(`.evidence-card[data-rank="${rank}"]`)?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function newThread() {
  state.currentThreadId = null;
  state.currentThreadTitle = null;
  state.turns = [];
  conversation.innerHTML = "";
  evidenceByTurn.clear();
  renderEvidence([]);
  answerView.classList.add("hidden");
  emptyState.classList.remove("hidden");
  updateBreadcrumb();
  renderThreads();
  questionInput.focus();
}

function openUpload() {
  uploadModal.classList.remove("hidden");
}

function closeUpload() {
  uploadModal.classList.add("hidden");
}

function bindEvents() {
  $("#authForm").addEventListener("submit", submitAuth);
  $("#authSwitch").addEventListener("click", () =>
    setAuthMode(state.authMode === "login" ? "register" : "login"),
  );
  questionForm.addEventListener("submit", askQuestion);
  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      questionForm.requestSubmit();
    }
  });
  questionInput.addEventListener("input", () => {
    questionInput.style.height = "auto";
    questionInput.style.height = `${Math.min(questionInput.scrollHeight, 110)}px`;
  });
  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      questionInput.value = button.lastChild.textContent.trim();
      questionForm.requestSubmit();
    });
  });
  $("#newThreadButton").addEventListener("click", newThread);
  $(".profile-button").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProfileMenu();
  });
  $("#logoutButton").addEventListener("click", logout);
  $("#exportButton").addEventListener("click", exportConversation);
  document.addEventListener("click", () => toggleProfileMenu(true));
  conversation.addEventListener("click", (event) => {
    const citation = event.target.closest(".citation");
    if (citation) {
      showTurnEvidence(citation.dataset.turn);
      focusEvidence(citation.dataset.citation);
      return;
    }
    const why = event.target.closest("[data-why]");
    if (why) {
      showTurnEvidence(why.dataset.why);
      focusEvidence(1);
      return;
    }
    const copy = event.target.closest("[data-copy]");
    if (copy) copyTurn(copy.dataset.copy);
  });
  $(".sidebar-section").addEventListener("click", (event) => {
    const open = event.target.closest("[data-thread]");
    if (open) return openThread(open.dataset.thread);
    const rename = event.target.closest("[data-rename]");
    if (rename) return renameThread(rename.dataset.rename);
    const remove = event.target.closest("[data-delete]");
    if (remove) return deleteThread(remove.dataset.delete);
  });
  $("#attachButton").addEventListener("click", openUpload);
  $("#closeUpload").addEventListener("click", closeUpload);
  $("#closeEvidence").addEventListener("click", () => evidencePanel.classList.remove("open"));
  $("#themeButton").addEventListener("click", () => document.body.classList.toggle("dark"));
  $("#searchButton").addEventListener("click", () => questionInput.focus());
  $("#fileInput").addEventListener("change", (event) => uploadFiles(event.target.files));
  uploadModal.addEventListener("click", (event) => {
    if (event.target === uploadModal) closeUpload();
  });
  const dropZone = $("#dropZone");
  ["dragenter", "dragover"].forEach((name) => dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((name) => dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  }));
  dropZone.addEventListener("drop", (event) => uploadFiles(event.dataTransfer.files));
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      newThread();
    }
    if (event.key === "Escape") {
      closeUpload();
      evidencePanel.classList.remove("open");
      toggleProfileMenu(true);
    }
  });
}

async function initialize() {
  bindEvents();
  setAuthMode("login");
  updateBreadcrumb();
  try {
    const session = await api("/api/auth/me");
    state.user = session.user;
    updateProfile();
    await Promise.all([loadDocuments(), loadThreads()]);
  } catch {
    showAuth();
  }
}

initialize();
