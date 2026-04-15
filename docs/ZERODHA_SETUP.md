# Zerodha (Kite Connect) — setup and troubleshooting

## Security

- Never share Gmail, Zerodha, or API passwords in chat. If they were exposed, **change them immediately** on Google and Zerodha, and rotate **Kite API secret** in the developer console if needed.

## Two different logins

| Where | Purpose |
|--------|---------|
| [developers.kite.trade](https://developers.kite.trade) | Create your **Kite Connect app** (API key, API secret, **redirect URL**). Login is Zerodha’s own site. |
| [kite.zerodha.com](https://kite.zerodha.com) | Your **trading** account (user ID, password, 2FA). |
| Stockex **admin → Connect Zerodha** | Starts OAuth: your server sends you to Kite; after approval, Zerodha calls back to your API. |

Stockex cannot fix **developers.kite.trade** login failures (wrong password, 2FA, account blocks). Use Zerodha account recovery or support.

## If developers.kite.trade login fails

1. Use your **Zerodha user ID** (often short alphanumeric), not only “Sign in with Google,” if the form asks for Kite credentials.
2. Reset password from Zerodha’s official flows if unsure.
3. Check **2FA / TOTP** (phone time must be accurate).
4. Ensure the Zerodha account is **active** and KYC allows API access.
5. Try **incognito**, another browser, or disable extensions; confirm the URL is `developers.kite.trade`.

## Verify you can use Zerodha at all

Confirm you can log in at **kite.zerodha.com** with user ID + password + 2FA before relying on API or the developer portal.

## Stockex OAuth (admin “Connect Zerodha”)

1. Copy [`server/.env.example`](../server/.env.example) to `server/.env` and fill values.
2. Set **`ZERODHA_API_KEY`** and **`ZERODHA_API_SECRET`** from your app on developers.kite.trade.
3. Set **`SERVER_URL`** to the exact public origin of this Node server (e.g. `http://localhost:5001` locally, or your HTTPS domain in production).
4. In the Kite Connect app, set **Redirect URL** to **exactly**:

   `{SERVER_URL}/api/zerodha/callback`

   Example (local): `http://localhost:5001/api/zerodha/callback`  
   Scheme, host, port, and path must match — Zerodha is strict.

5. Set **`CLIENT_URL`** to your Stockex frontend (e.g. `http://localhost:3000`) so after login the browser returns to the admin UI.

6. Start the API server (`npm run dev` from repo root or `npm run dev` in `server/`) and use **Connect Zerodha** from the admin panel.

### Debugging

- On **GET** `/api/zerodha/login-url`, the JSON includes `redirectUrl` — it must match what you registered on developers.kite.trade.
- In development, the server logs the same redirect URL once per request (non-production) so you can copy it into the Kite app.
- Watch **server console** on OAuth callback; errors from `https://api.kite.trade/session/token` appear there.
- In the browser **Network** tab, check `/api/zerodha/login-url` and the redirect chain after Zerodha login.

### Code reference

- OAuth and callback: [`server/routes/zerodhaRoutes.js`](../server/routes/zerodhaRoutes.js)
