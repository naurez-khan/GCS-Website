CREATE TABLE IF NOT EXISTS course_holidays (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    name VARCHAR(150) NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS course_holidays_course_date_idx
    ON course_holidays(course_id, holiday_date);

