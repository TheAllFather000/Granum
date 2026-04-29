# Granum - B2B Township Marketplace

Spaza shop owners connecting with farmers and manufacturers in South Africa.

---

## Stack

| Layer     | Technology           |
|-----------|----------------------|
| Backend   | Node.js + Express    |
| Database  | PostgreSQL (Docker)  |
| Cache/OTP | Redis (Docker)       |
| SMS       | Textbee (Android)   |
| Auth      | JWT + OTP            |
| Frontend | Vanilla HTML/JS     |

---

## Run Locally (Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 1. Start Backend

```bash
cd granum-backend/granum
docker compose up -d
```

### 2. Start Frontend

Open frontend folder in VS Code, use Live Server extension, or:

```bash
# If you have Python installed
cd linkhive-frontend
python -m http.server 5500
```

Then open http://localhost:5500 in your browser.

---

## Quick Test - No Docker Needed

If you only want to test the frontend static pages:

```bash
cd linkhive-frontend
python -m http.server 5500
```

Note: Dynamic features (login, profile, orders) won't work without the API running.

---

## Database

The schema is in `granum-backend/granum/migrations/init.sql`.

Products are seeded automatically if the database is empty.

### View Products via API

```bash
curl http://localhost:3000/fsm/products
```

---

## Project Structure

```
├── granum-backend/granum/     # Backend (Node.js + Express)
│   ├── docker-compose.yml
│   ├── src/
│   │   ├── app.js
│   │   ├── config/db.js
│   │   ├── routes/api.routes.js
│   │   └── services/
│   └── migrations/init.sql
│
├── linkhive-frontend/        # Frontend (Vanilla HTML/CSS/JS)
│   ├── granum-home.html
│   ├── granum-shop.html
│   ├── granum-auth.html
│   ├── granum-profile.html
│   └── granum-*.html
│
└── README.md
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /fsm/profiles | List shops/farmers |
| GET /fsm/products | List products |
| POST /auth/otp/request | Send OTP |
| POST /auth/register | Register |
| POST /auth/login | Login |
| GET /fsm/orders | My orders |

Full API docs in backend source code comments.

---

## Development

To update the backend:

```bash
cd granum-backend/granum
docker compose restart api  # Restart after code changes
```

To update frontend, just refresh the browser - no restart needed.

---

## Troubleshooting

**Port already in use:**
```bash
docker compose down
docker compose up -d
```

**Database connection error:**
```bash
docker compose logs api
```

**Clear local storage in browser:** Dev Tools → Application → Local Storage → Clear

---

## Marker Submission Files

For fresh Windows setup instructions, see:

- `../../MARKER_SETUP_WINDOWS.md`

For database snapshot used during marking, see:

- `../../marker_dump.sql`