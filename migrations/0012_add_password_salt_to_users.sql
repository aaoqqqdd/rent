-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

-- migrations/0012_add_password_salt_to_users.sql
ALTER TABLE users ADD COLUMN password_salt TEXT;
