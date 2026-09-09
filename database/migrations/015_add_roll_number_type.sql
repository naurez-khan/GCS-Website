ALTER TABLE courses
ADD COLUMN IF NOT EXISTS roll_number_type VARCHAR(30) NOT NULL DEFAULT 'pu';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_roll_number_type_check') THEN
        ALTER TABLE courses ADD CONSTRAINT courses_roll_number_type_check
            CHECK (roll_number_type IN ('pu', 'government_college'));
    END IF;
END $$;
