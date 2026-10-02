# ClassHub MVP

Offline-first digital hub for connected classrooms. A laptop hosts the site, SQLite database, and files; students use it over the same private Wi-Fi network. Internet is not required.

## Run locally

1. Install Node.js 22.5 or newer (ClassHub uses Node's built-in SQLite module).
2. Copy `.env.example` to `.env` and adjust settings if needed.
3. Run `npm install`, then `npm start`.
4. Open `http://localhost:3000`. For phones, use the LAN address shown in the teacher dashboard.

Default development teacher credentials are `admin` / `admin123`. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env` for your environment. The server binds to `0.0.0.0` so devices on the local network can connect.

## Settings

`MAX_ACTIVE_SESSIONS` defaults to 8, `SESSION_DURATION` to 90 seconds, `COOLDOWN_DURATION` to 180 seconds, and `MAX_UPLOAD_MB` to 25. SQLite data is stored under `database/`; uploaded files are under `uploads/`.

Announcements and browsing remain available during cooldown. A student needs an active resource session to download materials. The scheduler expires sessions on the server and promotes eligible queued students in FIFO order. Teacher simulation adds 20 clearly marked demo students through the same scheduler.

ClassHub manages app and resource access; it does not create Wi-Fi capacity or disconnect devices from Wi-Fi.
