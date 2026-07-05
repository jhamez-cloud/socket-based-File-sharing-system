# FileShare — Socket-Based File Sharing System

> **Group 4 · Lab Work Presentation**
> A lightweight, real-time file sharing system built with FastAPI and Socket.IO.

---

## Overview

FileShare allows multiple users on the same network to upload, browse, and download files through a browser interface. All connected clients stay in sync automatically — when one user uploads or deletes a file, every other open session updates instantly via WebSocket events.

**Key features**

- Drag-and-drop or click-to-browse file uploads
- Real-time sync across all connected clients using Socket.IO
- File filtering by type — Images, Documents, Videos
- Download and delete files directly from the browser

---

## Requirements

| Dependency | Version |
|---|---|
| Python | 3.10 or higher |
| pip | bundled with Python |
| A modern browser | Chrome, Firefox, Edge, Safari |

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repository_link>
cd <repository_folder>
```

### 2. Create a virtual environment

Using a virtual environment keeps project dependencies isolated from your system Python. This step is strongly recommended.

```bash
python -m venv venv
```

Activate the environment:

```bash
# macOS / Linux
source venv/bin/activate

# Windows (Command Prompt)
venv\Scripts\activate.bat

# Windows (PowerShell)
venv\Scripts\Activate.ps1
```

You should see `(venv)` prepended to your terminal prompt once active.

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the server

```bash
uvicorn server:socket_app --reload --port 8000
```

The `--reload` flag restarts the server automatically when source files change. Remove it in production.

The server will be available at `http://127.0.0.1:8000`.

### 5. Open the client

Open the following URL in your browser:

```
http://127.0.0.1:5500/public/index.html
```

> If you are using VS Code with the **Live Server** extension, right-click `public/index.html` and select **Open with Live Server** — it will open at the correct address automatically.

---

## Project Structure

```
project/
├── public/
│   ├── index.html      # Frontend UI
│   ├── styles.css      # Styling
│   └── app.js          # Client-side logic and socket events
├── server.py           # FastAPI server, Socket.IO, file registry
├── requirements.txt    # Python dependencies
└── README.md
```

---

## How It Works

The frontend and backend communicate over two channels:

- **HTTP** — used for file uploads (`POST /upload`), downloads (`GET /download/:id`), and deletes (`DELETE /files/:id`).
- **WebSocket (Socket.IO)** — used to broadcast real-time events (`file_uploaded`, `file_deleted`, `file_list`) to all connected clients so every browser stays in sync without refreshing.

See [the full technical writeup](docs/architecture.md) for a detailed breakdown.

---

## Troubleshooting

**Delete returns 405 Method Not Allowed**
The server is missing CORS middleware. Add the following to `server.py`:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Files not syncing across browsers**
Confirm both browsers are connecting to the same server address (`http://127.0.0.1:8000`). Check the browser console for WebSocket connection errors.

**`venv\Scripts\Activate.ps1` blocked on Windows**
Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in PowerShell, then try activating again.

---

## Authors

Group 4 — Lab Work Presentation