CREATE TABLE IF NOT EXISTS teacher_period_assignments (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    class_shift VARCHAR(10) NOT NULL CHECK (class_shift IN ('morning', 'evening')),
    period_number INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 7),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS teacher_period_assignments_lookup_idx
    ON teacher_period_assignments (teacher_id, class_shift, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS teacher_period_assignments_course_idx
    ON teacher_period_assignments (course_id, effective_from, effective_to);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_period_assignments_start_period_unique
    ON teacher_period_assignments (teacher_id, class_shift, effective_from, period_number);
