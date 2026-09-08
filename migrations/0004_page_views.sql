-- First-party page counters. No cookies, no third party, no per-request rows: every hit becomes a
-- counter bump, and visitors are a daily salted hash that cannot be traced back to an address.
CREATE TABLE page_views (
	day date NOT NULL,
	path text NOT NULL,
	referrer text NOT NULL DEFAULT '',
	country text NOT NULL DEFAULT '',
	views integer NOT NULL DEFAULT 0,
	PRIMARY KEY (day, path, referrer, country)
);
CREATE INDEX page_views_day ON page_views (day DESC);

-- One row per visitor per day. The hash is sha256(secret + day + ip + user agent), so it is useless
-- tomorrow and useless without the secret.
CREATE TABLE view_visitors (
	day date NOT NULL,
	visitor text NOT NULL,
	PRIMARY KEY (day, visitor)
);
