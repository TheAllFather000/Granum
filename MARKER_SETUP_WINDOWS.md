# Marker Setup (Windows) - Granum Project

This guide explains exactly how to run this project on a clean Windows 10/11 machine from a ZIP file.

---

## 1) Download and extract the ZIP

1. Download the project ZIP.
2. Right-click the ZIP -> **Extract All...**
3. Extract to a simple path, for example:
   - `C:\Projects\Granum`
4. Open the extracted folder.

Tip: avoid very long/deep folder paths because they can cause Windows path issues.

---

## 2) Install required software

You only need these tools:

1. **Docker Desktop for Windows**
   - Install from: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
   - During first launch, allow any required setup/restart.
2. **VS Code** (recommended)
   - Install from: [https://code.visualstudio.com/](https://code.visualstudio.com/)
3. **Live Server extension** in VS Code (recommended for frontend)
   - Extension name: `Live Server` by Ritwick Dey

You do **not** need to install PostgreSQL or Redis manually when using Docker.
You do **not** need to install Node.js manually for Docker-based backend execution.

Important after Docker install:
- Open Docker Desktop once and wait until it shows Docker is running.

### Do you need Docker command line tools too?

Yes, this guide uses terminal commands like `docker compose up -d`.

On Windows, if Docker Desktop is installed correctly, the command line tools are included automatically:
- `docker` (CLI)
- `docker compose` (Compose v2 plugin)

No separate Docker CLI installer is normally required.

Quick check in PowerShell:

```powershell
docker --version
docker compose version
```

If both commands return versions, they are ready.

If `docker compose` is not recognized:
1. Make sure Docker Desktop is fully installed and running.
2. Restart PowerShell/VS Code.
3. In Docker Desktop settings, ensure Docker CLI integration is enabled.
4. As a fallback, reinstall Docker Desktop from official installer.

---

## 3) Open the project in VS Code

1. Open VS Code.
2. Click **File -> Open Folder...**
3. Select the extracted project folder (the one containing `granum-backend` and `linkhive-frontend`).

Use **PowerShell** in VS Code terminal for all commands below.

---

## 4) Start backend services (Docker)

1. Open a terminal in VS Code (**Terminal -> New Terminal**).
2. Create/reset `.env` from template (recommended for marking consistency):

```powershell
Copy-Item .\granum-backend\granum\.env.example .\granum-backend\granum\.env -Force
```

3. Run:

```powershell
cd granum-backend/granum
docker compose up -d --build
```

4. Verify containers are running:

```powershell
docker compose ps
```

Expected: `db`, `redis`, and `api` should be up (or starting).

These are the 3 containers used by this project:
- `granum_db` (PostgreSQL)
- `granum_redis` (Redis)
- `granum_api` (Node API)

### Run using Docker Desktop (GUI)

If marker prefers GUI instead of terminal:

1. Open **Docker Desktop**.
2. Go to **Containers** tab.
3. If no containers appear yet, first run once in terminal:

```powershell
cd granum-backend/granum
docker compose up -d
```

4. In Docker Desktop, look for a compose app/folder containing:
   - `granum_db`
   - `granum_redis`
   - `granum_api`
5. Click **Start** on the app (or start each container).
6. Wait until all 3 show **Running** (green status).
7. To stop later, click **Stop** on the app (or each container).

### Docker Desktop visual guide (add screenshots before submission)

Add screenshots to your ZIP (for example in `docs/screenshots/`) and rename the placeholders below:

1. **Docker home screen running**
   - Placeholder: `docs/screenshots/01-docker-running.png`
   - Show: Docker Desktop open with engine status "running".

2. **Containers tab with project stack**
   - Placeholder: `docs/screenshots/02-containers-stack.png`
   - Show: compose stack containing `granum_db`, `granum_redis`, `granum_api`.

3. **All three containers green**
   - Placeholder: `docs/screenshots/03-all-running.png`
   - Show: all services in running state.

4. **Optional: logs screen**
   - Placeholder: `docs/screenshots/04-api-logs.png`
   - Show: API logs panel in Docker Desktop.

If screenshots are included, place them under this heading in the final submission document.

---

## 5) Restore database snapshot (same tables + data)

If `marker_dump.sql` is included in the project root, restore with:

```powershell
cd ../..
docker compose -f granum-backend/granum/docker-compose.yml exec -T db psql -U linkhive -d linkhive < marker_dump.sql
```

If your dump file is inside `granum-backend/granum`, run instead:

```powershell
cd granum-backend/granum
docker compose exec -T db psql -U linkhive -d linkhive < marker_dump.sql
```

After restore, DB schema + records should match the submitted environment.

Note:
- This submission includes `marker_dump.sql` at project root.

---

## 6) Run frontend

### Option A (recommended): Live Server

1. In VS Code Explorer, open `linkhive-frontend`.
2. Right-click `granum-home.html` (or any main page).
3. Click **Open with Live Server**.
4. Browser should open on something like:
   - `http://127.0.0.1:5500/...`

### Option B: Python static server (if preferred)

```powershell
cd linkhive-frontend
python -m http.server 5500
```

Then open `http://localhost:5500`.

---

## 7) Confirm backend connectivity quickly

Run these checks in terminal:

```powershell
curl "http://localhost:3000/fsm/rescue/offers?status=active"
curl "http://localhost:3000/fsm/rescue/requests?status=active"
```

Expected: JSON response (even if empty arrays).

If `curl` is unavailable in your shell, use browser:
- [http://localhost:3000/fsm/rescue/offers?status=active](http://localhost:3000/fsm/rescue/offers?status=active)
- [http://localhost:3000/fsm/rescue/requests?status=active](http://localhost:3000/fsm/rescue/requests?status=active)

---

## 8) Notes about packages/dependencies

- Docker builds/install backend dependencies automatically from `package.json`.
- Marker does not need to manually run `npm install` for backend when using Docker.
- Frontend is static HTML/CSS/JS and does not require npm install.

---

## 9) Troubleshooting

### A) Port already in use

If ports 3000/5432/6379 are occupied:

```powershell
cd granum-backend/granum
docker compose down
docker compose up -d
```

If still blocked, close other local services using those ports, then retry.

### B) API not responding

```powershell
cd granum-backend/granum
docker compose logs api
```

### C) Database restore fails

Ensure DB container is up first:

```powershell
cd granum-backend/granum
docker compose ps
```

Then rerun restore command.

If PowerShell redirection (`< marker_dump.sql`) gives issues, use:

```powershell
Get-Content .\marker_dump.sql | docker compose -f granum-backend/granum/docker-compose.yml exec -T db psql -U linkhive -d linkhive
```

### D) Frontend opens but data is missing

- Confirm backend responses on `localhost:3000` (Step 7).
- Hard refresh browser (`Ctrl + F5`).
- Ensure `linkhive-frontend/config.js` points to `http://localhost:3000`.

---

## 10) Shutdown when done

```powershell
cd granum-backend/granum
docker compose down
```

---

## 11) Quick run checklist

1. Extract ZIP
2. Install Docker Desktop
3. `cd granum-backend/granum`
4. `docker compose up -d --build`
5. Restore `marker_dump.sql`
6. Open `linkhive-frontend` with Live Server
7. Test pages in browser

