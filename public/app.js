const socket = io("http://localhost:8000");
const dropZone   = document.getElementById("drop-zone");
const fileInput  = document.getElementById("file-input");
const fileList   = document.getElementById("file-list");
const statusEl   = document.getElementById("status");

let files        = {};
let activeFilter = "all";
let currentUser  = null;      // name entered in the modal
let connectedUsers = [];      // live list pushed by the server

// ── File type classification ──────────────────────────────────
const IMAGE_EXT    = ["jpg","jpeg","png","gif","webp","svg","bmp","ico","tiff","avif"];
const VIDEO_EXT    = ["mp4","mov","avi","mkv","webm","flv","wmv","m4v","ogv","3gp"];
const DOC_EXT      = ["pdf","doc","docx","xls","xlsx","ppt","pptx","txt","csv","md",
                      "odt","ods","odp","rtf","epub","pages","numbers","key"];

function getFileType(name) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (IMAGE_EXT.includes(ext))    return "image";
  if (VIDEO_EXT.includes(ext))    return "video";
  if (DOC_EXT.includes(ext))      return "document";
  return "other";
}

function getFileIcon(type) {
  if (type === "image")    return "ti-photo";
  if (type === "video")    return "ti-video";
  if (type === "document") return "ti-file-text";
  return "ti-file";
}

function getFileExt(name) {
  return (name.split(".").pop() || "file").toUpperCase().slice(0, 6);
}

// ── Socket events ─────────────────────────────────────────────
socket.on("connect", () => {
  if (currentUser) {
    socket.emit("user_connected", { name: currentUser });
  }
});

socket.on("file_list", (list) => {
  files = {};
  list.forEach(f => files[f.id] = f);
  render();
  updateBadges();
  updateStorage();
});

socket.on("file_uploaded", (f) => {
  files[f.id] = f;
  render();
  updateBadges();
  updateStorage();
  setStatus(`"${f.name}" uploaded`);
});

socket.on("file_deleted", ({ id }) => {
  const name = files[id]?.name;
  delete files[id];
  render();
  updateBadges();
  updateStorage();
  if (name) setStatus(`"${name}" removed`);
});

// Server sends the current user list whenever someone joins or leaves.
// Payload: array of name strings, e.g. ["Kwame", "Ama", "Kofi"]
socket.on("user_list", (names) => {
  connectedUsers = names;
  renderUsers();
});

// ── Upload ────────────────────────────────────────────────────
async function uploadFiles(fileArr) {
  for (const file of fileArr) {
    const form = new FormData();
    form.append("file", file);
    // Send the uploader's name so the server can store it with the file record
    if (currentUser) form.append("uploader", currentUser);
    setStatus(`Uploading "${file.name}"…`);
    try {
      const res = await fetch("http://localhost:8000/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }
}

// ── Delete ────────────────────────────────────────────────────
async function deleteFile(id) {
  await fetch(`http://localhost:8000/files/${id}`, { method: "DELETE" });
}

// ── Render ────────────────────────────────────────────────────
function render() {
  fileList.innerHTML = "";
  const entries = Object.values(files).filter(f => {
    if (activeFilter === "all") return true;
    const type = getFileType(f.name);
    if (activeFilter === "images")    return type === "image";
    if (activeFilter === "documents") return type === "document";
    if (activeFilter === "videos")    return type === "video";
    if (activeFilter === "other")     return type === "other";
    return true;
  });

  if (!entries.length) {
    fileList.innerHTML = `
      <div class="empty-state">
        <i class="ti ti-inbox" aria-hidden="true"></i>
        <p>${activeFilter === "all" ? "No files yet" : "No " + activeFilter + " yet"}</p>
        <span>Upload files to see them here</span>
      </div>`;
    return;
  }

  entries.forEach(f => {
    const type = getFileType(f.name);
    const icon = getFileIcon(type);
    const ext  = getFileExt(f.name);
    const row  = document.createElement("div");
    row.className = "file-row";
    row.setAttribute("role", "listitem");
    const uploaderHtml = f.uploader
      ? `<span class="file-uploader"><i class="ti ti-user" aria-hidden="true"></i>${escHtml(f.uploader)}</span>`
      : "";

    row.innerHTML = `
      <div class="file-icon-wrap type-${type}" aria-hidden="true">
        <i class="ti ${icon}"></i>
      </div>
      <div class="file-meta">
        <span class="file-name" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
        <div class="file-info">
          <span class="file-size">${fmtSize(f.size)}</span>
          <span class="file-type-tag">${ext}</span>
        </div>
        <span>uploader: ${uploaderHtml}</span>
      </div>
      <div class="file-actions">
        <a href="http://localhost:8000/download/${f.id}" download="${escHtml(f.name)}" tabindex="-1">
          <button class="btn-action" aria-label="Download ${escHtml(f.name)}">
            <i class="ti ti-download" aria-hidden="true"></i>
            <span>Download</span>
          </button>
        </a>
        <button class="btn-action danger" onclick="deleteFile('${f.id}')" aria-label="Delete ${escHtml(f.name)}">
          <i class="ti ti-trash" aria-hidden="true"></i>
          <span>Delete</span>
        </button>
      </div>
    `;
    fileList.appendChild(row);
  });
}

// ── Badges ────────────────────────────────────────────────────
function updateBadges() {
  const all       = Object.values(files);
  const counts = {
    all:       all.length,
    images:    all.filter(f => getFileType(f.name) === "image").length,
    documents: all.filter(f => getFileType(f.name) === "document").length,
    videos:    all.filter(f => getFileType(f.name) === "video").length,
    other:     all.filter(f => getFileType(f.name) === "other").length,
  };
  for (const [key, val] of Object.entries(counts)) {
    const el    = document.getElementById(`badge-${key}`);
    const mobEl = document.getElementById(`mob-badge-${key}`);
    if (el)    el.textContent    = val;
    if (mobEl) mobEl.textContent = val;
  }
}

// ── Storage indicator ─────────────────────────────────────────
function updateStorage() {
  const total   = Object.values(files).reduce((s, f) => s + (f.size || 0), 0);
  const MAX     = 1024 * 1024 * 1024; // 1 GB visual ceiling
  const pct     = Math.min((total / MAX) * 100, 100).toFixed(1);
  const fillEl  = document.getElementById("storage-fill");
  const valEl   = document.getElementById("storage-value");
  if (fillEl) fillEl.style.width = pct + "%";
  if (valEl)  valEl.textContent  = fmtSize(total) + " used";
}

// ── Connected users ───────────────────────────────────────────
function renderUsers() {
  const lists = [
    document.getElementById("user-list"),
    document.getElementById("mob-user-list"),
  ];

  const html = connectedUsers.map(name => {
    const initials = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const isYou    = name === currentUser;
    return `
      <li class="user-item">
        <div class="user-avatar" aria-hidden="true">${escHtml(initials)}</div>
        <span class="user-name">${escHtml(name)}</span>
        ${isYou ? '<span class="user-you-badge">you</span>' : ""}
        <span class="online-dot" title="Online" aria-hidden="true"></span>
      </li>`;
  }).join("");

  lists.forEach(el => { if (el) el.innerHTML = html || '<li style="padding:6px 6px;font-size:13px;color:var(--text-muted)">No one else yet</li>'; });
}

// ── Name modal ────────────────────────────────────────────────
(function initNameModal() {
  const overlay   = document.getElementById("name-modal");
  const input     = document.getElementById("name-input");
  const submitBtn = document.getElementById("name-submit");
  const errorEl   = document.getElementById("name-error");
  const savedName = sessionStorage.getItem("file-sharing-display-name")?.trim();

  function enableApp() {
    document.getElementById("drop-zone").style.pointerEvents = "";
    document.getElementById("file-input").disabled = false;
  }

  function disableApp() {
    document.getElementById("drop-zone").style.pointerEvents = "none";
    document.getElementById("file-input").disabled = true;
  }

  function showError(msg) {
    errorEl.textContent = msg;
    input.classList.add("error");
  }

  function clearError() {
    errorEl.textContent = "";
    input.classList.remove("error");
  }

  function submit() {
    const name = input.value.trim();
    const accepted_characters = /^[a-zA-Z0-9 -]+$/;

    if (!accepted_characters.test(name)) {
      showError("Name can only contain letters, numbers, spaces, underscores, and hyphens.");
      input.focus();
      return;
    }
    if (!name) {
      showError("Please enter your name to continue.");
      input.focus();
      return;
    }
    if (name.length < 2) {
      showError("Name must be at least 2 characters.");
      input.focus();
      return;
    }

    // Store name globally and emit the connection event
    currentUser = name;
    sessionStorage.setItem("file-sharing-display-name", name);
    socket.emit("user_connected", { name });

    // Re-enable the app
    enableApp();

    // Dismiss the modal
    overlay.classList.add("hidden");
  }

  if (savedName) {
    currentUser = savedName;
    enableApp();
    overlay.classList.add("hidden");
    socket.emit("user_connected", { name: savedName });
    return;
  }

  disableApp();
  overlay.classList.remove("hidden");

  submitBtn.addEventListener("click", submit);
  input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  input.addEventListener("input",   clearError);
})();

// ── Filter nav ────────────────────────────────────────────────
const SECTION_LABELS = {
  all:       { title: "All files",   sub: "All your shared files in one place" },
  images:    { title: "Images",      sub: "Photos, graphics, and image files" },
  documents: { title: "Documents",   sub: "PDFs, spreadsheets, and text files" },
  videos:    { title: "Videos",      sub: "Video and media files" },
  other:     { title: "Other files", sub: "Everything else" },
};

function setFilter(filter) {
  activeFilter = filter;

  // Desktop sidebar
  document.querySelectorAll(".sidebar .nav-item").forEach(btn => {
    const active = btn.dataset.filter === filter;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-current", active ? "true" : "false");
  });

  // Mobile drawer
  document.querySelectorAll(".mobile-drawer .nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });

  // Mobile tabs
  document.querySelectorAll(".tab-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });

  // Header text
  const label = SECTION_LABELS[filter] || SECTION_LABELS.all;
  const titleEl = document.getElementById("section-title");
  const subEl   = document.getElementById("section-sub");
  if (titleEl) titleEl.textContent = label.title;
  if (subEl)   subEl.textContent   = label.sub;

  render();
}

// Wire up desktop sidebar
document.querySelectorAll(".sidebar .nav-item").forEach(btn => {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
});

// Wire up mobile drawer
document.querySelectorAll(".mobile-drawer .nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    setFilter(btn.dataset.filter);
    closeMobileMenu();
  });
});

// Wire up mobile tabs
document.querySelectorAll(".tab-item").forEach(btn => {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
});

// ── Mobile menu ───────────────────────────────────────────────
const menuBtn    = document.getElementById("mobile-menu-btn");
const mobileDrawer = document.getElementById("mobile-drawer");

function openMobileMenu() {
  mobileDrawer.classList.add("open");
  mobileDrawer.setAttribute("aria-hidden", "false");
}

function closeMobileMenu() {
  mobileDrawer.classList.remove("open");
  mobileDrawer.setAttribute("aria-hidden", "true");
}

menuBtn?.addEventListener("click", openMobileMenu);
mobileDrawer?.addEventListener("click", e => {
  if (e.target === mobileDrawer) closeMobileMenu();
});

// ── Drag & drop ───────────────────────────────────────────────
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => {
  uploadFiles([...e.target.files]);
  e.target.value = "";
});

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("over");
});
dropZone.addEventListener("dragleave", e => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove("over");
});
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("over");
  uploadFiles([...e.dataTransfer.files]);
});

// ── Helpers ───────────────────────────────────────────────────
function fmtSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024)        return bytes + " B";
  if (bytes < 1024 ** 2)   return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 ** 3)   return (bytes / 1024 ** 2).toFixed(1) + " MB";
  return (bytes / 1024 ** 3).toFixed(2) + " GB";
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let statusTimer;
function setStatus(msg) {
  statusEl.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusEl.textContent = ""; }, 3500);
}