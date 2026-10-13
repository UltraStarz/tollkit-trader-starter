# Tollkit Trader Starter

A starter trading bot built on [Tollkit Wallet](https://github.com/UltraStarz/tollkit-wallet). It ships with four example strategies, runs on pretend money at live prices by default, and trades for real only when you switch it to live. Even then it stays inside the spending limits and approvals you set in the wallet.

You write or choose the strategy. The bot follows it exactly.

## Start in five minutes

```
git clone https://github.com/UltraStarz/tollkit-trader-starter && cd tollkit-trader-starter
npm install
npx tollkit-wallet init            # once: makes your wallet (keys stay on this computer)
npx tollkit-wallet paper reset 1000  # $1,000 of pretend USDC per chain
cp .env.example .env               # point TOLLKIT_WALLET_PASSWORD_FILE at a file with your password
npm run paper                      # run the strategy in config.json on pretend money
```

## Strategies

Pick one in `config.json` (`"strategy"`), and set its numbers under `"strategies"`.

| Strategy | What it does |
|---|---|
| `dca` | Buys a fixed dollar amount every N hours, whatever the price. |
| `dip-buyer` | Buys when the price is X% under its 24-hour high (with a cooldown), then sells those buys at +Y%. |
| `momentum` | Buys when a fast moving average crosses above a slow one; sells those buys when it crosses back below. |
| `rebalance` | Keeps the token at a target share of token + USDC, trading only when it drifts outside a band. |

Prices come from Coinbase's public market data. Trades go through 0x on Base and Ethereum, and through Jupiter on Solana. The starter prices ETH and SOL; to add a token, add its Coinbase product in `src/market.ts`.

**Write your own:** copy a file in `src/strategies/`, change `decide()`, and add it to `src/strategies/index.ts`. `decide()` gets the price, candles, your balances and its own saved notes. It returns a buy (in dollars), a sell (in units), or nothing. Run `npm test` to check the decision logic on made-up prices.

## Going live

1. Run it on paper first, long enough to trust it.
2. Fund the wallet: `npx tollkit-wallet address` shows your addresses. Keep a little ETH (Base/Ethereum) or SOL for network fees.
3. Set limits that match what you're willing to lose: `npx tollkit-wallet budget per_trade_usd=50 daily_trades_usd=200`. Turn on Telegram approvals for bigger trades with `npx tollkit-wallet telegram <bot-token> <chat-id>`.
4. Set `BOT_MODE=live` in `.env`, then run `npm start`.

Every trade pays Tollkit Wallet's flat 0.5% fee (0x may add 0.15% on some Base and Ethereum pairs). Trades show up in `npx tollkit-wallet receipts` and in the dashboard (`npx tollkit-wallet ui`).

## Running it 24/7

The bot trades only while it's running. Here are three ways to keep it going:

- **Any always-on computer:** `npm start` inside `tmux` or `screen`.
- **A small Linux server:** run it as a systemd service. Copy the wallet folder (`~/.tollkit-wallet`) and a password file that only that user can read (`chmod 600`).
- **One decision per run:** `npm run once` from cron (e.g. every 5 minutes).

You can also skip the bot loop for simple orders. Tollkit Wallet's built-in autopilot handles limit buys, stop-losses, take-profits, trailing stops and recurring buys (`npx tollkit-wallet rule add "..."`, then `npx tollkit-wallet autopilot`).

## Important

This is example code, not financial advice. Strategies can and do lose money. Nothing here is tuned or tested for profit. Start on paper, then start small.

MIT licence.
