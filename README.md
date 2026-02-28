(The file `/Users/pro/Downloads/concrete_factory/README.md` exists, but is empty)
# Concrete Factory — Local demo

Этот репозиторий содержит статический сайт (`/frontend`) и минимальный Node.js сервер (`/server`).
Сервер нужен для приёма заявок/заказов и отправки писем (через HTTPS Email API — Resend).

**Project layout**
- `frontend/` — static frontend (HTML, CSS, JS). Open at `/` when server runs.
- `assets/` — shared assets (price JSON, documents, fonts, icons).
- `server/` — minimal Express server that serves `frontend/` and accepts `/api/order` requests.
- `server/server.js` — server entrypoint.
- `server/package.json` — server dependencies and start script.
- `server/.env` — optional (not checked into repo) email and runtime settings.
- `.env` (repo root) — also supported; `server/.env` has priority if both exist.
- `prices.json` — example prices (exported from admin panel)

**Quick start (development)**

1. Install server dependencies:

```bash
cd /Users/pro/Downloads/concrete_factory/server
npm install
```

2. Create and edit `server/.env` (copy from `server/.env.example`). Example contents:

```text
# server/.env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_********************************
TO_EMAIL=sales@example.com
# For quick tests you can use Resend sandbox sender:
FROM_EMAIL=onboarding@resend.dev
FROM_NAME="Бетонный завод"
PORT=3002

# Admin panel auth (required for editing prices)
ADMIN_PASSWORD=ChangeMe_To_A_VeryStrong_Password_123!
```

Notes:
- Email is sent via HTTPS Email API (Resend). This avoids SMTP port blocking.
- For a custom `FROM_EMAIL` you must verify your domain in Resend.
- Admin password must be strong (16+ chars with upper/lower/digit/symbol). Avoid weak defaults.
- You can use `ADMIN_PASSWORD_HASH` (PBKDF2) instead of plaintext password.

Generate `ADMIN_PASSWORD_HASH` (optional):

```bash
node -e "const c=require('crypto');const p=process.argv[1];const i=210000;const s=c.randomBytes(16);const h=c.pbkdf2Sync(p,s,i,64,'sha512');console.log(`pbkdf2$${i}$${s.toString('hex')}$${h.toString('hex')}`)" 'YourVeryStrongPasswordHere'
```

3. Run the server:

```bash
node server/server.js
```

4. Open the site in your browser (do not open files with `file://`):

```
http://localhost:3002/
```

**How the order flow works**
- The frontend makes a POST to `/api/order` (and `/sendform`) with JSON.
- The server appends requests (with timestamp) to `server/orders.json` and `server/messages.json`.
- If email is configured (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `TO_EMAIL`, `FROM_EMAIL`), the server attempts to send an email via Resend.
- Admin login is server-side (`/api/admin/login`) with brute-force protection and notifications:
  - repeated failed attempts trigger security alert emails;
  - lockout is applied after several failures;
  - successful admin logins and price updates also trigger emails.

**Troubleshooting: email not delivered**
1. Ensure you have `server/.env` (preferred) or `.env` in repo root. Then restart the server.
2. Check `GET /api/email/status` and `POST /api/email/test`.
3. If you see a 403 error, Resend is rejecting the sender — use `FROM_EMAIL=onboarding@resend.dev` for testing or verify your domain.

**GitHub Pages + GitHub Secrets (важно)**

GitHub Pages раздаёт только статические файлы и не запускает Node.js. Поэтому:
- секреты из GitHub Secrets **не доступны коду в браузере** (их нельзя безопасно прочитать на клиенте);
- GitHub Secrets доступны только в GitHub Actions (во время сборки/деплоя), но не «во время работы сайта».

Чтобы отправка писем работала с сайта на GitHub Pages:
1) задеплойте сервер из папки `server/` на хостинг (Render/Railway/Fly/VPS и т.п.) и задайте там переменные окружения (`RESEND_API_KEY`, `TO_EMAIL`, `FROM_EMAIL`, `CORS_ORIGIN`);
2) в статическом фронтенде укажите публичный URL этого сервера в `frontend/config.js` как `apiBaseUrl`.

Пример `frontend/config.js`:
```js
window.__APP_CONFIG__ = { apiBaseUrl: 'https://your-backend.example.com' };
```

If you want the API to return explicit failures when email sending fails (instead of saving order and returning OK), open an issue or request and I can switch the endpoint to respond with an error status when mail sending fails.

**Developer notes**
- The frontend code calls `/api/order` and `/sendform`. Если фронтенд открыт через GitHub Pages, нужен внешний backend и корректный `apiBaseUrl`.
- Orders saved locally are stored in `server/orders.json`.

**Useful commands**
- Install deps: `cd server && npm install`
- Run server: `node server/server.js`
- Send a test order from the command line:

```bash
curl -X POST http://localhost:3002/api/order \
	-H "Content-Type: application/json" \
	-d '{"markdown":"test order","order":{"buyerName":"Test","buyerPhone":"000","buyerEmail":"test@example.com","details":[],"materialTotal":0,"delivery":0,"total":0}}'

# update port if you changed it
```

**Want me to improve this repo?**
- I can add explicit SMTP verification at startup, return mail-sending errors to the frontend, or wire a simple admin page to view `server/orders.json`.

If you'd like any of the above, tell me which change to make and I'll apply it.

---
Generated by the project assistant to help run the demo locally.
