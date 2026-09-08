-- Every identical-listing cluster of three or more, one row per (game, name, map, max players),
-- kept across runs so a farm has a first-seen date and can be looked up after it goes quiet.
-- size/ips/subnets/players describe the latest run in which the farm was present.
CREATE TABLE farms (
	id bigserial PRIMARY KEY,
	app_id integer NOT NULL,
	name text NOT NULL,
	map text NOT NULL DEFAULT '',
	max_players integer NOT NULL DEFAULT 0,
	size integer NOT NULL,
	ips integer NOT NULL,
	subnets integer NOT NULL,
	players integer NOT NULL DEFAULT 0,
	first_seen timestamptz NOT NULL,
	last_seen timestamptz NOT NULL,
	UNIQUE (app_id, name, map, max_players)
);
CREATE INDEX farms_last_seen_size ON farms (last_seen DESC, size DESC);
CREATE INDEX farms_app_map ON farms (app_id, map);
CREATE INDEX farms_name_trgm ON farms (lower(name) text_pattern_ops);

-- Members of a farm are looked up by the same key over the current listings.
CREATE INDEX listings_cluster_key ON listings (app_id, name, map, max_players) WHERE cluster_size >= 3;
