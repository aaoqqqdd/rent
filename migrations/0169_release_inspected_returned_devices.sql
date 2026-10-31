-- 修正已完成正常归还验机、却仍停留在 RETURNED 的历史设备。
-- 维护、损坏、未完成租赁和缺少有效验机记录的设备不自动释放。
INSERT OR IGNORE INTO device_lifecycle_events (id, device_id, order_id, previous_status, next_status, reason)
SELECT 'dle-auto-return-' || d.id, d.id, o.id, 'RETURNED', 'READY', '归还验机完成'
FROM devices d
JOIN device_inspections i ON i.id = (
  SELECT latest.id FROM device_inspections latest
  WHERE latest.device_id = d.id AND latest.inspection_type = 'after_return' AND latest.deleted_at IS NULL
  ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1
)
JOIN orders o ON o.id = i.rental_id AND o.deviceId = d.id AND o.status = 'completed' AND o.deleted_at IS NULL
WHERE d.deleted_at IS NULL AND d.lifecycle_status = 'RETURNED'
  AND CASE WHEN json_valid(i.snapshot_json)
    THEN COALESCE(TRIM(json_extract(i.snapshot_json, '$.damageDescription')), '') = '' ELSE 0 END
  AND NOT EXISTS (
    SELECT 1 FROM orders active WHERE active.deviceId = d.id AND active.deleted_at IS NULL
      AND active.status IN ('paid', 'pending_pickup', 'active', 'extended', 'overdue', 'suspended', 'pending_return', 'returned')
  )
  AND NOT EXISTS (
    SELECT 1 FROM maintenance_records m WHERE m.device_id = d.id
      AND m.status IN ('OPEN', 'IN_PROGRESS', 'DATA_CLEAN', 'SYSTEM_RESET', 'CLIENT_CHECK')
  )
  AND NOT EXISTS (
    SELECT 1 FROM damage_cases damage WHERE damage.device_id = d.id AND damage.status NOT IN ('RESOLVED', 'WAIVED')
  );

UPDATE devices SET lifecycle_status = 'READY', status = 'available', updatedAt = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL AND lifecycle_status = 'RETURNED'
  AND EXISTS (SELECT 1 FROM device_lifecycle_events e WHERE e.device_id = devices.id AND e.id = 'dle-auto-return-' || devices.id);
