ALTER TABLE users
    ADD COLUMN IF NOT EXISTS can_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET can_admin = TRUE
WHERE role = 'admin' AND can_admin = FALSE;
