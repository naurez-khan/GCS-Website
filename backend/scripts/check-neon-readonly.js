const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.resolve(__dirname, "../.env.neon"), override: true, quiet: true });

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("No Neon connection string was found in backend/.env.neon");
}

(async () => {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const migrations = await client.query(
            "SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 5"
        );
        const columns = await client.query(
            `SELECT table_name, column_name, is_nullable
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND (
                    (table_name = 'courses' AND column_name IN ('class_tests_enabled', 'class_test_count'))
                    OR (table_name = 'assignments' AND column_name = 'assessment_type')
                    OR (table_name = 'students' AND column_name = 'deleted_at')
                    OR (table_name = 'attendance_audit_logs' AND column_name = 'changed_by')
                    OR (table_name = 'course_holidays' AND column_name = 'created_by')
               )
             ORDER BY table_name, column_name`
        );
        const counts = await client.query(
            `SELECT
                (SELECT COUNT(*) FROM courses)::integer AS courses,
                (SELECT COUNT(*) FROM students)::integer AS students,
                (SELECT COUNT(*) FROM attendance)::integer AS attendance`
        );

        console.log(JSON.stringify({
            host: new URL(connectionString).hostname,
            migrations: migrations.rows,
            columns: columns.rows,
            counts: counts.rows[0]
        }, null, 2));
    } finally {
        await client.end();
    }
})().catch(error => {
    console.error(`Neon check failed: ${error.message}`);
    process.exitCode = 1;
});
