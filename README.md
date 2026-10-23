# Profit Tracker

Standalone ecommerce profit intelligence software built to answer one question accurately:

> **How much money did the store actually make after product cost, fulfillment, fees, refunds, expenses and advertising?**

Profit Tracker is intentionally separate from Avonent OS.

## Implemented

- Mobile-first profit dashboard
- Shopify OAuth flow
- Shopify order/product/refund/transaction-fee sync
- Variant COGS import from Shopify inventory cost
- Meta OAuth flow
- Meta ad-level daily spend, purchases, purchase value and reported ROAS sync
- True contribution-profit calculation
- Daily profit reconciliation
- Product profitability
- Order-level P&L
- Creative/ad profitability
- Break-even CPA and break-even ROAS
- Cost-rule engine
- Profit waterfall
- Reported ROAS vs financial profit separation
- Automatic 15-minute sync endpoint
- Demo mode before integrations are configured

## Profit formula

```
net revenue
- COGS
- fulfillment
- payment processing fees
- ad spend
- variable expenses
= true contribution profit
```

Taxes are tracked separately rather than counted as merchant profit.

## Stack

Next.js 16 · React 19 · Supabase/Postgres · Shopify Admin GraphQL API · Meta Marketing API · Vercel-ready cron scheduling

## Setup

1. Create a **new Supabase project** for Profit Tracker.
2. Run `supabase/migrations/001_initial.sql`.
3. Copy `.env.example` to `.env.local`.
4. Configure Supabase, Shopify and Meta credentials.
5. Set `NEXT_PUBLIC_APP_URL` to the deployed URL.
6. Set a strong `CRON_SECRET`.
7. Deploy to a Next.js-compatible host.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the accounting and attribution model.

OAuth tokens are backend-only. Never expose `SUPABASE_SECRET_KEY` in browser code.
