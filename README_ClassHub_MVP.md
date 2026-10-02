# ClassHub MVP

> **Offline-First Digital Hub for Connected Classrooms**

ClassHub is an offline-first classroom web application designed for colleges where Internet access or reliable campus Wi-Fi is unavailable.

The MVP turns a **laptop into a local classroom server**. Students connect to the same local Wi-Fi/hotspot and open the ClassHub website from their phones. Teachers can publish announcements and study materials without using the Internet, cloud storage, WhatsApp, Google Drive, or other external services.

---

## 1. MVP Goal

Build a simple, reliable demonstration of an **Internet-independent digital classroom**.

The MVP should demonstrate:

- Teacher-controlled announcements
- Local study-material sharing
- Student access through a mobile browser
- Local file storage on the laptop
- Student access/session management
- A queue when the configured number of active sessions is reached
- A 90-second resource-access session
- A 3-minute cooldown after a session
- Real-time session/queue status
- A teacher dashboard
- Offline operation

### Important

The MVP does **not** need NodeMCU, Arduino, cloud hosting, MongoDB, or Internet access.

NodeMCU can be added later as a hardware extension.

---

# 2. Problem

In many college classrooms, Internet connectivity may be unavailable, unreliable, expensive, or restricted.

Teachers may still need to distribute:

- Notes
- PDFs
- Assignments
- Timetables
- Notices
- Presentations
- Images
- Other academic resources

Students often depend on Internet-based services such as:

- WhatsApp
- Google Drive
- Email
- Cloud storage
- Learning-management platforms

If the Internet is unavailable, distributing these resources becomes difficult.

---

# 3. Proposed Solution

ClassHub creates a **private local classroom environment**.

The teacher runs ClassHub on a laptop.

Students connect to the same local Wi-Fi network and open the ClassHub website.

```text
                    NO INTERNET
                         |
                         v
                 +---------------+
                 |    LAPTOP     |
                 |               |
                 | ClassHub      |
                 | Web Server    |
                 | SQLite        |
                 | File Storage  |
                 +-------+-------+
                         |
                    Local Wi-Fi
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
      Student 1      Student 2      Student 3
          |              |              |
         ...            ...            ...
                         |
                    Student 70+
```

The laptop is responsible for the application and data.

The Wi-Fi network is only used to provide local connectivity.

There is **no requirement for Internet access**.

---

# 4. MVP Architecture

## Hardware

### Required

- 1 laptop
- Student smartphones

### Optional

- Local Wi-Fi router/access point

### Not required for MVP

- NodeMCU
- Arduino
- HC-05
- Sensors
- Internet connection
- Cloud server

---

# 5. Software Stack

Use a simple full-stack architecture.

### Backend

- Node.js
- Express.js

### Database

- SQLite

### Frontend

- HTML
- CSS
- Vanilla JavaScript

### File storage

Local `/uploads` directory on the laptop.

No cloud storage.

---

# 6. Offline Requirement

The application must work with Internet completely disconnected.

Do not depend on:

- Google Fonts
- CDN libraries
- Firebase
- MongoDB Atlas
- Supabase
- Cloudinary
- External APIs
- Online authentication
- External images

All required frontend resources must be stored locally.

---

# 7. Network Model

The ClassHub server must listen on all local interfaces.

Example:

```js
app.listen(PORT, '0.0.0.0');
```

Do NOT bind only to:

```text
localhost
```

The teacher's laptop may access:

```text
http://localhost:3000
```

Students should access the laptop's local IP, for example:

```text
http://192.168.137.1:3000
```

The actual IP must be detected/displayed rather than permanently hardcoded.

---

# 8. User Roles

There are two user types.

## Teacher

Teacher manages the classroom.

Teacher can:

- Login
- Create announcements
- Delete announcements
- Upload study materials
- Delete study materials
- View students
- View active sessions
- View queue
- View system statistics

## Student

Students can:

- Join ClassHub
- View announcements
- Browse study materials
- Search materials
- Request resource access
- Download permitted files
- See session status
- See queue position
- See cooldown timer

---

# 9. Teacher Dashboard

Create a professional teacher dashboard.

Display:

```text
CLASSHUB
Offline Classroom Server
```

### Statistics

```text
Active Students     6 / 8
Queue               4
Materials           27
Announcements       5
```

### System status

```text
Server: ONLINE
Network: LOCAL / OFFLINE
Internet: NOT REQUIRED
```

### Teacher actions

```text
+ Create Announcement
+ Upload Material
View Queue
View Active Sessions
View Materials
View Announcements
```

---

# 10. Student Dashboard

The student dashboard must be mobile-first.

Main sections:

1. Welcome
2. Announcements
3. Study Materials
4. Search
5. My Session
6. Queue Status

Example:

```text
Welcome, Nikhil

SESSION
ACTIVE

Time Remaining
01:17
```

or:

```text
WAITING

Queue Position
#4
```

or:

```text
COOLDOWN

Available again in
02:14
```

---

# 11. Student Joining

For the MVP, students enter:

```text
Student ID
Name
```

Example:

```text
Student ID:
MCA2026001

Name:
Rahul
```

The server generates a temporary session token.

Do not depend only on IP addresses.

Student identity should primarily use:

```text
Student ID
+
Session Token
```

The IP address can be recorded as supporting information.

---

# 12. Announcements

Teachers can create announcements.

Fields:

```text
Title
Message
```

Example:

```text
Title:
Assignment Submission

Message:
Submit Unit 1 assignment before 10 AM tomorrow.
```

Students see the newest announcements first.

Announcements are small pieces of information and should remain accessible without waiting for the large-resource access queue.

---

# 13. Study Materials

Teachers can upload academic files.

Supported formats:

```text
PDF
PPT
PPTX
DOC
DOCX
TXT
JPG
JPEG
PNG
ZIP
```

Store the actual files in:

```text
/uploads
```

Store only metadata in SQLite.

Example metadata:

```text
Title
Original filename
Stored filename
File size
Upload date
Uploaded by
```

Students can:

- Browse
- Search
- View metadata
- Request/download materials

---

# 14. Smart Access Algorithm

The main MVP feature is the **Smart Access Scheduler**.

The algorithm is designed to prevent too many students from simultaneously consuming limited local network/server resources.

### Configuration

```text
SESSION_DURATION = 90 seconds

COOLDOWN_DURATION = 180 seconds

MAX_ACTIVE_SESSIONS = 8
```

The default value of 8 is intended for testing with the laptop's current hotspot limitation.

The value must be configurable.

For example:

```env
MAX_ACTIVE_SESSIONS=8
SESSION_DURATION=90
COOLDOWN_DURATION=180
```

A higher-capacity local Wi-Fi access point can later be used without changing the core application.

---

# 15. Important Algorithm Rule

The 90-second session **must not disconnect the student's phone from Wi-Fi**.

The student remains connected to the local network.

The timer controls **ClassHub resource access**, especially large file downloads.

Small announcements and normal browsing should remain available.

---

# 16. Access Algorithm Flow

```text
Student requests resource access
            |
            v
       Identify student
            |
            v
   Does active session exist?
        /           \
      YES            NO
       |              |
       v              v
Return session    Check cooldown
                      |
              +-------+-------+
              |               |
          Cooldown active   Available
              |               |
              v               v
        Show timer       Check active
                              sessions
                                  |
                        +---------+---------+
                        |                   |
                 Capacity available     Capacity full
                        |                   |
                        v                   v
                 Create session       Add to queue
                        |                   |
                        v                   v
                  90-sec access      Show position
                        |
                        v
                 Session expires
                        |
                        v
                 Start cooldown
                        |
                        v
                Process next queue
```

---

# 17. Session Rules

When a student requests access:

### Rule 1 — Existing active session

If the student already has an active session:

Return the existing session.

Do not create another one.

---

### Rule 2 — Cooldown

If:

```text
current time < cooldown_until
```

show:

```text
Your previous access session has ended.

Please wait 02:13 before requesting another resource session.
```

---

### Rule 3 — Capacity available

If:

```text
active_sessions < MAX_ACTIVE_SESSIONS
```

create a new session.

Set:

```text
started_at = current time

expires_at = current time + 90 seconds
```

---

### Rule 4 — Capacity full

If:

```text
active_sessions >= MAX_ACTIVE_SESSIONS
```

add the student to the queue.

Show:

```text
All access slots are currently occupied.

You are #5 in the queue.
```

---

# 18. Session Expiration

The server should periodically check sessions.

For example:

```js
setInterval(() => {
    expireSessions();
    processQueue();
}, 5000);
```

When a session expires:

1. Mark it expired.
2. Remove it from active sessions.
3. Set cooldown.
4. Find the next eligible student.
5. Create a session for that student.
6. Update the queue.

---

# 19. Cooldown

After the 90-second session:

```text
Cooldown = 180 seconds
```

During cooldown:

- Student remains connected to Wi-Fi.
- Student can still see basic announcements.
- Student cannot immediately consume another controlled resource session.

Display a countdown.

Example:

```text
COOLDOWN

You can request another resource session in:

02:41
```

---

# 20. Queue

Use FIFO ordering by default.

FIFO means:

```text
First student to request
        |
        v
First student served
```

Example:

```text
ACTIVE
Student 01
Student 02
Student 03
Student 04
Student 05
Student 06
Student 07
Student 08

QUEUE
#1 Student 09
#2 Student 10
#3 Student 11
#4 Student 12
```

When Student 03's session expires:

```text
Student 09
```

should receive the next available slot.

---

# 21. Avoid IP-only Tracking

Do NOT implement:

```text
IP = Student
```

as the main identity system.

Multiple devices can potentially share an IP address.

Use:

```text
student_id
session_token
```

as the primary identity.

Store:

```text
IP address
```

only for logging/session information.

---

# 22. Database

Use SQLite.

Suggested tables:

## students

```text
id
student_id
name
created_at
last_seen
```

## announcements

```text
id
title
content
created_at
created_by
```

## materials

```text
id
title
filename
original_name
file_size
uploaded_at
uploaded_by
```

## sessions

```text
id
student_id
session_token
ip_address
started_at
expires_at
cooldown_until
status
```

## access_queue

```text
id
student_id
requested_at
status
granted_at
```

---

# 23. Teacher Authentication

For the MVP use simple local authentication.

Default development credentials:

```text
Username:
admin

Password:
admin123
```

Make them configurable through environment variables.

Example:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

Do not hardcode production credentials into frontend code.

Use:

- Password hashing
- HTTP-only session cookies
- Teacher authorization middleware

---

# 24. Security

Implement basic local-network security.

Required:

- Password hashing
- HTTP-only cookies
- Input validation
- File type validation
- File-size limits
- Filename sanitization
- Path traversal protection
- Teacher-only upload/delete routes
- Student authorization
- Basic API rate limiting

The project is intended for a controlled local classroom network.

---

# 25. File Structure

Recommended structure:

```text
classhub/
│
├── server.js
├── package.json
├── .env
├── .env.example
├── README.md
│
├── database/
│   └── classhub.db
│
├── uploads/
│
├── middleware/
│   └── auth.js
│
├── routes/
│   ├── auth.js
│   ├── student.js
│   ├── teacher.js
│   ├── materials.js
│   └── announcements.js
│
├── services/
│   └── accessScheduler.js
│
└── public/
    ├── index.html
    ├── student.html
    ├── teacher.html
    │
    ├── css/
    │   └── style.css
    │
    └── js/
        ├── student.js
        └── teacher.js
```

The exact structure can be changed if there is a good technical reason.

---

# 26. Landing Page

Create a clean landing page.

Display:

```text
CLASSHUB

Offline-First Digital Hub
for Connected Classrooms

No Internet.
No Cloud.
Just your classroom.
```

Buttons:

```text
Teacher Login
Join as Student
```

System status:

```text
● Local Server Online
```

Instructions:

```text
1. Connect to the classroom Wi-Fi.
2. Open the ClassHub address.
3. Join your classroom.
```

---

# 27. UI/UX Requirements

The application should look like a real modern college product.

Design goals:

- Clean
- Professional
- Minimal
- Mobile-first
- Responsive
- Good typography
- Clear visual hierarchy
- Rounded cards
- Subtle animations
- Accessible contrast
- No unnecessary visual effects

Avoid:

- Excessive gradients
- 3D effects
- Overly complicated animations
- Fake statistics
- Internet/cloud branding

---

# 28. Demo Simulation

The MVP should include a demo/simulation feature.

Teacher can click:

```text
SIMULATE STUDENTS
```

Generate:

```text
Student 01
Student 02
...
Student 20
```

The dashboard should then demonstrate:

```text
Active:
8 / 8

Queue:
12


The simulation should use the same scheduler as real students.

Clearly label it:

```text
DEMO / SIMULATION
```

Never present simulated students as real connected users.

---

# 29. Demonstration Flow

The final MVP should support this demonstration:

### Step 1

Start the server.

```bash
npm install
npm start
```

### Step 2

Turn off Internet.

### Step 3

Start the laptop's local hotspot or connect the laptop and phones to a local Wi-Fi access point.

### Step 4

Open:

```text
http://localhost:3000
```

Teacher opens the teacher dashboard.

### Step 5

Teacher uploads:

```text
Notes.pdf
Assignment.pdf
Timetable.pdf
```

### Step 6

Teacher creates an announcement.

### Step 7

Students connect from phones.

### Step 8

Students enter Student ID and name.

### Step 9

The first 8 controlled sessions become active.

### Step 10

Additional students enter the queue.

### Step 11

A 90-second countdown begins.

### Step 12

After expiration, the student enters a 180-second cooldown.

### Step 13

The next queued student gets access.

### Step 14

Teacher dashboard updates the statistics.

---

# 30. MVP Limitations

The MVP intentionally has limitations.

### Current limitations

- Laptop hotspot may have a limited number of connected devices.
- Wi-Fi capacity depends on the access point/hardware.
- The application does not create a 70-user Wi-Fi network by itself.
- The 90-second algorithm controls application resource access, not physical Wi-Fi connectivity.
- No Internet synchronization.
- No distributed mesh networking.
- No NodeMCU integration.

These are acceptable MVP limitations.

---

# 31. Future Roadmap

## Phase 1 — MVP

Laptop-based ClassHub.

```text
Laptop
+
Local Wi-Fi
+
Web application
```

---

## Phase 2 — Larger Classroom

Use a higher-capacity local Wi-Fi access point/router.

```text
Laptop Server
      |
Local Wi-Fi AP
      |
70+ Students
```

No Internet required.

---

## Phase 3 — NodeMCU Integration

Add NodeMCU as a classroom hardware gateway.

Potential uses:

- Classroom identification
- Server status indicator
- Hardware status
- Room presence/status
- Physical access indicator
- Future IoT features

---

## Phase 4 — Multiple Classrooms

Multiple ClassHub servers/gateways.

```text
Classroom A
ClassHub

Classroom B
ClassHub

Classroom C
ClassHub
```

---

## Phase 5 — Offline Synchronization

When Internet becomes available:

```text
Local ClassHub
      |
      v
Optional Sync
      |
      v
Central Server
```

The core classroom functionality must continue working without Internet.

---

## Phase 6 — Distributed Relay Architecture

Future versions may use multiple gateway/relay nodes to extend local coverage and distribute network load.

This should not be claimed as part of the current MVP.

---

# 32. Product Positioning

ClassHub should be presented as:

> **A teacher-controlled, offline-first digital classroom hub that enables academic resource sharing and announcements over a private local network without requiring Internet connectivity.**

Do NOT claim:

> "One laptop can connect 70 students."

Do NOT claim:

> "NodeMCU can connect 70 students."

Do NOT claim:

> "The application creates unlimited Wi-Fi connections."

Instead:

> **"The application is network-independent and can operate over any suitable private local network. Its resource scheduler helps manage limited network/server capacity."**

---

# 33. Core MVP Success Criteria

The MVP is successful if:

- The server runs entirely locally.
- The application works with Internet disconnected.
- Teacher can log in.
- Teacher can upload materials.
- Teacher can create announcements.
- Students can join.
- Students can view announcements.
- Students can see materials.
- Controlled downloads work.
- The 90-second session works.
- The 180-second cooldown works.
- Queue ordering works.
- Session expiration works.
- Next queued student is automatically served.
- Teacher dashboard updates.
- Mobile UI works.
- Demo simulation works.
- No external Internet resources are required.

---

# 34. Final MVP Concept

```text
             CLASSHUB
                 |
        Offline Classroom
                 |
        +--------+--------+
        |                 |
     TEACHER           STUDENT
        |                 |
   Dashboard          Mobile UI
        |                 |
        +--------+--------+
                 |
            Local Server
                 |
          SQLite + Files
                 |
        Access Scheduler
                 |
        +--------+--------+
        |                 |
   Active Sessions       Queue
        |                 |
     90 seconds       FIFO waiting
        |                 |
     Cooldown         Next student
        |                 |
        +--------+--------+
                 |
            No Internet
```

**ClassHub MVP = Laptop + Local Network + Web Application + Smart Access Scheduler.**

NodeMCU, mesh networking, multiple gateways, and cloud synchronization are future extensions, not requirements for this MVP.
