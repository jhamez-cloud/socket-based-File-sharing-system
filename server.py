import uuid
from pathlib import Path

import aiofiles
import socketio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# ── Setup ──────────────────────────────────────────────────────────
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# In-memory registry  {file_id: {name, size, content_type}}
file_registry: dict[str, dict] = {}

# Socket.IO server (async mode)
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # or ["http://localhost:3000"] etc.
    allow_methods=["*"],          # must include DELETE and OPTIONS
    allow_headers=["*"],
)

# Mount static files (the HTML client)
app.mount("/public", StaticFiles(directory="public"), name="public")

# Wrap FastAPI + Socket.IO into one ASGI app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


# ── Socket.IO events ───────────────────────────────────────────────
@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")
    # Send the current file list to the newly connected client
    await sio.emit("file_list", list(file_registry.values()), to=sid)


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


# ── REST: list files 
@app.get("/files")
async def list_files():
    return JSONResponse(list(file_registry.values()))


# ── REST: upload
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix
    save_path = UPLOAD_DIR / f"{file_id}{ext}"

    # Stream the upload to disk asynchronously
    async with aiofiles.open(save_path, "wb") as out:
        while chunk := await file.read(1024 * 64):   # 64 KB chunks
            await out.write(chunk)

    entry = {
        "id": file_id,
        "name": file.filename,
        "size": save_path.stat().st_size,
        "content_type": file.content_type or "application/octet-stream",
        "path": str(save_path),
    }
    file_registry[file_id] = entry

    # Broadcast to ALL connected clients
    await sio.emit("file_uploaded", entry)

    return JSONResponse({"ok": True, "file": entry})


# ── REST: download ─────────────────────────────────────────────────
@app.get("/download/{file_id}")
async def download_file(file_id: str):
    entry = file_registry.get(file_id)
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=entry["path"],
        filename=entry["name"],
        media_type=entry["content_type"],
    )


# ── REST: delete ───────────────────────────────────────────────────
@app.delete("/files/{file_id}")
async def delete_file(file_id: str):
    entry = file_registry.pop(file_id, None)
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")

    path = Path(entry["path"])
    if path.exists():
        path.unlink()

    # Notify all clients
    await sio.emit("file_deleted", {"id": file_id})
    return JSONResponse({"ok": True})