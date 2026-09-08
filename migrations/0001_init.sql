-- Current state of every address seen in GetServerList, one row per (app, addr).
CREATE TABLE listings (
	app_id integer NOT NULL,
	addr text NOT NULL,
	ip inet NOT NULL,
	port integer NOT NULL,
	name text,
	map text,
	players integer,
	max_players integer,
	bots integer,
	steamid text,
	anonymous boolean NOT NULL DEFAULT false,
	secure boolean,
	gametype text,
	version text,
	region integer,
	cluster_size integer NOT NULL DEFAULT 1,
	first_seen timestamptz NOT NULL,
	last_seen timestamptz NOT NULL,
	PRIMARY KEY (app_id, addr)
);
CREATE INDEX listings_last_seen ON listings (last_seen);
CREATE INDEX listings_ip ON listings (ip);
CREATE INDEX listings_app_name ON listings (app_id, name);

-- One row per (app, collector run): the aggregates the site is built from.
CREATE TABLE snapshots (
	id bigserial PRIMARY KEY,
	app_id integer NOT NULL,
	taken_at timestamptz NOT NULL,
	total integer NOT NULL,
	unique_ips integer NOT NULL,
	unique_subnets integer NOT NULL,
	dup3 integer NOT NULL,
	dup5 integer NOT NULL,
	dup10 integer NOT NULL,
	dup100 integer NOT NULL,
	anonymous integer NOT NULL,
	appeared integer NOT NULL,
	disappeared integer NOT NULL,
	largest_cluster integer NOT NULL,
	largest_cluster_name text,
	max_per_ip integer NOT NULL,
	max_per_subnet integer NOT NULL,
	pages integer NOT NULL,
	truncated boolean NOT NULL DEFAULT false,
	duration_ms integer NOT NULL,
	UNIQUE (app_id, taken_at)
);
CREATE INDEX snapshots_taken_at ON snapshots (taken_at DESC);

-- Largest identical-listing clusters of each snapshot.
CREATE TABLE clusters (
	id bigserial PRIMARY KEY,
	snapshot_id bigint NOT NULL REFERENCES snapshots (id) ON DELETE CASCADE,
	name text NOT NULL,
	map text,
	max_players integer,
	size integer NOT NULL,
	ips integer NOT NULL,
	subnets integer NOT NULL
);
CREATE INDEX clusters_snapshot ON clusters (snapshot_id, size DESC);
CREATE INDEX clusters_name ON clusters (name);

-- Visitor reports about addresses the site got wrong.
CREATE TABLE reports (
	id bigserial PRIMARY KEY,
	addr text NOT NULL,
	note text,
	client_hash text,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_created_at ON reports (created_at DESC);
