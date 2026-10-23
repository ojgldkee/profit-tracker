create extension if not exists pgcrypto;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  shop_domain text unique,
  currency text not null default 'USD',
  timezone text not null default 'America/Los_Angeles',
  last_shopify_sync_at timestamptz,
  last_meta_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null check (provider in ('shopify','meta')),
  external_account_id text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,provider)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  shopify_product_id text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,shopify_product_id)
);
create table public.variants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  shopify_variant_id text not null,
  title text,
  sku text,
  unit_cost numeric(14,4) not null default 0,
  cost_override numeric(14,4),
  updated_at timestamptz not null default now(),
  unique(store_id,shopify_variant_id)
);

create table public.cost_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null,
  label text not null,
  value numeric(14,4) not null default 0,
  priority integer not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  shopify_order_id text not null,
  order_name text not null,
  created_at timestamptz not null,
  currency text not null default 'USD',
  financial_status text,
  payment_gateways text[] not null default '{}',
  gross_sales numeric(14,2) not null default 0,
  discounts numeric(14,2) not null default 0,
  refunds numeric(14,2) not null default 0,
  shipping_revenue numeric(14,2) not null default 0,
  taxes numeric(14,2) not null default 0,
  net_revenue numeric(14,2) not null default 0,
  cogs numeric(14,2) not null default 0,
  fulfillment_cost numeric(14,2) not null default 0,
  payment_fees numeric(14,2) not null default 0,
  pre_ad_contribution numeric(14,2) not null default 0,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(store_id,shopify_order_id)
);
create index orders_store_created_idx on public.orders(store_id,created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shopify_line_item_id text not null,
  shopify_variant_id text,
  product_title text not null,
  variant_title text,
  sku text,
  quantity integer not null default 1,
  gross_sales numeric(14,2) not null default 0,
  discounts numeric(14,2) not null default 0,
  refunds numeric(14,2) not null default 0,
  cogs numeric(14,2) not null default 0
);
create index order_items_order_idx on public.order_items(order_id);

create table public.meta_daily (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  day date not null,
  campaign_id text not null default '',
  campaign_name text not null default '',
  adset_id text not null default '',
  adset_name text not null default '',
  ad_id text not null,
  ad_name text not null default '',
  spend numeric(14,2) not null default 0,
  purchases numeric(14,2) not null default 0,
  purchase_value numeric(14,2) not null default 0,
  meta_roas numeric(14,4) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(store_id,day,ad_id)
);
create index meta_daily_store_day_idx on public.meta_daily(store_id,day desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  day date not null default current_date,
  label text not null,
  category text not null default 'other',
  amount numeric(14,2) not null check(amount>=0),
  variable boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table public.order_attribution (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ad_id text,
  campaign_id text,
  source text not null default 'blended',
  confidence numeric(5,4) not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(order_id,source)
);

alter table public.stores enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.cost_rules enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.meta_daily enable row level security;
alter table public.expenses enable row level security;
alter table public.order_attribution enable row level security;

revoke all on public.integration_credentials from anon, authenticated;

create policy "owners read stores" on public.stores for select to authenticated using (owner_user_id=(select auth.uid()));
create policy "owners update stores" on public.stores for update to authenticated using (owner_user_id=(select auth.uid())) with check (owner_user_id=(select auth.uid()));

create or replace view public.daily_profit with (security_invoker=true) as
with o as (
  select store_id, created_at::date day,
    count(*) orders,
    sum(gross_sales) gross_sales,
    sum(refunds) refunds,
    sum(net_revenue) net_revenue,
    sum(cogs) cogs,
    sum(fulfillment_cost) fulfillment_cost,
    sum(payment_fees) payment_fees,
    sum(pre_ad_contribution) pre_ad_contribution
  from public.orders group by store_id,created_at::date
), m as (
  select store_id,day,sum(spend) ad_spend,sum(purchase_value) meta_purchase_value
  from public.meta_daily group by store_id,day
), e as (
  select store_id,day,sum(amount) variable_expenses from public.expenses group by store_id,day
)
select coalesce(o.store_id,m.store_id,e.store_id) store_id,
       coalesce(o.day,m.day,e.day) day,
       coalesce(o.orders,0)::bigint orders,
       coalesce(o.gross_sales,0)::numeric gross_sales,
       coalesce(o.refunds,0)::numeric refunds,
       coalesce(o.net_revenue,0)::numeric net_revenue,
       coalesce(o.cogs,0)::numeric cogs,
       coalesce(o.fulfillment_cost,0)::numeric fulfillment_cost,
       coalesce(o.payment_fees,0)::numeric payment_fees,
       coalesce(m.ad_spend,0)::numeric ad_spend,
       coalesce(m.meta_purchase_value,0)::numeric meta_purchase_value,
       coalesce(e.variable_expenses,0)::numeric variable_expenses,
       coalesce(o.pre_ad_contribution,0)::numeric pre_ad_contribution,
       (coalesce(o.pre_ad_contribution,0)-coalesce(m.ad_spend,0)-coalesce(e.variable_expenses,0))::numeric contribution_profit
from o full join m on m.store_id=o.store_id and m.day=o.day
full join e on e.store_id=coalesce(o.store_id,m.store_id) and e.day=coalesce(o.day,m.day);

create or replace view public.ad_profitability with (security_invoker=true) as
select m.store_id,m.day,m.ad_id,m.ad_name,m.campaign_id,m.campaign_name,m.adset_id,m.adset_name,
       m.spend,m.purchases,m.purchase_value attributed_revenue,m.meta_roas,
       case when m.purchase_value>0 then m.purchase_value-m.spend else -m.spend end contribution_profit,
       case when m.purchase_value>0 then (m.purchase_value-m.spend)/m.purchase_value else 0 end margin,
       case when m.meta_roas>=3 then 'scale' when m.meta_roas>=2 then 'hold' when m.meta_roas>=1.5 then 'watch' else 'kill' end recommendation
from public.meta_daily m;

create or replace view public.product_profitability with (security_invoker=true) as
select o.store_id,o.created_at::date day,oi.product_title,
       count(distinct o.id)::bigint orders,
       sum(oi.gross_sales-oi.discounts-oi.refunds)::numeric net_revenue,
       sum(oi.cogs)::numeric cogs,
       sum((oi.gross_sales-oi.discounts-oi.refunds)-oi.cogs)::numeric contribution_profit,
       case when sum(oi.gross_sales-oi.discounts-oi.refunds)>0 then
         sum((oi.gross_sales-oi.discounts-oi.refunds)-oi.cogs)/sum(oi.gross_sales-oi.discounts-oi.refunds) else 0 end margin,
       case when count(distinct o.id)>0 then
         sum((oi.gross_sales-oi.discounts-oi.refunds)-oi.cogs)/count(distinct o.id) else 0 end break_even_cpa,
       case when sum((oi.gross_sales-oi.discounts-oi.refunds)-oi.cogs)>0 then
         sum(oi.gross_sales-oi.discounts-oi.refunds)/sum((oi.gross_sales-oi.discounts-oi.refunds)-oi.cogs) else 0 end break_even_roas
from public.order_items oi join public.orders o on o.id=oi.order_id
group by o.store_id,o.created_at::date,oi.product_title;

create or replace view public.order_profitability with (security_invoker=true) as
with d as (
  select store_id,day,ad_spend,orders from public.daily_profit
)
select o.*,
       case when d.orders>0 then d.ad_spend/d.orders else 0 end allocated_ad_spend,
       o.pre_ad_contribution-(case when d.orders>0 then d.ad_spend/d.orders else 0 end) contribution_profit
from public.orders o left join d on d.store_id=o.store_id and d.day=o.created_at::date;

grant select on public.daily_profit,public.ad_profitability,public.product_profitability,public.order_profitability to authenticated;
