# Games API route map

HTTP paths below are **relative to the mount prefix**. Full URLs are `mount` + `path`.

| Router file | Mount prefix |
|-------------|----------------|
| [userRoutes.js](../routes/userRoutes.js) | `/api/user` |
| [userFundRoutes.js](../routes/userFundRoutes.js) | `/api/user/funds` |
| [adminManagementRoutes.js](../routes/adminManagementRoutes.js) | `/api/admin/manage` |
| [zerodhaRoutes.js](../routes/zerodhaRoutes.js) | `/api/zerodha` (also aliased at `/auth/zerodha`) |

`protectUser` = authenticated user JWT. `protectAdmin` + `superAdminOnly` = super-admin only (where noted).

---

## Main wallet ↔ games wallet

| Method | Full path | Auth | Purpose |
|--------|-----------|------|---------|
| POST | `/api/user/funds/games-transfer` | User | Move funds: body `amount`, `direction` — `toGames` (main → games) or `fromGames` (games → main; only **free** balance, not `usedMargin`). |

---

## Nifty Up/Down and BTC Up/Down

`gameId` values: `updown` (Nifty), `btcupdown` (BTC). Settings keys in Mongo: `niftyUpDown`, `btcUpDown`.

| Method | Full path | Auth | Purpose |
|--------|-----------|------|---------|
| POST | `/api/user/game-bet/place` | User | Place Up/Down bet: `gameId`, `prediction` (UP/DOWN), `amount`, optional `entryPrice`, `windowNumber`. Debits games wallet; BTC stakes go to Super Admin pool when configured. |
| POST | `/api/user/game-bet/resolve` | User | Settle bets for a window from ledger + `GameResult`; credits wins, applies win-side fee split via `distributeWinBrokerage` (Nifty: no BTC pool debit; BTC: pool-funded). |
| GET | `/api/user/game-results/:gameId` | User | Recent `GameResult` rows (`updown` \| `btcupdown`). |
| POST | `/api/user/game-result` | User | Persist a window result (`gameId`, `windowNumber`, prices, times). |
| GET | `/api/user/game-bets/:gameId` | User | User’s settled win/loss history from `GamesWalletLedger` for that `gameId`. |
| GET | `/api/user/updown/active` | User | Active Up/Down session/window context for UI. |
| GET | `/api/user/updown/results` | User | Up/Down results listing for UI. |
| POST | `/api/user/updown/manual-settle` | User | Ledger-based Up/Down settlement fallback (body: `gameId`, `windowNumber`, prices, optional `settlementDay`); mirrors `/game-bet/resolve` economics. |

---

## Nifty Number

| Method | Full path | Auth | Purpose |
|--------|-----------|------|---------|
| POST | `/api/user/nifty-number/bet` | User | Place bet. |
| PUT | `/api/user/nifty-number/bet/:id` | User | Update pending bet. |
| DELETE | `/api/user/nifty-number/bet/:id` | User | Cancel/delete bet where allowed. |
| GET | `/api/user/nifty-number/today` | User | Today’s bets/state. |
| GET | `/api/user/nifty-number/history` | User | History. |
| GET | `/api/user/nifty-number/daily-result` | User | Declared result for a day. |
| GET | `/api/admin/manage/nifty-number/bets` | Super admin | All bets for a date (query filters). |
| POST | `/api/admin/manage/nifty-number/declare-result` | Super admin | Declare result; pays winners; `distributeWinBrokerage` / gross hierarchy / SA pool as per `GameSettings`. |

---

## Nifty Bracket

| Method | Full path | Auth | Purpose |
|--------|-----------|------|---------|
| POST | `/api/user/nifty-bracket/trade` | User | Open bracket position. |
| GET | `/api/user/nifty-bracket/active` | User | Active bracket trades. |
| GET | `/api/user/nifty-bracket/history` | User | History. |
| POST | `/api/user/nifty-bracket/resolve` | User | Resolve path (where exposed to user). |
| POST | `/api/admin/manage/nifty-bracket/manual-settle` | Super admin | Settle active brackets at a manual Nifty LTP (`resolveNiftyBracketTrade`). |

---

## Nifty Jackpot

| Method | Full path | Auth | Purpose |
|--------|-----------|------|---------|
| POST | `/api/user/nifty-jackpot/bid` | User | Place bid. |
| PUT | `/api/user/nifty-jackpot/bid/:id` | User | Update bid. |
| GET | `/api/user/nifty-jackpot/today` | User | Today’s state. |
| GET | `/api/user/nifty-jackpot/leaderboard` | User | Rankings. |
| GET | `/api/user/nifty-jackpot/history` | User | History. |
| GET | `/api/user/nifty-jackpot/locked-price` | User | Locked reference price for session. |
| GET | `/api/admin/manage/nifty-jackpot/bids` | Admin | Admin view of bids. |
| POST | `/api/admin/manage/nifty-jackpot/lock-price` | Super admin | Lock reference price. |
| GET | `/api/admin/manage/nifty-jackpot/locked-price` | Admin | Read locked price. |
| POST | `/api/admin/manage/nifty-jackpot/declare-result` | Super admin | Declare winners; brokerage vs gross hierarchy per `GameSettings`. |

---

## Shared games config and UX (user)

| Method | Full path | Auth | Purpose |
|--------|-----------|------|---------|
| GET | `/api/user/game-settings` | User | Effective game settings / limits for client. |
| GET | `/api/user/games-wallet/ledger` | User | Games wallet ledger lines. |
| GET | `/api/user/games/recent-winners` | User | Recent winners feed. |

---

## Game settings and maintenance (super admin)

| Method | Full path | Auth | Purpose |
|--------|-----------|------|---------|
| GET | `/api/admin/manage/game-settings` | Super admin | Full `GameSettings` document. |
| PUT | `/api/admin/manage/game-settings` | Super admin | Update document (merges `games` keys). |
| PUT | `/api/admin/manage/game-settings/game/:gameId` | Super admin | Patch one game block (e.g. `niftyUpDown`, `brokeragePercent`, profit %). |
| PATCH | `/api/admin/manage/game-settings/game/:gameId/toggle` | Super admin | Flip `enabled` for one game. |
| PATCH | `/api/admin/manage/game-settings/toggle-all` | Super admin | Flip global `gamesEnabled`. |
| PATCH | `/api/admin/manage/game-settings/maintenance` | Super admin | Maintenance mode fields. |

These settings drive **profit distribution** (`profitDistribution`, per-game `profit*Percent`) and **win brokerage split** (`distributeGameProfit`, `distributeWinBrokerage`) in [gameProfitDistribution.js](../services/gameProfitDistribution.js).

---

## LTP / price for games UI

| Method | Full path | Auth | Purpose |
|--------|-----------|------|---------|
| GET | `/api/zerodha/game-price/:symbol` | Open (no JWT in route) | Cached/fallback price for charts and games. |

---

## Related: trading brokerage hierarchy (not games)

Real-trade brokerage split uses [TradeService.distributeBrokerage](../services/tradeService.js) and **`SystemSettings.brokerageSharing`**:

| Method | Full path | Auth |
|--------|-----------|------|
| GET | `/api/admin/manage/system-settings` | Super admin |
| PUT | `/api/admin/manage/system-settings` | Super admin |
| POST | `/api/admin/manage/system-settings/apply/:role` | Super admin |

---

## Background settlement

[gamesAutoSettlement.js](../services/gamesAutoSettlement.js) `runGamesAutoSettlementTick` is invoked from [index.js](../index.js) on startup and on a **60s** interval (unless `GAMES_AUTO_SETTLEMENT=false`). It complements the HTTP declare/settle endpoints above.

---

## `adminRoutes` (`/api/admin`)

[adminRoutes.js](../routes/adminRoutes.js) has **no** game-specific paths in the current codebase; games admin APIs live under **`/api/admin/manage`**.
