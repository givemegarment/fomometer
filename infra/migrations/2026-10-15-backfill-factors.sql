-- One-off: copy the normalized factors still kept in `signals` (72 h) to outcomes and to
-- events not yet labeled, so research starts with ~3 extra days. Only `scored` exists for
-- these rows (raw factors were never stored). Touches rows where factors are missing only.
UPDATE signal_outcomes
   SET factors_json = (SELECT json_object('scored', json(s.factors_json)) FROM signals s
                        WHERE s.address = signal_outcomes.address AND s.time = signal_outcomes.event_time)
 WHERE factors_json IS NULL
   AND EXISTS (SELECT 1 FROM signals s WHERE s.address = signal_outcomes.address AND s.time = signal_outcomes.event_time);

UPDATE signal_events
   SET metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.factors',
         (SELECT json_object('scored', json(s.factors_json)) FROM signals s
           WHERE s.address = signal_events.address AND s.time = signal_events.time))
 WHERE json_type(metadata_json, '$.factors') IS NULL
   AND id NOT IN (SELECT event_id FROM signal_outcomes)
   AND EXISTS (SELECT 1 FROM signals s WHERE s.address = signal_events.address AND s.time = signal_events.time);
