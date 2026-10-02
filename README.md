# ClassHub

**Offline-First Digital Hub for Connected Classrooms**

ClassHub has two parts: a public informational website and a classroom application. The classroom application can run on a private local network without the public website or Internet access.

## Project overview

ClassHub is a teacher-controlled local hub for announcements and academic file sharing. It is designed for classrooms where Internet connectivity may be unreliable, unavailable or restricted.

## Problem and solution

Teachers often rely on online messaging, cloud storage or learning platforms to distribute class materials. ClassHub puts the application, SQLite database and uploaded files on a teacher laptop or local server so students on the same local network can access classroom resources without Internet service.

## Features

- Teacher login and responsive management dashboard
- Student join using student ID and name, with server-generated session token
- Teacher announcements and locally stored class materials
- Material search and controlled downloads
- Server-authoritative resource sessions, FIFO queue, countdown and cooldown
- Teacher-only demo simulation using the real scheduler
- Public pages for product information, developer links, privacy and terms
- Local assets; no CDN, remote fonts, analytics or cloud API dependency

## Architecture

- Node.js 22.5 or newer (`node:sqlite` is used)
- Express.js and vanilla HTML, CSS and JavaScript
- SQLite database configured with `DATABASE_PATH`
- Uploaded files stored under `UPLOAD_DIR`
- Web login sessions persisted in the same SQLite database
- The server binds to `0.0.0.0` for local network clients

## Local development

1. Install Node.js 22.5 or newer.
2. Copy `.env.example` to `.env` and edit as needed.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

Development defaults are teacher username `admin` and password `admin123`. Change them before sharing a reachable instance. The teacher dashboard displays a detected LAN address when available.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Use `production` for a public deployment. |
| `PORT` | HTTP port; defaults to `3000`. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Teacher credentials; required in production and compared against a startup password hash. |
| `SESSION_SECRET` | Signs HTTP-only session cookies; required in production and must be at least 32 characters. |
| `DATABASE_PATH` | SQLite file path; defaults to `./database/classhub.db`. |
| `UPLOAD_DIR` | Upload directory; defaults to `./uploads`. |
| `MAX_ACTIVE_SESSIONS` | Resource session capacity; defaults to `8`. |
| `SESSION_DURATION` | Resource session duration in seconds; defaults to `90`. |
| `COOLDOWN_DURATION` | Cooldown in seconds; defaults to `180`. |
| `MAX_UPLOAD_MB` | Upload size limit in megabytes; defaults to `25`. |
| `CLASSROOM_ENABLED` | Set `false` to disable teacher/student routes for an informational-only public showcase. |
| `TRUST_PROXY` | Set `1` only when deployed behind a trusted TLS-terminating reverse proxy. |
| `PUBLIC_BASE_URL` | Optional canonical HTTPS origin used in `robots.txt` and `sitemap.xml`. |

## Production configuration

Set `NODE_ENV=production`, a non-default `ADMIN_USERNAME`, a strong `ADMIN_PASSWORD`, and a random `SESSION_SECRET` of at least 32 characters. The server refuses production startup when these values are missing or use the development login. Production cookies are HTTP-only, SameSite=Lax, and Secure. If TLS terminates at a trusted reverse proxy, configure `TRUST_PROXY=1` so Express recognizes HTTPS requests.

Set `DATABASE_PATH` and `UPLOAD_DIR` to writable persistent disk paths. ClassHub creates their parent directories at startup. Keep those paths backed up and restrict host-level access. `npm start` runs the production server; no build step is required.

## Deployment instructions

### Local classroom deployment

1. Run ClassHub on a teacher laptop or local server.
2. Connect it and student devices to a private local Wi-Fi network.
3. Internet access is not required for classroom operation.
4. Use a suitable local Wi-Fi access point for the expected room capacity.
5. Students open the laptop/server’s local ClassHub address.

The public informational website is not required for this flow. The application does not create Wi-Fi capacity or guarantee a device count; network capacity depends on the local hardware.

### Public website deployment

Deploy to a Node-compatible host that supports Node.js 22.5 or newer and persistent writable storage. Configure production secrets and HTTPS. If the host is only for a public project showcase, set `CLASSROOM_ENABLED=false` to disable classroom routes. If classroom functionality is intentionally exposed, keep it protected with strong production credentials and deploy only in a suitable trusted environment. Do not expose a classroom teacher dashboard publicly with development credentials.

## Database persistence

SQLite is appropriate for a first single-instance deployment. Keep the database file on persistent disk. Do not run multiple application replicas against an ordinary local SQLite file; use one application instance or a separately designed shared database before scaling out. Back up the database while preserving a consistent SQLite snapshot.

## File storage limitations

Uploaded materials live on the local filesystem in `UPLOAD_DIR`; SQLite stores their metadata. Many free or container hosting plans use ephemeral filesystems. On those platforms, a redeploy, restart or instance replacement can erase the SQLite database and uploaded materials. ClassHub does not silently synchronize files to cloud storage. Persistent disk is required for durable production data.

## Security

- Teacher password is hashed at startup and never sent to browser code.
- Production requires explicit credentials and a long session secret.
- Session cookies are HTTP-only and secure in production.
- Teacher APIs require teacher authentication; student APIs require a student session token.
- Uploads are type-checked by extension, size-limited, and stored under generated filenames.
- Download paths are resolved and checked against the upload directory.
- Errors returned to clients do not include stack traces, filesystem paths or database details.
- Keep the host, database and upload directories protected; the app is not a substitute for host/network security.

## Network requirements

For local classroom use, the server and student devices need connectivity to the same private LAN. The laptop or server must allow inbound connections on the configured port in its firewall. ClassHub does not require an Internet connection for its classroom features and does not provide wireless access point functionality.

## Current limitations

- Capacity is limited by the local server and network hardware.
- Session scheduling controls application-level resource access, not Wi-Fi connectivity.
- SQLite and local file storage suit a single instance; multi-instance deployment is not configured.
- Public deployment requires persistent storage for durable database and file data.
- The project does not include cloud synchronization, mesh networking or classroom hardware integrations.

## Future roadmap

Potential future work includes higher-capacity access point deployments, multi-classroom support and optional synchronization. Those are not current MVP capabilities.

## Developer

**Nikhil Singh** · **nikhil.zip**

Nikhil Singh is an MCA student and full-stack developer interested in building practical software solutions for real-world problems. ClassHub was developed as an exploration of how offline-first technology can improve access to essential classroom resources when Internet connectivity is unreliable.

- Portfolio: https://nikhil-index.netlify.app/
- GitHub: https://github.com/nikhil-zip
- LinkedIn: https://www.linkedin.com/in/nikhil-zip/
- Email: [nikhilsingh.zip@gmail.com](mailto:nikhilsingh.zip@gmail.com)
