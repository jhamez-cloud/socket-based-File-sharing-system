const socket = io("http://localhost:8000");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");
const status = document.getElementById("status");

let files = {};  // local mirror of registry

// ── Socket events ─────────────────────────────────────────────
socket.on("file_list", (list) => {
  files = {};
  list.forEach(f => files[f.id] = f);
  render();
});

socket.on("file_uploaded", (f) => {
  files[f.id] = f;
  render();
  setStatus(`"${f.name}" was uploaded`);
});

socket.on("file_deleted", ({ id }) => {
  const name = files[id]?.name;
  delete files[id];
  render();
  if (name) setStatus(`"${name}" was removed`);
});

// ── Upload ────────────────────────────────────────────────────
async function uploadFiles(fileArr) {
  for (const file of fileArr) {
    const form = new FormData();
    form.append("file", file);
    setStatus(`Uploading "${file.name}"…`);
    try {
      const res = await fetch("http://localhost:8000/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      setStatus(`"${file.name}" uploaded`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }
}

// ── Delete ────────────────────────────────────────────────────
async function deleteFile(id) {
  await fetch(`http://localhost:8000/files/${id}`, { method: "DELETE" });
}

// ── Render file list ──────────────────────────────────────────
function render() {
  fileList.innerHTML = "";
  const entries = Object.values(files);
  if (!entries.length) {
    fileList.innerHTML = '<p style="color:#aaa;font-size:13px;margin-top:8px">No files yet.</p>';
    return;
  }
  entries.forEach(f => {
    const row = document.createElement("div");
    row.className = "file-row";
    row.innerHTML = `
      <span class="file-name">${f.name}</span>
      <span class="file-size">${fmtSize(f.size)}</span>
      <a href="http://localhost:8000/download/${f.id}" download="${f.name}">
        <button class="btn-dl">Download</button>
      </a>
      <button class="btn-del" onclick="deleteFile('${f.id}')">Delete</button>
    `;
    fileList.appendChild(row);
  });
}

// ── Helpers ───────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 ** 2).toFixed(1) + " MB";
}

function setStatus(msg) {
  status.textContent = msg;
  setTimeout(() => status.textContent = "", 3000);
}

// ── Drag & drop ───────────────────────────────────────────────
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => uploadFiles([...e.target.files]));

dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("over");
  uploadFiles([...e.dataTransfer.files]);
});