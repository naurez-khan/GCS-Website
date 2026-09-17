ALTER TABLE attendance_audit_logs
    ALTER COLUMN changed_by DROP NOT NULL;

ALTER TABLE attendance_audit_logs
    DROP CONSTRAINT IF EXISTS attendance_audit_logs_changed_by_fkey;

ALTER TABLE attendance_audit_logs
    ADD CONSTRAINT attendance_audit_logs_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE course_holidays
    ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE course_holidays
    DROP CONSTRAINT IF EXISTS course_holidays_created_by_fkey;

ALTER TABLE course_holidays
    ADD CONSTRAINT course_holidays_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
