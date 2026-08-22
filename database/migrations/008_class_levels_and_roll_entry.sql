ALTER TABLE courses
ADD COLUMN IF NOT EXISTS class_type VARCHAR(20) NOT NULL DEFAULT 'bachelors';

ALTER TABLE courses
ADD COLUMN IF NOT EXISTS intermediate_year VARCHAR(20);

ALTER TABLE courses
ADD COLUMN IF NOT EXISTS roll_entry_mode VARCHAR(20) NOT NULL DEFAULT 'range';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_class_type_check') THEN
        ALTER TABLE courses ADD CONSTRAINT courses_class_type_check
            CHECK (class_type IN ('bachelors', 'intermediate'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_intermediate_year_check') THEN
        ALTER TABLE courses ADD CONSTRAINT courses_intermediate_year_check
            CHECK (intermediate_year IS NULL OR intermediate_year IN ('1st_year', '2nd_year'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_roll_entry_mode_check') THEN
        ALTER TABLE courses ADD CONSTRAINT courses_roll_entry_mode_check
            CHECK (roll_entry_mode IN ('range', 'manual', 'excel'));
    END IF;
END $$;
