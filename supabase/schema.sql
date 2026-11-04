-- Ejecutar una vez en SQL Editor de Supabase antes de publicar.
CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY, name text NOT NULL, category text NOT NULL,
  description text NOT NULL DEFAULT '', image text NOT NULL DEFAULT '',
  tiers jsonb NOT NULL DEFAULT '[]', active boolean NOT NULL DEFAULT true,
  deleted boolean NOT NULL DEFAULT false, source_wholesale text
);
CREATE TABLE IF NOT EXISTS public.variants (
 id text PRIMARY KEY, product_id text NOT NULL REFERENCES public.products(id),
 model text NOT NULL, stock integer NOT NULL DEFAULT 0 CHECK(stock>=0),
 active boolean NOT NULL DEFAULT true, UNIQUE(product_id,model)
);
CREATE TABLE IF NOT EXISTS public.orders (
 id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 customer text NOT NULL, phone text NOT NULL, address text NOT NULL,
 notes text NOT NULL DEFAULT '', mode text NOT NULL DEFAULT 'mayorista',method text NOT NULL DEFAULT 'whatsapp',
 status text NOT NULL DEFAULT 'pendiente',total integer NOT NULL,items jsonb NOT NULL,
 first_name text NOT NULL DEFAULT '',last_name text NOT NULL DEFAULT '',dni text NOT NULL DEFAULT '',
 city text NOT NULL DEFAULT '', postal_code text NOT NULL DEFAULT '',email text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS public.inventory_moves (
 id bigserial PRIMARY KEY, variant_id text NOT NULL, delta integer NOT NULL,reason text NOT NULL,
 order_id text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sessions (token_hash text PRIMARY KEY,expires_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS public.login_attempts (ip_hash text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_start bigint NOT NULL);
CREATE TABLE IF NOT EXISTS public.site_texts (key text PRIMARY KEY,value text NOT NULL);
CREATE INDEX IF NOT EXISTS ix_orders_created ON public.orders(created_at DESC);
-- Todas las consultas se ejecutan desde funciones del servidor con DATABASE_URL privado.
-- No habilitar lectura pública de estas tablas; contienen datos personales de clientes.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_texts ENABLE ROW LEVEL SECURITY;
-- Bucket público SOLO para imágenes de producto, no para datos de compradores.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('productos','productos',true,2097152,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=true;
