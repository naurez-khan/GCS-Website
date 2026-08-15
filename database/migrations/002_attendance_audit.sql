CREATE TABLE IF NOT EXISTS attendance_audit_logs (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    old_status VARCHAR(10) NOT NULL CHECK (old_status IN ('present', 'absent')),
    new_status VARCHAR(10) NOT NULL CHECK (new_status IN ('present', 'absent')),
    changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS attendance_audit_course_date_idx
    ON attendance_audit_logs(course_id, attendance_date, changed_at DESC);
