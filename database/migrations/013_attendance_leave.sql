ALTER TABLE attendance
    DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance
    ADD CONSTRAINT attendance_status_check CHECK (status IN ('present', 'absent', 'leave'));

ALTER TABLE attendance_audit_logs
    DROP CONSTRAINT IF EXISTS attendance_audit_logs_old_status_check;
ALTER TABLE attendance_audit_logs
    DROP CONSTRAINT IF EXISTS attendance_audit_logs_new_status_check;
ALTER TABLE attendance_audit_logs
    ADD CONSTRAINT attendance_audit_logs_old_status_check CHECK (old_status IN ('present', 'absent', 'leave'));
ALTER TABLE attendance_audit_logs
    ADD CONSTRAINT attendance_audit_logs_new_status_check CHECK (new_status IN ('present', 'absent', 'leave'));
