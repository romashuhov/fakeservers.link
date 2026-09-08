-- Valve's own servers (name prefix "Valve ..." or an address in the Steam Datagram Relay range
-- 100.64.0.0/10) are listed by the master server but are not community servers. They are kept in
-- listings so a lookup can say so, and excluded from every count.
ALTER TABLE listings ADD COLUMN official boolean NOT NULL DEFAULT false;
ALTER TABLE snapshots ADD COLUMN official integer NOT NULL DEFAULT 0;
