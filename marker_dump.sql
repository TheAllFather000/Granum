--
-- PostgreSQL database dump
--

\restrict pZtnAPzUGza6wxidYWC9Xq1AoU6euWGXc5WydDBuHAXnMyQcmnsPGQSbWTafBBg

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: account_status; Type: TYPE; Schema: public; Owner: linkhive
--

CREATE TYPE public.account_status AS ENUM (
    'pending_verification',
    'active',
    'suspended',
    'banned'
);


ALTER TYPE public.account_status OWNER TO linkhive;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: linkhive
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'confirmed',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'refunded'
);


ALTER TYPE public.order_status OWNER TO linkhive;

--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: linkhive
--

CREATE TYPE public.payment_method AS ENUM (
    'card',
    'eft',
    'cash_on_delivery',
    'snapscan',
    'voucher'
);


ALTER TYPE public.payment_method OWNER TO linkhive;

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: linkhive
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded'
);


ALTER TYPE public.payment_status OWNER TO linkhive;

--
-- Name: province; Type: TYPE; Schema: public; Owner: linkhive
--

CREATE TYPE public.province AS ENUM (
    'Western Cape',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Free State',
    'North West',
    'Mpumalanga',
    'Eastern Cape',
    'Northern Cape'
);


ALTER TYPE public.province OWNER TO linkhive;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: linkhive
--

CREATE TYPE public.user_role AS ENUM (
    'spaza_owner',
    'farmer',
    'manufacturer',
    'driver',
    'admin'
);


ALTER TYPE public.user_role OWNER TO linkhive;

--
-- Name: voucher_status; Type: TYPE; Schema: public; Owner: linkhive
--

CREATE TYPE public.voucher_status AS ENUM (
    'active',
    'partially_used',
    'fully_used',
    'expired'
);


ALTER TYPE public.voucher_status OWNER TO linkhive;

--
-- Name: trigger_set_updated_at(); Type: FUNCTION; Schema: public; Owner: linkhive
--

CREATE FUNCTION public.trigger_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_set_updated_at() OWNER TO linkhive;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    seller_id uuid,
    product_name character varying(200) NOT NULL,
    unit character varying(50),
    qty integer DEFAULT 1 NOT NULL,
    unit_price_cents integer NOT NULL,
    subtotal_cents integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_items OWNER TO linkhive;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid NOT NULL,
    order_number character varying(20) NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    delivery_name character varying(200),
    delivery_phone character varying(20),
    delivery_address text,
    delivery_area character varying(100),
    delivery_province public.province,
    delivery_date date,
    delivery_notes text,
    subtotal_cents integer DEFAULT 0 NOT NULL,
    discount_cents integer DEFAULT 0 NOT NULL,
    delivery_cents integer DEFAULT 2500 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    payment_method public.payment_method,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    placed_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    delivered_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.orders OWNER TO linkhive;

--
-- Name: otp_log; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.otp_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone character varying(20) NOT NULL,
    purpose character varying(50) NOT NULL,
    success boolean,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.otp_log OWNER TO linkhive;

--
-- Name: products; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    price_cents integer NOT NULL,
    unit character varying(50) DEFAULT 'each'::character varying NOT NULL,
    emoji character varying(10) DEFAULT '📦'::character varying,
    image_url text,
    badge character varying(50),
    category character varying(100),
    in_stock boolean DEFAULT true NOT NULL,
    stock_qty integer,
    bulk_options jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.products OWNER TO linkhive;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    business_name character varying(200),
    tagline character varying(300),
    bio text,
    cover_url text,
    province public.province,
    area character varying(100),
    address text,
    latitude numeric(9,6),
    longitude numeric(9,6),
    trading_hours jsonb,
    farm_size_ha numeric(8,2),
    capacity_note character varying(200),
    verified boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    rating_sum integer DEFAULT 0 NOT NULL,
    rating_count integer DEFAULT 0 NOT NULL,
    social_links jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profiles OWNER TO linkhive;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO linkhive;

--
-- Name: rescue_matches; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.rescue_matches (
    match_id character varying(50) NOT NULL,
    request_id character varying(50),
    offer_id character varying(50),
    matched_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL
);


ALTER TABLE public.rescue_matches OWNER TO linkhive;

--
-- Name: rescue_offers; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.rescue_offers (
    id character varying(50) NOT NULL,
    product character varying(200) NOT NULL,
    quantity integer NOT NULL,
    unit character varying(50) NOT NULL,
    location character varying(100) NOT NULL,
    price character varying(50),
    shop_name character varying(200) NOT NULL,
    contact_phone character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL
);


ALTER TABLE public.rescue_offers OWNER TO linkhive;

--
-- Name: rescue_requests; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.rescue_requests (
    id character varying(50) NOT NULL,
    product character varying(200) NOT NULL,
    quantity integer NOT NULL,
    unit character varying(50) NOT NULL,
    location character varying(100) NOT NULL,
    urgency character varying(20) DEFAULT 'tomorrow'::character varying NOT NULL,
    willing_to_pay character varying(50),
    shop_name character varying(200) NOT NULL,
    contact_phone character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL
);


ALTER TABLE public.rescue_requests OWNER TO linkhive;

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    order_id uuid,
    stars smallint NOT NULL,
    body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_stars_check CHECK (((stars >= 1) AND (stars <= 5)))
);


ALTER TABLE public.reviews OWNER TO linkhive;

--
-- Name: users; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(255),
    password_hash character varying(255),
    first_name character varying(100),
    last_name character varying(100),
    role public.user_role NOT NULL,
    status public.account_status DEFAULT 'pending_verification'::public.account_status NOT NULL,
    phone_verified boolean DEFAULT false NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    voucher_balance_cents integer DEFAULT 0
);


ALTER TABLE public.users OWNER TO linkhive;

--
-- Name: voucher_redemptions; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.voucher_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_id uuid NOT NULL,
    order_id uuid,
    amount_cents integer NOT NULL,
    redeemed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.voucher_redemptions OWNER TO linkhive;

--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: linkhive
--

CREATE TABLE public.vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(30) NOT NULL,
    created_by uuid,
    recipient_phone character varying(20),
    recipient_name character varying(100),
    sender_name character varying(100),
    message text,
    initial_cents integer NOT NULL,
    balance_cents integer NOT NULL,
    status public.voucher_status DEFAULT 'active'::public.voucher_status NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '1 year'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vouchers OWNER TO linkhive;

--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.order_items (id, order_id, product_id, seller_id, product_name, unit, qty, unit_price_cents, subtotal_cents, created_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.orders (id, buyer_id, order_number, status, delivery_name, delivery_phone, delivery_address, delivery_area, delivery_province, delivery_date, delivery_notes, subtotal_cents, discount_cents, delivery_cents, total_cents, payment_method, payment_status, placed_at, confirmed_at, delivered_at, updated_at) FROM stdin;
62603498-5df3-4f21-843e-0a7658cac85f	86071c83-10a8-41e7-b8b4-316b002415a0	ORD001	delivered	\N	\N	\N	\N	\N	\N	\N	5000	0	2500	7500	\N	paid	2026-04-13 13:12:51.470285+00	\N	\N	2026-04-18 13:12:51.470285+00
a1773de5-5ca5-431c-a4f5-fa296f659b92	86071c83-10a8-41e7-b8b4-316b002415a0	ORD002	out_for_delivery	\N	\N	\N	\N	\N	\N	\N	2300	0	2500	4800	\N	paid	2026-04-17 13:12:51.470285+00	\N	\N	2026-04-18 13:12:51.470285+00
\.


--
-- Data for Name: otp_log; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.otp_log (id, phone, purpose, success, ip_address, created_at) FROM stdin;
a185761e-16e2-48f4-ad6d-c18cf2547087	+27783776253	register	\N	::ffff:172.20.0.1	2026-04-18 13:16:16.630044+00
f284ef74-832c-4d9f-a0bb-a3132ddb4530	+27783776253	register	\N	::ffff:172.20.0.1	2026-04-18 13:20:10.235681+00
88707587-9594-4e87-b2f6-bda464e05dac	+27721234567	login	\N	::ffff:172.20.0.1	2026-04-18 13:34:20.768166+00
81abde87-abc4-4a7a-8926-aa5218010582	+27783776253	login	\N	::ffff:172.20.0.1	2026-04-18 20:34:27.457639+00
44c0e961-81df-40b9-8b20-9df2b45f16ea	+27783776253	login	\N	::ffff:172.20.0.1	2026-04-18 20:55:37.333465+00
90e050e0-923c-40a7-8707-ef6d6e2770d9	+27783776253	register	\N	::ffff:172.20.0.1	2026-04-18 21:01:14.499478+00
97a34cbb-6be5-4b6f-8183-bad224217813	+27783776253	login	\N	::ffff:172.20.0.1	2026-04-18 21:02:40.046298+00
2a002b42-524b-4600-a330-d863c6c9c4a1	+27783776253	login	\N	::ffff:172.20.0.1	2026-04-20 11:48:10.693922+00
e79dfd67-a60e-4046-9d50-115aaab45197	+27783776253	login	\N	156.155.224.26	2026-04-20 20:25:23.182467+00
5b5ce4ee-59fe-400e-8f04-25461d65c3a2	+27783776253	login	\N	::ffff:172.20.0.1	2026-04-20 22:15:28.396991+00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.products (id, profile_id, name, description, price_cents, unit, emoji, image_url, badge, category, in_stock, stock_qty, bulk_options, created_at, updated_at) FROM stdin;
7442f6be-d64f-40f7-8664-3f8b953b2234	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Tomatoes	\N	2500	kg	🍅	\N	\N	Vegetables	t	500	[]	2026-04-18 13:12:51.452083+00	2026-04-18 13:12:51.452083+00
5a1f7738-90df-48eb-a40a-46bebe551df4	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Onions	\N	1800	kg	🧅	\N	\N	Vegetables	t	300	[]	2026-04-18 13:12:51.452083+00	2026-04-18 13:12:51.452083+00
c4885c10-e9bf-4e89-bb4f-b3a5de217962	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Potatoes	\N	2200	kg	🥔	\N	\N	Vegetables	t	800	[]	2026-04-18 13:12:51.452083+00	2026-04-18 13:12:51.452083+00
68973824-596c-419e-920b-38c4ad71772b	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Bread Loaf	\N	1800	loaf	🍞	\N	\N	Bakery	t	100	[]	2026-04-18 13:12:51.463285+00	2026-04-18 13:12:51.463285+00
df800eeb-01f4-4e28-91c0-3a22f2080d3e	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Rusks (12 pack)	\N	3500	pack	🥨	\N	\N	Bakery	t	50	[]	2026-04-18 13:12:51.463285+00	2026-04-18 13:12:51.463285+00
a1191be4-d2f0-42be-ba09-5cfbe99d55af	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Bread Loaf	\N	1800	loaf	🍞	\N	\N	Bakery	t	50	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
80f3cb3a-dbbd-4940-a25e-111216d3c964	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Milk 1L	\N	2200	litre	🥛	\N	\N	Dairy	t	100	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
6348e2b3-e622-4f0f-8b10-591b48d0b9c6	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Sugar 1kg	\N	2500	kg	🧂	\N	\N	Groceries	t	80	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
a9911bbf-b5f9-455f-9c1f-1a7e6fa78ea2	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Cooking Oil 750ml	\N	3500	bottle	🫒	\N	\N	Cooking	t	40	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
73512d09-bf64-4bec-b25e-7eb26c7bd0e2	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Tea Bags 50s	\N	1500	pack	🍵	\N	\N	Beverages	t	60	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
4f4543dc-bc4d-4636-be81-929f3b01d0bd	a23bf460-4765-471f-a4f3-fe1abd3ce952	Rice 2kg	\N	4500	kg	🍚	\N	\N	Groceries	t	70	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
2b42c40e-3821-4ecc-bd3b-9ccc6545d080	a23bf460-4765-471f-a4f3-fe1abd3ce952	Maize Meal 5kg	\N	3500	bag	🌽	\N	\N	Staples	t	90	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
290ae7f4-99fa-4a27-a8eb-1dcdb4eaabf9	a23bf460-4765-471f-a4f3-fe1abd3ce952	Eggs (12 pack)	\N	4000	dozen	🥚	\N	\N	Dairy	t	50	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
838aa49e-1212-4521-aa1d-fc515d570138	a23bf460-4765-471f-a4f3-fe1abd3ce952	Chicken 1kg	\N	5500	kg	🍗	\N	\N	Meat	t	30	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
b6a0a07f-cb3b-4779-b8f3-c79e88af886c	a23bf460-4765-471f-a4f3-fe1abd3ce952	Onions 1kg	\N	1200	kg	🧅	\N	\N	Vegetables	t	100	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
31018d16-27bb-479a-bee1-41b83f28801d	ca7ddd5d-c3c7-43ae-bddc-81b19cbf4d1e	Tomatoes 1kg	\N	2500	kg	🍅	\N	\N	Vegetables	t	200	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
978fd9c1-c7b2-4d3d-a725-77434cae6d62	ca7ddd5d-c3c7-43ae-bddc-81b19cbf4d1e	Potatoes 1kg	\N	1800	kg	🥔	\N	\N	Vegetables	t	300	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
729b4331-cffe-489a-bee2-a2cec3d08b2c	ca7ddd5d-c3c7-43ae-bddc-81b19cbf4d1e	Carrots 1kg	\N	1500	kg	🥕	\N	\N	Vegetables	t	150	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
3f4e63e3-893e-43f9-99a0-c3a108931215	ca7ddd5d-c3c7-43ae-bddc-81b19cbf4d1e	Spinach 500g	\N	1200	bunch	🥬	\N	\N	Vegetables	t	80	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
eeb7b0c2-1001-4aca-960f-a63a11eea9cf	ca7ddd5d-c3c7-43ae-bddc-81b19cbf4d1e	Cabbage each	\N	800	piece	🥬	\N	\N	Vegetables	t	100	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
f68a5632-3766-47e1-a8c6-73e805027f79	fc4d5d75-a667-4e70-b554-d9a47d13f27f	Butternut 1kg	\N	2000	kg	🎃	\N	\N	Vegetables	t	250	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
722d4667-2715-46e0-9ceb-21a485b9b129	fc4d5d75-a667-4e70-b554-d9a47d13f27f	Onions 1kg	\N	1800	kg	🧅	\N	\N	Vegetables	t	200	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
a1b00a1a-9146-46b9-a80f-4f3b35e219ba	fc4d5d75-a667-4e70-b554-d9a47d13f27f	Green Peppers 500g	\N	2200	pack	🫑	\N	\N	Vegetables	t	100	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
74665348-4a32-473e-a644-01828223527b	fc4d5d75-a667-4e70-b554-d9a47d13f27f	Cucumber each	\N	500	piece	🥒	\N	\N	Vegetables	t	150	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
034adeb4-9b96-4f81-baf6-0fcda6f7d913	fc4d5d75-a667-4e70-b554-d9a47d13f27f	Lettuce head	\N	800	head	🥬	\N	\N	Vegetables	t	80	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
b949cb0f-9f0f-4afb-9b8f-5077e8eed5c9	a73b2660-92bc-4671-b9a7-6b1d112cd5fc	Choc Chip Cookies 200g	\N	2500	pack	🍪	\N	\N	Snacks	t	100	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
8535706f-50c1-429b-91e1-126eca88823c	a73b2660-92bc-4671-b9a7-6b1d112cd5fc	Instant Coffee 100g	\N	4500	jar	☕	\N	\N	Beverages	t	60	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
dad5c1b0-280d-4845-93ff-f9058f6d4cb5	a73b2660-92bc-4671-b9a7-6b1d112cd5fc	Soya Mince 500g	\N	2200	pack	🫘	\N	\N	Protein	t	80	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
85e9d95e-cad6-4a89-ac1c-f520c29b1111	a73b2660-92bc-4671-b9a7-6b1d112cd5fc	Maize Rice 1kg	\N	2000	pack	🌽	\N	\N	Staples	t	120	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
a854ec87-828d-486d-bcab-f3b2e068af23	a73b2660-92bc-4671-b9a7-6b1d112cd5fc	Pasta 500g	\N	1800	pack	🍝	\N	\N	Staples	t	90	[]	2026-04-20 17:39:30.220357+00	2026-04-20 17:39:30.220357+00
5c726a37-a1c0-4cfa-a1e3-6217b7afd7e0	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	DDetergent 1L	\N	2800	bottle	🧴	\N	\N	Household	t	60	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
9bd2a4fb-f02e-4adb-bb1e-79f410493100	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Toilet Paper 4 roll	\N	2200	pack	🧻	\N	\N	Household	t	80	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
119f0599-241b-40ea-b256-1b59cdad42c8	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Bar Soap 100g	\N	800	bar	🧼	\N	\N	Personal Care	t	100	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
713f6006-fe63-493f-922e-bce88d12b6c3	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Salt 1kg	\N	1200	kg	🧂	\N	\N	Groceries	t	90	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
4a04d159-7413-40ee-914d-d451184d5a5f	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Baking Powder 100g	\N	1000	pack	🧂	\N	\N	Baking	t	50	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
36570997-8a29-42de-b670-c17a462d7736	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Bleach 1L	\N	1500	bottle	🧪	\N	\N	Household	t	40	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
f7012e4e-e3c4-4478-87a6-1a4d92e16955	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Vaseline 100ml	\N	1800	jar	🧴	\N	\N	Personal Care	t	60	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
858fcc68-d77b-48e5-80b9-a38601f5c147	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Rusk Pack	\N	3500	pack	🍘	\N	\N	Bakery	t	40	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
bfa67e46-cf9c-494b-a34c-cd30cbbba4fd	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Scones 4 pack	\N	2500	pack	🧁	\N	\N	Bakery	t	30	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
33c7e38b-59cd-44c4-a66b-f2cf7544f0e4	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Cake Slice	\N	1500	slice	🍰	\N	\N	Bakery	t	50	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
b638fafc-7a6f-44c7-920f-74f6b742af2a	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Croissant	\N	1200	piece	🥐	\N	\N	Bakery	t	25	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
f5488cec-54d0-4fb8-bd8b-3de777d19024	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Muffins 2 pack	\N	2000	pack	🧁	\N	\N	Bakery	t	35	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
bee86667-4e30-41ee-b104-f36d9e4331f9	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Apples 1kg	\N	3500	kg	🍎	\N	\N	Fruit	t	80	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
95a2872d-ab6b-46a3-8c65-52794ee31591	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Bananas 1kg	\N	2000	kg	🍌	\N	\N	Fruit	t	120	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
ba731e03-1db0-4a15-b5b2-620d308da6eb	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Oranges 1kg	\N	2800	kg	🍊	\N	\N	Fruit	t	90	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
e550fd49-a044-4be3-9a14-3b0a7d1df9e2	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Avocado each	\N	1200	piece	🥑	\N	\N	Fruit	t	40	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
6a59f84f-2a1e-448d-a49d-f53aa6293bcd	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Mango each	\N	1500	piece	🥭	\N	\N	Fruit	t	50	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
d3321419-2917-49ee-b849-d1b50071f8fe	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Lemons 4 pack	\N	1800	pack	🍋	\N	\N	Fruit	t	60	[]	2026-04-20 17:39:49.905482+00	2026-04-20 17:39:49.905482+00
ec9d3033-edc5-405a-9371-a6cb19324924	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Super Maize Meal	Premium grade white maize meal 5kg bag	8500	5kg	🌽	https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400	\N	groceries	t	50	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
025af514-8bdb-409f-8d7f-62e24612e0ff	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Sunflower Oil	Pure sunflower oil 1L	2500	1L	🫒	https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400	\N	groceries	t	30	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
5b95ebdc-725f-4b04-9f00-72ce031897a5	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	White Sugar	Refined white sugar 1kg	1800	1kg	🍬	https://images.unsplash.com/photo-1587134111941-2ca61bf5a933?w=400	\N	groceries	t	40	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
75718450-da5e-4843-a4e1-2adbe53df247	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Brown Bread	Freshly baked brown bread loaf	1600	loaf	🍞	https://images.unsplash.com/photo-1509440150476-9b5b2f80ae97?w=400	\N	bakery	t	20	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
f929bf47-ff3e-4a4c-ae61-ef1c24464703	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Salted Chips	Crunchy salted potato chips 200g	1200	200g	🍟	https://images.unsplash.com/photo-1566478989037-eec170785d0e?w=400	\N	snacks	t	25	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
5099a22a-6f8c-4830-aafe-a1a848c4f1f7	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Instant Coffee	Rich instant coffee 100g	3500	100g	☕	https://images.unsplash.com/photo-1559056199-641a0ac4b55d?w=400	\N	beverages	t	15	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
dcc6281c-cda0-480d-806f-b877b2b53494	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Fresh Tomatoes	Organic Tomatoes 1kg	2200	1kg	🍅	https://images.unsplash.com/photo-1546470427-f5d4b6c9e9a7?w=400	\N	produce	t	35	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
8668ee8a-aaf0-4d95-ac81-58e62843f034	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Green Peppers	Fresh green peppers 500g	1500	500g	🫑	https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400	\N	produce	t	20	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
99b54d18-f2ea-4b63-86d8-f79c762f15f4	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Onions	Yellow onions 1kg	1200	1kg	🧅	https://images.unsplash.com/photo-1518974876610-85b0e21d2cfd?w=400	\N	produce	t	40	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
fe40e939-2d70-4db6-ad50-f912cbe1ae40	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Potatoes	White potatoes 5kg	3500	5kg	🥔	https://images.unsplash.com/photo-1518977676601-c53d4a56e4d5?w=400	\N	produce	t	50	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
11a84446-521f-42c3-998c-349066449db1	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Carrots	Fresh carrots 1kg	1100	1kg	🥕	https://images.unsplash.com/photo-1598170845058-32fb5f6b7e1c?w=400	\N	produce	t	30	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
b1caab41-9b32-4c4c-a9f2-82e40830a448	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Scones	Freshly baked scones 6 pack	2000	6 pack	🧁	https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=400	\N	bakery	t	15	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
d0dc5eca-4950-462d-9254-f43b3c3bd126	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Milk Tart	Traditional milk tart	1800	each	🥧	https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400	\N	bakery	t	10	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
2590a057-a990-4ab7-91e9-135974a97979	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Rusk	Crispy butter rusks 750g	2500	750g	🍪	https://images.unsplash.com/photo-1558961363-fa8fdf82db4a?w=400	\N	bakery	t	12	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
09c77266-6a9e-40d1-bfab-52a56848a07c	b7fd1840-52b5-42a6-9d18-20ac74a1583d	Chicken Eggs	Free range eggs 30 eggs	6500	30 eggs	🥚	https://images.unsplash.com/photo-1582722872445-44dc5f7e2c8f?w=400	\N	produce	t	25	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
eaa379ac-7438-4179-8ef5-6eda4ab8182d	b7fd1840-52b5-42a6-9d18-20ac74a1583d	Whole Chicken	Fresh whole chicken 1.5kg	4500	1.5kg	🍗	https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400	\N	meat	t	12	[]	2026-04-20 20:27:49.428293+00	2026-04-20 20:27:49.428293+00
d13680c2-e92c-41aa-887b-01018b7bd362	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Dettol	Dettol antiseptic liquid 500ml	2800	500ml	🧴	https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400	\N	household	t	20	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
8ea14969-9e4a-466f-b7d1-dc8ee485b2e6	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Sunlight Detergent	Washing powder 1kg	2200	1kg	🧺	https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400	\N	household	t	25	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
a7c48433-0c59-4fef-9676-94b946c3f9cd	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Cooldrink	Coca Cola 340ml	1200	340ml	🥤	https://images.unsplash.com/photo-1629203851122-3726ecdf9e82a?w=400	\N	beverages	t	30	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
a10c8d77-3549-45bd-a495-4e893922b74b	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Orange Drink	Fresh orange juice 1L	1800	1L	🍊	https://images.unsplash.com/photo-1600271886742-f04b2ac4e1cb?w=400	\N	beverages	t	20	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
ceeade38-f5b4-41b9-a8e9-3c8ef1f7f8d1	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Bread	White bread loaf	1400	loaf	🍞	https://images.unsplash.com/photo-1509440150476-9b5b2f80ae97?w=400	\N	bakery	t	25	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
2d834c73-2935-4124-acd2-e6ec2e0bed38	6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	Power White	White cement 50kg	9500	50kg	🏗️	https://images.unsplash.com/photo-1518709766631-a6a7e45948c5?w=400	\N	hardware	t	10	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
f537a178-8677-460c-b54e-0f05e5bd3ddc	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Spinach	Fresh spinach 500g	1000	500g	🥬	https://images.unsplash.com/photo-1576045057995-568f588f82e1?w=400	\N	produce	t	25	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
212622a4-4eec-412d-85e7-bfae7107c1b9	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Cabbage	Fresh green cabbage each	800	each	🥬	https://images.unsplash.com/photo-1594282486755-6f2bd9b7fb47?w=400	\N	produce	t	20	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
13ff1a55-ac99-4bda-b26e-e89cbfe9e6c3	7fe6da0e-6ec8-4163-8d4c-897f3746dbec	Butternut	Fresh butternut 1kg	1800	1kg	🎃	https://images.unsplash.com/photo-1570586437263-ab629fccc8d4?w=400	\N	produce	t	15	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
e031f7b6-4258-4be3-a7d0-eeaa23bb5c1d	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Cupcakes	Chocolate cupcakes 4 pack	2500	4 pack	🧁	https://images.unsplash.com/photo-1556909212-d5b604d0c2d3?w=400	\N	bakery	t	10	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
6fdc4c09-bdcc-453f-be68-12102c244a11	d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	Cookies	Butter cookies 200g	1500	200g	🍪	https://images.unsplash.com/photo-1499636136210-6f4e32fc5d43?w=400	\N	bakery	t	15	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
9c1454ca-78cd-4ff1-b241-7cefdc045b9a	b7fd1840-52b5-42a6-9d18-20ac74a1583d	Beef Mince	Lean beef mince 1kg	5500	1kg	🥩	https://images.unsplash.com/photo-1603048297172-c92544798d5e?w=400	\N	meat	t	15	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
c40ce58d-0587-4ed9-93d3-ed1b6afc7e76	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Candles	Household candles 4 pack	1200	4 pack	🕯️	https://images.unsplash.com/photo-1603006905003-be475563bc59?w=400	\N	household	t	20	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
f9cb759f-2e07-4fe4-9d31-46d3c5412ac0	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Matchbox	Safety matches box	500	box	🔥	https://images.unsplash.com/photo-1514004236801-1d5537a1b37b?w=400	\N	household	t	30	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
03a192b0-9419-40e3-80c4-b0fd7816cb7f	f297f55a-e2c3-4a98-90c9-5ffda36ec370	Sweets	Assorted sweets 500g	2500	500g	🍬	https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=400	\N	snacks	t	25	[]	2026-04-20 20:27:59.253521+00	2026-04-20 20:27:59.253521+00
14ee024a-1fa9-484f-aa19-58ee76ae8481	b7fd1840-52b5-42a6-9d18-20ac74a1583d	FTeezy	AAA	1200	per kg	📦	\N	\N	General	t	\N	[]	2026-04-20 21:57:24.502059+00	2026-04-20 21:57:24.502059+00
b9498390-5b5e-4934-bcf8-df5722e4a784	b7fd1840-52b5-42a6-9d18-20ac74a1583d	Fresh Potatoes		1500	per kg	📦	\N	\N	General	t	\N	[]	2026-04-20 23:18:25.689756+00	2026-04-20 23:18:25.689756+00
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.profiles (id, user_id, business_name, tagline, bio, cover_url, province, area, address, latitude, longitude, trading_hours, farm_size_ha, capacity_note, verified, verified_at, rating_sum, rating_count, social_links, created_at, updated_at) FROM stdin;
6dffdf4c-c28d-4d4b-8c6c-8a33f212922a	86071c83-10a8-41e7-b8b4-316b002415a0	Thabo's Corner Shop	\N	\N	\N	Gauteng	Soweto	\N	\N	\N	\N	\N	\N	f	\N	0	0	[]	2026-04-18 13:12:41.532363+00	2026-04-18 13:12:41.532363+00
7fe6da0e-6ec8-4163-8d4c-897f3746dbec	5d047eec-677a-4b30-8080-a9b949c4d534	Anna's Fresh Produce	\N	\N	\N	Western Cape	Cape Flats	\N	\N	\N	\N	\N	\N	f	\N	0	0	[]	2026-04-18 13:12:41.543339+00	2026-04-18 13:12:41.543339+00
d9973075-5f8c-4c5d-80bf-267fbdc0f1ea	a3af327c-eddc-4cd0-9de5-d32fb000003b	Kwanda's Bakery	\N	\N	\N	Gauteng	Johannesburg	\N	\N	\N	\N	\N	\N	f	\N	0	0	[]	2026-04-18 13:12:41.552142+00	2026-04-18 13:12:41.552142+00
f297f55a-e2c3-4a98-90c9-5ffda36ec370	58e54cc3-a6ce-4a83-87bf-bedd810b63a5	First Corner Shop	\N	\N	\N	Eastern Cape	East London	\N	\N	\N	\N	\N	\N	t	\N	45	12	[]	2026-04-20 17:38:47.348167+00	2026-04-20 17:38:47.348167+00
a23bf460-4765-471f-a4f3-fe1abd3ce952	0a2ff5c8-e4f2-4d10-b6e0-e5b00c4a06fd	Zwide Village Spaza	\N	\N	\N	Eastern Cape	East London	\N	\N	\N	\N	\N	\N	t	\N	45	12	[]	2026-04-20 17:38:47.348167+00	2026-04-20 17:38:47.348167+00
ca7ddd5d-c3c7-43ae-bddc-81b19cbf4d1e	20d18201-d4d0-47ea-a55f-fe2c4a955643	Green Valley Farms	\N	\N	\N	Western Cape	Stellenbosch	\N	\N	\N	\N	\N	\N	t	\N	78	23	[]	2026-04-20 17:39:03.116963+00	2026-04-20 17:39:03.116963+00
fc4d5d75-a667-4e70-b554-d9a47d13f27f	25777fd3-2e3e-47b8-b429-fa8cea8c61ee	Sunrise Agricultural Co-op	\N	\N	\N	Western Cape	Stellenbosch	\N	\N	\N	\N	\N	\N	t	\N	78	23	[]	2026-04-20 17:39:03.116963+00	2026-04-20 17:39:03.116963+00
a73b2660-92bc-4671-b9a7-6b1d112cd5fc	d70194cd-fc19-4633-8160-176d1f87813a	Cape Food Manufacturers	\N	\N	\N	Western Cape	Cape Town	\N	\N	\N	\N	\N	\N	t	\N	92	31	[]	2026-04-20 17:39:03.116963+00	2026-04-20 17:39:03.116963+00
b7fd1840-52b5-42a6-9d18-20ac74a1583d	5e0b0063-5db2-4afe-8d6c-4915b173c665	Ibrahim's Store	Your friendly neighbourhood seller	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	0	0	[{"url": "https://www.facebook.com/", "platform": "whatsapp"}, {"url": "https://www.youtube.com/watch?v=GgbY_TyTOTc", "platform": "website"}, {"url": "https://www.facebook.com/", "platform": "facebook"}]	2026-04-18 13:20:31.893529+00	2026-04-20 23:19:34.907602+00
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at) FROM stdin;
c7b341eb-b046-4492-a6a6-0c84ca38eb3d	5e0b0063-5db2-4afe-8d6c-4915b173c665	65ac1579b16a3265f388c0670370f6dd3e100ce02ddcb565560c2ea3c227b30b	2026-05-18 13:20:31.913+00	t	2026-04-18 13:20:31.914586+00
0e40652e-ecc5-4bac-b075-681bf8bd9797	5e0b0063-5db2-4afe-8d6c-4915b173c665	f033c6f1829101bc80db364f043de368a559bf34a2267e61296e8e3705167346	2026-05-18 20:56:11.701+00	t	2026-04-18 20:56:11.702414+00
7e9e0822-1c54-4ce1-a45e-475f778c0bf1	5e0b0063-5db2-4afe-8d6c-4915b173c665	ab6433410389a164e59c07d44947c014c7b18336eaa31a34894842c51562218b	2026-05-18 20:56:40.932+00	t	2026-04-18 20:56:40.933248+00
10e79dcc-df15-4a8d-a111-c8e6e750de31	5e0b0063-5db2-4afe-8d6c-4915b173c665	dc6455c2487d15bfa708a08523da0b5f9cff576c152d3489f9390ecbb6e99b43	2026-05-18 21:02:47.446+00	t	2026-04-18 21:02:47.447946+00
011eb412-96fb-4e26-a1de-5d6b3732c501	5e0b0063-5db2-4afe-8d6c-4915b173c665	41ad770674a856c41468725409d27176da6f9da7b7a8b662e4a4f4704d07932f	2026-05-20 11:48:34.926+00	t	2026-04-20 11:48:34.927177+00
162d362d-e29d-4290-9273-f892f59ea288	5e0b0063-5db2-4afe-8d6c-4915b173c665	de8b81a8c9eef69d252e5d7f8d89e7c42b3047be80796ee3fbeb2a9ff60f595c	2026-05-20 20:25:37.826+00	t	2026-04-20 20:25:37.829088+00
1adf898f-5757-47d0-a849-3d3e652a77d4	5e0b0063-5db2-4afe-8d6c-4915b173c665	3cb4e485df647f43ace4f5d99282caa11f6b1ef0b30f1b5af8bed4ecd783ca7c	2026-05-20 22:15:41.261+00	t	2026-04-20 22:15:41.262109+00
7beab134-ea58-40bb-95b1-c0556dcb403d	5e0b0063-5db2-4afe-8d6c-4915b173c665	3190954068b467b928067719fef0fc10f958d8c33725d0295ce2366e55259889	2026-05-20 22:16:34.793+00	t	2026-04-20 22:16:34.794134+00
8f0699e0-be55-4ea6-a826-3c94cc417f18	5e0b0063-5db2-4afe-8d6c-4915b173c665	bb7e1697b67dc97d6937b59b803adb7a1abe845a7b5a52c6b6232c16c8b03c1f	2026-05-20 22:39:55.412+00	t	2026-04-20 22:39:55.412768+00
49a86ecf-3e54-4af3-b831-85dc7ccf8b28	5e0b0063-5db2-4afe-8d6c-4915b173c665	42558919eb0054ef579f6319176a9714a939ea821b768d54898457688a72090d	2026-05-20 22:40:16.023+00	t	2026-04-20 22:40:16.023296+00
ba6f7651-d5b8-4de0-9ac3-b35cafcf532a	5e0b0063-5db2-4afe-8d6c-4915b173c665	3cc54d3f5eb65ec985d22fe6e38bd01b9cd20bab1f00cc4ee91f94ed2c717ad0	2026-05-20 23:17:16.917+00	t	2026-04-20 23:17:16.91782+00
\.


--
-- Data for Name: rescue_matches; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.rescue_matches (match_id, request_id, offer_id, matched_at, status) FROM stdin;
\.


--
-- Data for Name: rescue_offers; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.rescue_offers (id, product, quantity, unit, location, price, shop_name, contact_phone, created_at, status) FROM stdin;
off_7s0t6f	Maize meal	25	loaves	Soweto Zone A	R14/loaf	Ibrahims	0783776253	2026-04-20 22:38:36.485511+00	active
off_7tak74	Brown bread	20	loaves	Khayelitsha	R15/loaf	Ibrahim's Shop	078 377 6253	2026-04-20 23:14:11.567445+00	active
\.


--
-- Data for Name: rescue_requests; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.rescue_requests (id, product, quantity, unit, location, urgency, willing_to_pay, shop_name, contact_phone, created_at, status) FROM stdin;
req_77kbok	Brown bread	10	loaves	Soweto Zone A	tomorrow	at cost	AAAA	0783776253	2026-04-20 13:05:54.990438+00	resolved
req_7s037q	Brown bread	10	loaves	Soweto Zone A	tomorrow	at cost	Ibrahim's Store	+27783776253	2026-04-20 22:38:02.837979+00	active
req_7t97j4	Tomatoes	6	kg	Khayelitsha	today	at cost	Ibrahim's Store	078 377 6253	2026-04-20 23:13:08.278964+00	active
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.reviews (id, profile_id, reviewer_id, order_id, stars, body, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.users (id, phone, email, password_hash, first_name, last_name, role, status, phone_verified, avatar_url, created_at, updated_at, voucher_balance_cents) FROM stdin;
a20e87d7-488c-4efd-80f7-df4b4deb06e8	+27000000000	admin@linkhive.co.za	$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewMQqr0h4y9c4.7u	Linkhive	Admin	admin	active	t	\N	2026-04-18 13:08:47.742934+00	2026-04-18 13:08:47.742934+00	0
86071c83-10a8-41e7-b8b4-316b002415a0	+27721234567	\N	$2a$12$xrQwexypfv/A.6EqGuJ3sOoQfMd8c/uJSHXfeZ1C.4dzDJahDlQSu	Thabo	Mokoena	spaza_owner	active	t	\N	2026-04-18 13:12:30.300941+00	2026-04-18 13:12:30.300941+00	0
064fb03c-feb6-4774-ada5-1fdc31c7e710	+27731234568	\N	$2a$12$dEPUQ9xeFCOp1PdxVeidlu8SyGJldF/ubjHb1XFPLoDlIrYy8t/xm	Nomsa	Dlamini	spaza_owner	active	t	\N	2026-04-18 13:12:41.497046+00	2026-04-18 13:12:41.497046+00	0
5d047eec-677a-4b30-8080-a9b949c4d534	+27771234572	\N	$2a$12$dEPUQ9xeFCOp1PdxVeidlu8SyGJldF/ubjHb1XFPLoDlIrYy8t/xm	Anna	van der Merwe	farmer	active	t	\N	2026-04-18 13:12:41.504818+00	2026-04-18 13:12:41.504818+00	0
8bed1472-c5f5-4ad9-acf9-3d32358aa9ad	+27781234573	\N	$2a$12$dEPUQ9xeFCOp1PdxVeidlu8SyGJldF/ubjHb1XFPLoDlIrYy8t/xm	Pieter	Smith	farmer	active	t	\N	2026-04-18 13:12:41.510802+00	2026-04-18 13:12:41.510802+00	0
a3af327c-eddc-4cd0-9de5-d32fb000003b	+27821234577	\N	$2a$12$dEPUQ9xeFCOp1PdxVeidlu8SyGJldF/ubjHb1XFPLoDlIrYy8t/xm	Kwanda	Ndlovu	manufacturer	active	t	\N	2026-04-18 13:12:41.517096+00	2026-04-18 13:12:41.517096+00	0
7bce2c1e-3191-46a8-b31d-991194564718	+27831234578	\N	$2a$12$dEPUQ9xeFCOp1PdxVeidlu8SyGJldF/ubjHb1XFPLoDlIrYy8t/xm	Cebo	Mthethwa	manufacturer	active	t	\N	2026-04-18 13:12:41.522625+00	2026-04-18 13:12:41.522625+00	0
58e54cc3-a6ce-4a83-87bf-bedd810b63a5	+27791234571	\N	$2b$10$placeholder	Sarah	Ndlovu	spaza_owner	active	f	\N	2026-04-20 17:38:40.234826+00	2026-04-20 17:38:40.234826+00	0
20d18201-d4d0-47ea-a55f-fe2c4a955643	+27791234572	\N	$2b$10$placeholder	David	Mthembu	farmer	active	f	\N	2026-04-20 17:38:40.234826+00	2026-04-20 17:38:40.234826+00	0
d70194cd-fc19-4633-8160-176d1f87813a	+27791234573	\N	$2b$10$placeholder	Maria	Van Der Merwe	manufacturer	active	f	\N	2026-04-20 17:38:40.234826+00	2026-04-20 17:38:40.234826+00	0
0a2ff5c8-e4f2-4d10-b6e0-e5b00c4a06fd	+27791234574	\N	$2b$10$placeholder	Thabo	Mokoena	spaza_owner	active	f	\N	2026-04-20 17:38:40.234826+00	2026-04-20 17:38:40.234826+00	0
25777fd3-2e3e-47b8-b429-fa8cea8c61ee	+27791234575	\N	$2b$10$placeholder	Anna	Smith	farmer	active	f	\N	2026-04-20 17:38:40.234826+00	2026-04-20 17:38:40.234826+00	0
5e0b0063-5db2-4afe-8d6c-4915b173c665	+27783776253	ibrahimsow367@gmail.com	$2a$12$bY/D1qjMopL2szlFev5bWeOvZcbV6Cft3KP.WyS8xMd0dsUUXP6Pe	Ibrahim	Sow	farmer	active	t	\N	2026-04-18 13:20:31.893529+00	2026-04-20 22:29:25.848084+00	1300
\.


--
-- Data for Name: voucher_redemptions; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.voucher_redemptions (id, voucher_id, order_id, amount_cents, redeemed_at) FROM stdin;
\.


--
-- Data for Name: vouchers; Type: TABLE DATA; Schema: public; Owner: linkhive
--

COPY public.vouchers (id, code, created_by, recipient_phone, recipient_name, sender_name, message, initial_cents, balance_cents, status, expires_at, created_at) FROM stdin;
e0c681b6-8263-4f58-a6f3-bcc0b505292f	GRANUM-VOUCHER-50	86071c83-10a8-41e7-b8b4-316b002415a0	\N	\N	\N	\N	5000	5000	active	2027-04-18 13:13:21.612032+00	2026-04-18 13:13:21.612032+00
e2cd9ce2-c974-4825-bd60-8b1fcb2e2a38	GRANUM-VOUCHER-100	86071c83-10a8-41e7-b8b4-316b002415a0	\N	\N	\N	\N	10000	10000	active	2027-04-18 13:13:21.612032+00	2026-04-18 13:13:21.612032+00
e58a13cb-b433-4357-9abb-982bc76958fb	GRANUM-VOUCHER-25	86071c83-10a8-41e7-b8b4-316b002415a0	\N	\N	\N	\N	2500	2500	active	2027-04-18 13:13:21.612032+00	2026-04-18 13:13:21.612032+00
3be76692-779d-47dc-be4a-eba1f2fdd747	LH-B4567	\N	+27791234567	John	Jane	Happy birthday!	2000	2000	active	2027-04-20 12:54:59.157497+00	2026-04-20 12:54:59.157497+00
faafa766-b6ed-4b62-8227-aeeb39766c0e	LH-EF4BB	\N	0783776253	Ibrahim Sow	Ballsack	Fuck you	2000	2000	active	2027-04-20 12:57:59.761372+00	2026-04-20 12:57:59.761372+00
5a0affd1-44c3-41dd-a800-ef1f0cf1225f	LH-07673	\N	0783776253	\N	\N	\N	2000	2000	active	2027-04-20 14:37:03.814605+00	2026-04-20 14:37:03.814605+00
69f0e5a9-fc11-480a-887c-6be00faa5b5a	LH-5F503	\N	078 377 6253	Ibrahim	Ibrahim	Groceries for you	2000	2000	active	2027-04-20 21:26:55.098905+00	2026-04-20 21:26:55.098905+00
7722576d-e22b-4e31-acd7-500773aec6b0	LH-B2664	\N	0783776253	Mama Rose	ARARA	Thinking of you	2000	2000	active	2027-04-20 21:59:34.653765+00	2026-04-20 21:59:34.653765+00
b685520a-58d2-4603-b61c-2722925e7325	LH-DA189	\N	0783776253	Mama Rose	Anonymous Register	Taaaaaa	2000	2000	active	2027-04-20 22:03:22.545585+00	2026-04-20 22:03:22.545585+00
294c4470-d032-4bf0-bb35-b92b1c0fe478	LH-E61E6	\N	078 377 6253	Ibrahim	Ibrahim	Groceries	2000	2000	active	2027-04-20 22:13:11.362236+00	2026-04-20 22:13:11.362236+00
0195ccd2-8dd1-465d-9478-d776b61d275a	LH-17046	\N	0783776253	\N	\N	\N	2000	2000	active	2027-04-20 22:19:17.381017+00	2026-04-20 22:19:17.381017+00
c113ba85-cb39-4a95-954c-3e428e8d269b	LH-DAF00	\N	0783776253	\N	\N	\N	2000	2000	active	2027-04-20 22:19:53.071865+00	2026-04-20 22:19:53.071865+00
36268205-8435-49cb-9f89-e8720d8029cc	LH-FB05A	\N	0783776253	\N	\N	\N	2000	2000	active	2027-04-20 22:25:46.481557+00	2026-04-20 22:25:46.481557+00
9a28fdb4-6756-4cc0-89e4-d91069bf85b3	LH-EF3D5	\N	078 377 6253	\N	\N	\N	2000	2000	active	2027-04-20 22:30:21.966147+00	2026-04-20 22:30:21.966147+00
6c543d01-14c4-41fc-8e11-818d3059ec77	LH-A263F	\N	078 377 6253	Ibrahim Sow	Ibrahim Sow	Groceries	2000	2000	active	2027-04-20 23:10:12.64592+00	2026-04-20 23:10:12.64592+00
\.


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: otp_log otp_log_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.otp_log
    ADD CONSTRAINT otp_log_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: rescue_matches rescue_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.rescue_matches
    ADD CONSTRAINT rescue_matches_pkey PRIMARY KEY (match_id);


--
-- Name: rescue_offers rescue_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.rescue_offers
    ADD CONSTRAINT rescue_offers_pkey PRIMARY KEY (id);


--
-- Name: rescue_requests rescue_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.rescue_requests
    ADD CONSTRAINT rescue_requests_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_profile_id_reviewer_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_profile_id_reviewer_id_order_id_key UNIQUE (profile_id, reviewer_id, order_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: voucher_redemptions voucher_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.voucher_redemptions
    ADD CONSTRAINT voucher_redemptions_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_code_key; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_code_key UNIQUE (code);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_buyer; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_orders_buyer ON public.orders USING btree (buyer_id);


--
-- Name: idx_orders_number; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_orders_number ON public.orders USING btree (order_number);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_products_category ON public.products USING btree (category);


--
-- Name: idx_products_in_stock; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_products_in_stock ON public.products USING btree (in_stock);


--
-- Name: idx_products_profile; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_products_profile ON public.products USING btree (profile_id);


--
-- Name: idx_profiles_province; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_profiles_province ON public.profiles USING btree (province);


--
-- Name: idx_profiles_user; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_profiles_user ON public.profiles USING btree (user_id);


--
-- Name: idx_profiles_verified; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_profiles_verified ON public.profiles USING btree (verified);


--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_rescue_offers_location; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_rescue_offers_location ON public.rescue_offers USING btree (location);


--
-- Name: idx_rescue_offers_status; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_rescue_offers_status ON public.rescue_offers USING btree (status);


--
-- Name: idx_rescue_requests_location; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_rescue_requests_location ON public.rescue_requests USING btree (location);


--
-- Name: idx_rescue_requests_status; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_rescue_requests_status ON public.rescue_requests USING btree (status);


--
-- Name: idx_reviews_profile; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_reviews_profile ON public.reviews USING btree (profile_id);


--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_users_phone ON public.users USING btree (phone);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_vouchers_code; Type: INDEX; Schema: public; Owner: linkhive
--

CREATE INDEX idx_vouchers_code ON public.vouchers USING btree (code);


--
-- Name: orders set_orders_updated_at; Type: TRIGGER; Schema: public; Owner: linkhive
--

CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


--
-- Name: products set_products_updated_at; Type: TRIGGER; Schema: public; Owner: linkhive
--

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: linkhive
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


--
-- Name: users set_users_updated_at; Type: TRIGGER; Schema: public; Owner: linkhive
--

CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- Name: products products_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: rescue_matches rescue_matches_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.rescue_matches
    ADD CONSTRAINT rescue_matches_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.rescue_offers(id);


--
-- Name: rescue_matches rescue_matches_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.rescue_matches
    ADD CONSTRAINT rescue_matches_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.rescue_requests(id);


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: voucher_redemptions voucher_redemptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.voucher_redemptions
    ADD CONSTRAINT voucher_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: voucher_redemptions voucher_redemptions_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.voucher_redemptions
    ADD CONSTRAINT voucher_redemptions_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id);


--
-- Name: vouchers vouchers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: linkhive
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict pZtnAPzUGza6wxidYWC9Xq1AoU6euWGXc5WydDBuHAXnMyQcmnsPGQSbWTafBBg

