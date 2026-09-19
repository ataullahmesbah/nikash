-- =====================================================================
-- Nikash — 01_schema.sql
-- PostgreSQL 15+ / Supabase
-- Enums, tables, indexes
-- Run order: 01 -> 02 -> 03 -> 04
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- =====================================================================
-- SECTION 1 — ENUMS
-- =====================================================================

create type business_type      as enum ('vendor','warehouse','shop');
create type company_status     as enum ('trial','active','grace','readonly','blocked');
create type user_role          as enum ('owner','manager','salesman','cashier','accountant','storekeeper');
create type admin_role         as enum ('super_admin','support_admin');

create type party_type         as enum ('supplier','customer');
create type location_type      as enum ('warehouse','shop','factory');

create type doc_status         as enum ('draft','posted','void');
create type movement_type      as enum (
  'opening','purchase_in','sale_out','purchase_return','sale_return',
  'damage','expiry','theft','adjustment','transfer_in','transfer_out'
);

create type payment_method     as enum ('cash','bkash','nagad','bank','cheque');
create type payment_type       as enum ('supplier_payment','customer_collection');

create type expense_status     as enum ('pending','approved','rejected','void');
create type adjustment_reason  as enum ('damage','expiry','theft','count_error','other');
create type count_status       as enum ('draft','counting','review','approved');
create type transfer_status    as enum ('draft','in_transit','received');

create type connection_status  as enum ('pending','active','rejected','disconnected');
create type inbound_status     as enum ('pending','accepted','disputed','expired');

create type notice_type        as enum ('payment_due','warning','info','update');
create type notice_severity    as enum ('info','warning','critical');
create type notice_display     as enum ('banner','popup','both');

create type request_status     as enum ('pending','approved','rejected');
create type invoice_status     as enum ('unpaid','paid','cancelled');
create type sync_status        as enum ('pending','synced','failed');
create type target_scope       as enum ('company','salesman','route');


-- =====================================================================
-- SECTION 2 — PLATFORM TABLES (owned by Nikash, not by clients)
-- =====================================================================

create table platform_admins (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null unique,
  password_hash   text not null,
  role            admin_role not null default 'support_admin',
  is_2fa_enabled  boolean not null default false,
  totp_secret     text,
  is_active       boolean not null default true,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table plans (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,           -- monthly_shop, yearly_warehouse ...
  name_bn         text not null,
  name_en         text not null,
  business_type   business_type,                  -- null = applies to all
  duration_days   integer not null,
  price           numeric(14,2) not null,
  max_users       integer not null default 5,
  max_devices     integer not null default 3,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table companies (
  id                  uuid primary key default gen_random_uuid(),
  nikash_id           text not null unique,       -- NK-4821, generated
  name                text not null,
  business_type       business_type not null,
  owner_name          text,
  phone               text not null,
  email               text,
  address             text,
  district            text,
  plan_id             uuid references plans(id),
  start_date          date,
  end_date            date,                       -- null when is_free = true
  is_free             boolean not null default false,
  status              company_status not null default 'trial',
  max_users           integer not null default 5,
  max_devices         integer not null default 3,
  last_verified_at    timestamptz,
  blocked_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_companies_status   on companies(status);
create index idx_companies_end_date on companies(end_date);
create index idx_companies_type     on companies(business_type);

create table subscription_history (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  action        text not null,                    -- extend, make_free, block, readonly, unblock
  old_end       date,
  new_end       date,
  amount        numeric(14,2),
  trx_id        text,
  method        payment_method,
  note          text,
  admin_id      uuid references platform_admins(id),
  created_at    timestamptz not null default now()
);
create index idx_sub_hist_company on subscription_history(company_id, created_at desc);

create table payment_requests (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  plan_id         uuid references plans(id),
  amount          numeric(14,2) not null,
  method          payment_method not null,
  trx_id          text not null,
  screenshot_url  text,
  status          request_status not null default 'pending',
  reject_reason   text,
  requested_by    uuid,
  requested_at    timestamptz not null default now(),
  approved_by     uuid references platform_admins(id),
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, trx_id)
);
create index idx_payreq_status on payment_requests(status, requested_at desc);

create table platform_invoices (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  invoice_no    text not null unique,             -- NK-INV-2026-0042
  plan_id       uuid references plans(id),
  period_start  date not null,
  period_end    date not null,
  amount        numeric(14,2) not null,
  discount      numeric(14,2) not null default 0,
  total         numeric(14,2) not null,
  status        invoice_status not null default 'unpaid',
  due_date      date,
  issued_at     timestamptz not null default now(),
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_plat_inv_company on platform_invoices(company_id, issued_at desc);
create index idx_plat_inv_status  on platform_invoices(status);

create table platform_payments (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  invoice_id    uuid references platform_invoices(id),
  request_id    uuid references payment_requests(id),
  amount        numeric(14,2) not null,
  method        payment_method not null,
  trx_id        text,
  gateway_ref   text,
  status        request_status not null default 'approved',
  verified_by   uuid references platform_admins(id),
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_plat_pay_company on platform_payments(company_id, created_at desc);

-- Connections between two Nikash companies (warehouse <-> shop etc.)
create table business_connections (
  id                uuid primary key default gen_random_uuid(),
  from_company_id   uuid not null references companies(id) on delete cascade,
  to_company_id     uuid not null references companies(id) on delete cascade,
  status            connection_status not null default 'pending',
  requested_by      uuid,
  responded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (from_company_id <> to_company_id),
  unique (from_company_id, to_company_id)
);
create index idx_conn_to on business_connections(to_company_id, status);

-- Digital invoice sent from one Nikash company to another
create table inbound_invoices (
  id                    uuid primary key default gen_random_uuid(),
  to_company_id         uuid not null references companies(id) on delete cascade,
  from_company_id       uuid not null references companies(id) on delete cascade,
  source_sale_id        uuid not null,
  status                inbound_status not null default 'pending',
  payload               jsonb not null,           -- frozen snapshot of the invoice
  dispute_note          text,
  responded_at          timestamptz,
  created_purchase_id   uuid,
  expires_at            timestamptz not null default (now() + interval '7 days'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_inbound_to on inbound_invoices(to_company_id, status);

create table notices (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references companies(id) on delete cascade,  -- null = all
  business_type   business_type,                                    -- null = all types
  type            notice_type not null default 'info',
  severity        notice_severity not null default 'info',
  title_bn        text not null,
  title_en        text not null,
  body_bn         text,
  body_en         text,
  show_as         notice_display not null default 'banner',
  is_dismissible  boolean not null default true,
  start_at        timestamptz not null default now(),
  end_at          timestamptz,
  created_by      uuid references platform_admins(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_notices_active on notices(start_at, end_at);

create table notice_reads (
  id          uuid primary key default gen_random_uuid(),
  notice_id   uuid not null references notices(id) on delete cascade,
  user_id     uuid not null,
  read_at     timestamptz not null default now(),
  unique (notice_id, user_id)
);

create table app_versions (
  id              uuid primary key default gen_random_uuid(),
  version         text not null,                  -- 1.2.0
  build_number    integer not null,
  platform        text not null default 'android',
  apk_url         text not null,
  file_size_mb    numeric(6,2),
  release_notes   text,
  force_update    boolean not null default false,
  min_supported   text,
  released_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create unique index idx_app_versions_build on app_versions(platform, build_number);

create table admin_logs (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid references platform_admins(id),
  action        text not null,
  target_type   text,
  target_id     uuid,
  old_value     jsonb,
  new_value     jsonb,
  ip_address    inet,
  created_at    timestamptz not null default now()
);
create index idx_admin_logs_time on admin_logs(created_at desc);

create table admin_access_logs (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid references platform_admins(id),
  company_id    uuid references companies(id) on delete cascade,
  reason        text,
  ip_address    inet,
  accessed_at   timestamptz not null default now()
);
create index idx_admin_access_company on admin_access_logs(company_id, accessed_at desc);

create table login_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid,
  user_type       text not null default 'app',    -- app | admin
  company_id      uuid references companies(id) on delete cascade,
  success         boolean not null,
  failure_reason  text,
  ip_address      inet,
  device_info     text,
  created_at      timestamptz not null default now()
);
create index idx_login_hist_user on login_history(user_id, created_at desc);


-- =====================================================================
-- SECTION 3 — COMPANY TABLES
-- Every table below carries company_id and is protected by RLS.
-- =====================================================================

-- id mirrors auth.users.id (Supabase Auth)
create table users (
  id              uuid primary key,
  company_id      uuid not null references companies(id) on delete cascade,
  name            text not null,
  phone           text not null,
  email           text,
  role            user_role not null default 'owner',
  is_active       boolean not null default true,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, phone)
);
create index idx_users_company on users(company_id);

create table devices (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  device_id     text not null,
  device_name   text,
  platform      text,
  app_version   text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (user_id, device_id)
);

create table company_settings (
  company_id            uuid primary key references companies(id) on delete cascade,
  language              text not null default 'bn',
  theme                 text not null default 'system',
  features              jsonb not null default '{}'::jsonb,  -- vehicles, routes, pos, batches...
  archive_after_months  integer,                              -- null = never
  expense_approval_limit numeric(14,2) not null default 2000,
  backdate_days_manager integer not null default 7,
  fiscal_year_start_month integer not null default 7,
  invoice_prefix        text not null default 'INV',
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------- products

create table categories (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name_bn       text not null,
  name_en       text,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_categories_company on categories(company_id) where is_active;

create table products (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  category_id   uuid references categories(id),
  name          text not null,
  brand         text,
  description   text,
  is_active     boolean not null default true,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_products_company on products(company_id) where is_active;
create index idx_products_name_trgm on products using gin (name gin_trgm_ops);

create table product_variants (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  product_id        uuid not null references products(id) on delete cascade,
  name              text not null,              -- "1 litre"
  sku               text,
  base_unit         text not null,              -- piece, kg, litre, bottle, packet
  allow_decimal     boolean not null default false,
  track_expiry      boolean not null default false,
  min_stock_alert   numeric(14,3) not null default 0,
  image_url         text,
  is_active         boolean not null default true,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (company_id, sku)
);
create index idx_variants_product on product_variants(product_id) where is_active;
create index idx_variants_company on product_variants(company_id) where is_active;

-- Multi-level units. level 0 = base unit, factor_to_base = 1
create table variant_units (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  variant_id      uuid not null references product_variants(id) on delete cascade,
  unit_name       text not null,                -- piece / pack / bag / carton / bosta
  level           integer not null default 0,
  qty_below       numeric(14,3) not null default 1,   -- how many of level-1 make one of this
  factor_to_base  numeric(14,3) not null default 1,   -- computed by trigger
  purchase_price  numeric(14,4),
  sale_price      numeric(14,4),
  mrp             numeric(14,4),
  barcode         text,
  is_default_purchase boolean not null default false,
  is_default_sale     boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (variant_id, level),
  check (level >= 0),
  check (qty_below > 0)
);
create index idx_units_variant on variant_units(variant_id);
create index idx_units_barcode on variant_units(company_id, barcode) where barcode is not null;

create table price_history (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  variant_unit_id uuid not null references variant_units(id) on delete cascade,
  old_purchase    numeric(14,4),
  new_purchase    numeric(14,4),
  old_sale        numeric(14,4),
  new_sale        numeric(14,4),
  changed_by      uuid references users(id),
  changed_at      timestamptz not null default now()
);
create index idx_price_hist_unit on price_history(variant_unit_id, changed_at desc);

-- ---------------------------------------------------------------- parties

create table routes (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  area          text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table locations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  type          location_type not null default 'warehouse',
  address       text,
  latitude      numeric(10,7),
  longitude     numeric(10,7),
  is_default    boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index idx_locations_default on locations(company_id) where is_default;

create table parties (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  type                  party_type not null,
  name                  text not null,
  code                  text,
  linked_company_id     uuid references companies(id),   -- Nikash connection
  business_start_date   date,
  business_end_date     date,
  status                text not null default 'active',  -- active | inactive | closed
  address               text,
  area                  text,
  thana                 text,
  district              text,
  latitude              numeric(10,7),
  longitude             numeric(10,7),
  route_id              uuid references routes(id),
  phone                 text,
  alt_phone             text,
  whatsapp              text,
  contact_person        text,
  contact_designation   text,
  email                 text,
  nid_or_license        text,
  note                  text,
  opening_balance       numeric(14,2) not null default 0,
  credit_limit          numeric(14,2) not null default 0,
  payment_terms_days    integer not null default 0,
  is_archived           boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, code)
);
create index idx_parties_company_type on parties(company_id, type) where status = 'active';
create index idx_parties_route on parties(route_id);
create index idx_parties_name_trgm on parties using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------- purchases

create table purchases (
  id              uuid primary key,               -- client generated (offline)
  company_id      uuid not null references companies(id) on delete cascade,
  invoice_no      text not null,
  supplier_id     uuid not null references parties(id),
  location_id     uuid references locations(id),
  entry_date      date not null default current_date,
  is_backdated    boolean not null default false,
  subtotal        numeric(14,2) not null default 0,
  discount        numeric(14,2) not null default 0,
  transport_cost  numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  paid            numeric(14,2) not null default 0,
  due             numeric(14,2) not null default 0,
  status          doc_status not null default 'draft',
  note            text,
  attachment_url  text,
  created_by      uuid references users(id),
  posted_at       timestamptz,
  voided_by       uuid references users(id),
  void_reason     text,
  sync_status     sync_status not null default 'synced',
  device_id       text,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, invoice_no)
);
create index idx_purchases_date on purchases(company_id, entry_date desc) where not is_archived;
create index idx_purchases_supplier on purchases(supplier_id, entry_date desc);
create index idx_purchases_due on purchases(company_id) where due > 0;

create table purchase_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  purchase_id   uuid not null references purchases(id) on delete cascade,
  variant_id    uuid not null references product_variants(id),
  unit_id       uuid not null references variant_units(id),
  qty           numeric(14,3) not null,
  qty_base      numeric(14,3) not null,
  unit_price    numeric(14,4) not null,
  free_qty      numeric(14,3) not null default 0,
  batch_id      uuid,
  total         numeric(14,2) not null
);
create index idx_pitems_purchase on purchase_items(purchase_id);
create index idx_pitems_variant on purchase_items(variant_id);

-- ---------------------------------------------------------------- sales

create table sales (
  id              uuid primary key,               -- client generated (offline)
  company_id      uuid not null references companies(id) on delete cascade,
  invoice_no      text not null,
  customer_id     uuid references parties(id),    -- null when walk-in
  is_walk_in      boolean not null default false,
  walk_in_name    text,
  walk_in_phone   text,
  location_id     uuid references locations(id),
  salesman_id     uuid references users(id),
  vehicle_id      uuid,
  trip_id         uuid,
  entry_date      date not null default current_date,
  is_backdated    boolean not null default false,
  subtotal        numeric(14,2) not null default 0,
  discount        numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  paid            numeric(14,2) not null default 0,
  due             numeric(14,2) not null default 0,
  cogs_total      numeric(14,2) not null default 0,
  status          doc_status not null default 'draft',
  note            text,
  created_by      uuid references users(id),
  posted_at       timestamptz,
  voided_by       uuid references users(id),
  void_reason     text,
  sync_status     sync_status not null default 'synced',
  device_id       text,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, invoice_no),
  check (is_walk_in or customer_id is not null)
);
create index idx_sales_date on sales(company_id, entry_date desc) where not is_archived;
create index idx_sales_customer on sales(customer_id, entry_date desc);
create index idx_sales_due on sales(company_id) where due > 0;
create index idx_sales_salesman on sales(salesman_id, entry_date desc);

create table sale_items (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  sale_id         uuid not null references sales(id) on delete cascade,
  variant_id      uuid not null references product_variants(id),
  unit_id         uuid not null references variant_units(id),
  qty             numeric(14,3) not null,
  qty_base        numeric(14,3) not null,
  unit_price      numeric(14,4) not null,
  free_qty        numeric(14,3) not null default 0,
  cogs_per_base   numeric(14,4) not null default 0,
  batch_id        uuid,
  total           numeric(14,2) not null
);
create index idx_sitems_sale on sale_items(sale_id);
create index idx_sitems_variant on sale_items(variant_id);

-- ---------------------------------------------------------------- returns

create table purchase_returns (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete cascade,
  return_no     text not null,
  purchase_id   uuid references purchases(id),
  supplier_id   uuid not null references parties(id),
  location_id   uuid references locations(id),
  entry_date    date not null default current_date,
  total         numeric(14,2) not null default 0,
  reason        text,
  status        doc_status not null default 'draft',
  created_by    uuid references users(id),
  sync_status   sync_status not null default 'synced',
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, return_no)
);

create table purchase_return_items (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  purchase_return_id  uuid not null references purchase_returns(id) on delete cascade,
  variant_id          uuid not null references product_variants(id),
  unit_id             uuid not null references variant_units(id),
  qty                 numeric(14,3) not null,
  qty_base            numeric(14,3) not null,
  unit_price          numeric(14,4) not null,
  total               numeric(14,2) not null
);

create table sale_returns (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete cascade,
  return_no     text not null,
  sale_id       uuid references sales(id),
  customer_id   uuid references parties(id),
  location_id   uuid references locations(id),
  entry_date    date not null default current_date,
  total         numeric(14,2) not null default 0,
  reason        text,
  status        doc_status not null default 'draft',
  created_by    uuid references users(id),
  sync_status   sync_status not null default 'synced',
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, return_no)
);

create table sale_return_items (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  sale_return_id  uuid not null references sale_returns(id) on delete cascade,
  variant_id      uuid not null references product_variants(id),
  unit_id         uuid not null references variant_units(id),
  qty             numeric(14,3) not null,
  qty_base        numeric(14,3) not null,
  unit_price      numeric(14,4) not null,
  total           numeric(14,2) not null
);

-- ---------------------------------------------------------------- inventory

create table batches (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  variant_id          uuid not null references product_variants(id) on delete cascade,
  batch_no            text not null,
  expiry_date         date,
  purchase_id         uuid references purchases(id),
  qty_base_remaining  numeric(14,3) not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_batches_expiry on batches(company_id, expiry_date) where qty_base_remaining > 0;

-- THE stock ledger. Never update stock directly; always append here.
create table stock_movements (
  id              uuid primary key,
  company_id      uuid not null references companies(id) on delete cascade,
  location_id     uuid references locations(id),
  variant_id      uuid not null references product_variants(id),
  movement_type   movement_type not null,
  qty_base        numeric(14,3) not null,         -- positive in, negative out
  ref_type        text,                           -- purchase | sale | adjustment | transfer ...
  ref_id          uuid,
  batch_id        uuid references batches(id),
  unit_cost       numeric(14,4),
  avg_cost_after  numeric(14,4),
  entry_date      date not null default current_date,
  created_by      uuid references users(id),
  sync_status     sync_status not null default 'synced',
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now()
);
create index idx_moves_variant on stock_movements(company_id, variant_id, entry_date);
create index idx_moves_location on stock_movements(company_id, location_id, variant_id);
create index idx_moves_ref on stock_movements(ref_type, ref_id);

create table stock_snapshots (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  location_id   uuid references locations(id),
  variant_id    uuid not null references product_variants(id),
  as_of_date    date not null,
  qty_base      numeric(14,3) not null,
  avg_cost      numeric(14,4) not null default 0,
  created_at    timestamptz not null default now(),
  unique (company_id, location_id, variant_id, as_of_date)
);

create table stock_adjustments (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete cascade,
  location_id   uuid references locations(id),
  variant_id    uuid not null references product_variants(id),
  qty_base      numeric(14,3) not null,           -- signed
  reason        adjustment_reason not null,
  note          text,
  photo_url     text,
  value_loss    numeric(14,2) not null default 0,
  entry_date    date not null default current_date,
  status        expense_status not null default 'approved',
  created_by    uuid references users(id),
  approved_by   uuid references users(id),
  approved_at   timestamptz,
  sync_status   sync_status not null default 'synced',
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_adj_company on stock_adjustments(company_id, entry_date desc);

create table stock_counts (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(id) on delete cascade,
  location_id             uuid references locations(id),
  count_date              date not null default current_date,
  status                  count_status not null default 'draft',
  started_by              uuid references users(id),
  approved_by             uuid references users(id),
  approved_at             timestamptz,
  total_difference_value  numeric(14,2) not null default 0,
  note                    text,
  is_archived             boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table stock_count_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  count_id      uuid not null references stock_counts(id) on delete cascade,
  variant_id    uuid not null references product_variants(id),
  system_qty    numeric(14,3) not null default 0,
  counted_qty   numeric(14,3),
  difference    numeric(14,3) generated always as (coalesce(counted_qty,0) - system_qty) stored,
  note          text,
  unique (count_id, variant_id)
);

create table stock_transfers (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  transfer_no         text not null,
  from_location_id    uuid not null references locations(id),
  to_location_id      uuid not null references locations(id),
  entry_date          date not null default current_date,
  status              transfer_status not null default 'draft',
  sent_by             uuid references users(id),
  received_by         uuid references users(id),
  received_at         timestamptz,
  note                text,
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company_id, transfer_no),
  check (from_location_id <> to_location_id)
);

create table stock_transfer_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  transfer_id   uuid not null references stock_transfers(id) on delete cascade,
  variant_id    uuid not null references product_variants(id),
  qty_base      numeric(14,3) not null
);

-- ---------------------------------------------------------------- payments

create table payments (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete cascade,
  type          payment_type not null,
  party_id      uuid not null references parties(id),
  amount        numeric(14,2) not null,
  method        payment_method not null default 'cash',
  ref_no        text,
  cheque_date   date,
  entry_date    date not null default current_date,
  is_backdated  boolean not null default false,
  note          text,
  received_by   uuid references users(id),
  status        doc_status not null default 'posted',
  voided_by     uuid references users(id),
  void_reason   text,
  sync_status   sync_status not null default 'synced',
  device_id     text,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (amount > 0)
);
create index idx_payments_party on payments(party_id, entry_date desc);
create index idx_payments_date on payments(company_id, entry_date desc);

create table payment_allocations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  payment_id    uuid not null references payments(id) on delete cascade,
  invoice_type  text not null,                    -- purchase | sale
  invoice_id    uuid not null,
  amount        numeric(14,2) not null,
  created_at    timestamptz not null default now(),
  check (amount > 0)
);
create index idx_alloc_invoice on payment_allocations(invoice_type, invoice_id);

-- ---------------------------------------------------------------- expenses

create table expense_categories (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name_bn       text not null,
  name_en       text,
  is_direct     boolean not null default false,
  is_system     boolean not null default false,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_expcat_company on expense_categories(company_id) where is_active;

create table vehicles (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  reg_no        text not null,
  type          text,
  driver_name   text,
  driver_phone  text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, reg_no)
);

create table vehicle_trips (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  vehicle_id          uuid not null references vehicles(id),
  route_id            uuid references routes(id),
  entry_date          date not null default current_date,
  start_km            numeric(10,1),
  end_km              numeric(10,1),
  fuel_cost           numeric(14,2) not null default 0,
  toll_cost           numeric(14,2) not null default 0,
  driver_allowance    numeric(14,2) not null default 0,
  other_cost          numeric(14,2) not null default 0,
  total_cost          numeric(14,2) generated always as
                        (fuel_cost + toll_cost + driver_allowance + other_cost) stored,
  note                text,
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_trips_date on vehicle_trips(company_id, entry_date desc);

create table expenses (
  id              uuid primary key,               -- client generated (offline)
  company_id      uuid not null references companies(id) on delete cascade,
  category_id     uuid references expense_categories(id),  -- null = "others"
  title           text not null,                  -- free text: "Noakhali-Feni road cost"
  amount          numeric(14,2) not null,
  entry_date      date not null default current_date,
  is_backdated    boolean not null default false,
  paid_from       payment_method not null default 'cash',
  vehicle_id      uuid references vehicles(id),
  trip_id         uuid references vehicle_trips(id),
  party_id        uuid references parties(id),
  location_id     uuid references locations(id),
  description     text,
  attachment_url  text,
  status          expense_status not null default 'approved',
  reject_reason   text,
  created_by      uuid references users(id),
  approved_by     uuid references users(id),
  approved_at     timestamptz,
  voided_by       uuid references users(id),
  voided_at       timestamptz,
  void_reason     text,
  recurring_id    uuid,
  sync_status     sync_status not null default 'synced',
  device_id       text,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (amount > 0)
);
create index idx_expenses_date on expenses(company_id, entry_date desc)
  where status = 'approved' and not is_archived;
create index idx_expenses_status on expenses(company_id, status);
create index idx_expenses_category on expenses(category_id, entry_date desc);
create index idx_expenses_creator on expenses(created_by, entry_date desc);

-- Autocomplete memory for free-text expense titles
create table expense_titles (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  title                 text not null,
  use_count             integer not null default 1,
  last_used_at          timestamptz not null default now(),
  promoted_category_id  uuid references expense_categories(id),
  created_at            timestamptz not null default now(),
  unique (company_id, title)
);
create index idx_exptitles_company on expense_titles(company_id, use_count desc);

create table recurring_expenses (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  category_id       uuid references expense_categories(id),
  title             text not null,
  amount            numeric(14,2) not null,
  day_of_month      integer not null,
  start_date        date not null default current_date,
  end_date          date,
  auto_create       boolean not null default true,
  last_generated_at date,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (day_of_month between 1 and 28)
);

-- ---------------------------------------------------------------- analytics

create table targets (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  scope           target_scope not null default 'company',
  scope_id        uuid,                           -- user_id or route_id
  month           date not null,                  -- first day of month
  target_amount   numeric(14,2) not null,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, scope, scope_id, month)
);

-- Pre-aggregated daily numbers. Dashboard reads from here, never from raw rows.
create table daily_summaries (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  summary_date      date not null,
  sales_total       numeric(14,2) not null default 0,
  purchase_total    numeric(14,2) not null default 0,
  collection_total  numeric(14,2) not null default 0,
  payment_total     numeric(14,2) not null default 0,
  expense_total     numeric(14,2) not null default 0,
  cogs_total        numeric(14,2) not null default 0,
  gross_profit      numeric(14,2) not null default 0,
  net_profit        numeric(14,2) not null default 0,
  stock_value       numeric(14,2) not null default 0,
  receivable        numeric(14,2) not null default 0,
  payable           numeric(14,2) not null default 0,
  cash_in_hand      numeric(14,2) not null default 0,
  invoice_count     integer not null default 0,
  computed_at       timestamptz not null default now(),
  unique (company_id, summary_date)
);
create index idx_summaries_company on daily_summaries(company_id, summary_date desc);

create table pos_shifts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  location_id     uuid references locations(id),
  cashier_id      uuid references users(id),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  opening_cash    numeric(14,2) not null default 0,
  expected_cash   numeric(14,2),
  actual_cash     numeric(14,2),
  difference      numeric(14,2),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- system

create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  user_id       uuid references users(id),
  action        text not null,                    -- insert | update | delete | void | post
  table_name    text not null,
  record_id     uuid,
  old_value     jsonb,
  new_value     jsonb,
  ip_address    inet,
  created_at    timestamptz not null default now()
);
create index idx_audit_company on audit_logs(company_id, created_at desc);
create index idx_audit_record on audit_logs(table_name, record_id);

create table sync_queue (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  user_id       uuid references users(id),
  table_name    text not null,
  record_id     uuid not null,
  operation     text not null,                    -- insert | update | delete
  payload       jsonb,
  status        sync_status not null default 'pending',
  error_message text,
  retry_count   integer not null default 0,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);
create index idx_syncq_status on sync_queue(status, created_at);

-- =====================================================================
-- END 01_schema.sql
-- =====================================================================
