# Profit Tracker architecture

## Source-of-truth hierarchy

1. Shopify orders are the revenue ledger.
2. Shopify variant unit cost is the default COGS source; merchant overrides win when configured.
3. Actual Shopify transaction fees are preferred to percentage estimates.
4. Fulfillment/shipping uses actual connected costs when available; otherwise a merchant cost rule.
5. Meta supplies spend and reported attribution.
6. Reconciled contribution profit is calculated independently of Meta's reported ROAS.

## Key metrics

- True contribution profit
- Contribution margin
- Profit per order
- Blended ROAS / MER
- Meta-reported purchase ROAS
- Break-even CPA
- Break-even ROAS
- Pre-ad contribution
- Revenue-to-profit reconciliation

## Attribution philosophy

Profit Tracker never hides attribution uncertainty. It stores separate:
- platform reported attribution
- blended financial allocation
- deterministic evidence (click IDs / UTMs / checkout evidence when available)
- confidence score

This lets users make profit decisions without pretending attribution is exact.

## Security

- OAuth tokens live in integration_credentials.
- RLS is enabled.
- anon/authenticated are explicitly denied access to integration_credentials.
- server routes use a Supabase secret key.
- publishable keys can be used in the browser only after user-facing auth is added.
