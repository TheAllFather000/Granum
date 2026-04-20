# Linkhive API

B2B township grocery marketplace backend — Node.js + Express + PostgreSQL + Redis + Twilio.

---

## Stack

| Layer       | Technology              |
|-------------|-------------------------|
| Runtime     | Node.js 20              |
| Framework   | Express 4               |
| Database    | PostgreSQL 16 (Docker)  |
| Cache / OTP | Redis 7 (Docker)        |
| SMS         | Twilio                  |
| Auth        | JWT + OTP               |
| Container   | Docker Compose          |

---

## Quick start

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Node.js 20+ (only needed if you want to run outside Docker)

### 2. Clone and configure

```bash
# copy the env template
cp .env.example .env
```

Open `.env` and fill in:
- `JWT_SECRET` — any long random string (32+ chars)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — from [twilio.com](https://twilio.com) (free trial works fine)
- Leave DB/Redis values as-is for local dev

### 3. Start everything

```bash
docker compose up --build
```

That's it. Docker will:
1. Start PostgreSQL and wait for it to be healthy
2. Start Redis
3. Run the database migration (`init.sql`)
4. Start the API with hot-reload

### 4. Verify it's working

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "linkhive-api",
  "db": "connected"
}
```

---

## Development (without Docker)

```bash
# install dependencies
npm install

# make sure Postgres and Redis are running locally, then:
npm run dev
```

The API will hot-reload on file changes via nodemon.

---

## API Reference

Base URL: `http://localhost:3000`

### Auth

| Method | Endpoint            | Auth     | Description                        |
|--------|---------------------|----------|------------------------------------|
| POST   | /auth/otp/request   | —        | Send OTP to phone                  |
| POST   | /auth/register      | —        | Register with OTP verification     |
| POST   | /auth/login         | —        | Login via OTP or password          |
| POST   | /auth/refresh       | —        | Rotate refresh token               |
| POST   | /auth/logout        | Bearer   | Revoke all tokens                  |
| GET    | /auth/me            | Bearer   | Get current user + profile         |

### Profiles

| Method | Endpoint                      | Auth     | Description            |
|--------|-------------------------------|----------|------------------------|
| GET    | /api/profiles                 | Optional | List profiles          |
| GET    | /api/profiles/:id             | Optional | Get single profile     |
| PATCH  | /api/profiles/me              | Bearer   | Update own profile     |

### Products

| Method | Endpoint          | Auth     | Description             |
|--------|-------------------|----------|-------------------------|
| GET    | /api/products     | Optional | List products           |
| POST   | /api/products     | Bearer   | Create product          |
| PATCH  | /api/products/:id | Bearer   | Update product          |
| DELETE | /api/products/:id | Bearer   | Delete product          |

### Orders

| Method | Endpoint      | Auth   | Description              |
|--------|---------------|--------|--------------------------|
| POST   | /api/orders   | Bearer | Place an order           |
| GET    | /api/orders   | Bearer | Get my order history     |

### Vouchers

| Method | Endpoint             | Auth   | Description              |
|--------|----------------------|--------|--------------------------|
| POST   | /api/vouchers        | Bearer | Buy and send a voucher   |
| GET    | /api/vouchers/:code  | —      | Check voucher balance    |

### Reviews

| Method | Endpoint                      | Auth   | Description         |
|--------|-------------------------------|--------|---------------------|
| POST   | /api/profiles/:id/reviews     | Bearer | Submit a review     |
| GET    | /api/profiles/:id/reviews     | —      | Get reviews         |

---

## Authentication flow

### OTP registration (new user)

```
1. POST /auth/otp/request  { phone, purpose: "register" }
   → OTP sent via SMS (logged to console in dev mode)

2. POST /auth/register     { phone, otp, role, first_name, last_name }
   → Returns { user, tokens: { accessToken, refreshToken } }
```

### OTP login (returning user)

```
1. POST /auth/otp/request  { phone, purpose: "login" }

2. POST /auth/login        { phone, otp }
   → Returns { user, tokens }
```

### Password login (if password was set)

```
POST /auth/login  { phone, password }
→ Returns { user, tokens }
```

### Using tokens

```
Authorization: Bearer <accessToken>
```

Access tokens expire in 7 days. Refresh before expiry:

```
POST /auth/refresh  { refresh_token: "<refreshToken>" }
→ Returns new { tokens }
```

---

## Dev tips

- **No Twilio?** In development mode the OTP is printed to the Docker/terminal console. You don't need real Twilio credentials to develop locally.
- **Inspect the DB:** Connect with any Postgres client (TablePlus, DBeaver, psql) at `localhost:5432`, database `linkhive`, user `linkhive`, password `linkhive_secret`
- **Inspect Redis:** `redis-cli -a redis_secret` or use RedisInsight

---

## Project structure

```
linkhive/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── .env.example
├── .gitignore
├── migrations/
│   └── init.sql            ← full database schema
└── src/
    ├── app.js              ← Express entry point
    ├── config/
    │   ├── db.js           ← PostgreSQL pool
    │   └── redis.js        ← Redis client
    ├── controllers/
    │   └── auth.controller.js
    ├── middleware/
    │   ├── auth.middleware.js
    │   ├── validate.middleware.js
    │   └── error.middleware.js
    ├── routes/
    │   ├── auth.routes.js
    │   └── api.routes.js
    ├── services/
    │   ├── auth.service.js ← JWT + refresh tokens
    │   ├── otp.service.js  ← OTP generate / verify
    │   └── sms.service.js  ← Twilio wrapper
    └── scripts/
        └── migrate.js      ← runs init.sql on startup
```
