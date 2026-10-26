-- Migration 0005: Rebuild index on important_dates(contact_id)
--
-- The contact_id index became corrupted after the bulk date fix script
-- ran DELETE+INSERT operations outside normal API paths. The corrupted
-- index causes WHERE contact_id = ? queries to return incomplete results
-- while JOINs (which bypass the index via a full scan) work correctly.
--
-- Fix: drop and recreate the index to force a full rebuild from table data.

DROP INDEX IF EXISTS important_dates_contact_id_idx;
CREATE INDEX important_dates_contact_id_idx ON important_dates(contact_id);
