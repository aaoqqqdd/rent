-- P1.4 设备维护生命周期：补齐维护记录字段（更换部件、数据清除方式、维修说明、失败原因）。
-- 完善.md §15/§16：维护记录需保存维修说明、维修成本、更换部件；数据清除需保存方式与结果。
ALTER TABLE maintenance_records ADD COLUMN replacement_parts TEXT;
ALTER TABLE maintenance_records ADD COLUMN data_wipe_method TEXT;
ALTER TABLE maintenance_records ADD COLUMN repair_notes TEXT;
ALTER TABLE maintenance_records ADD COLUMN failure_reason TEXT;
