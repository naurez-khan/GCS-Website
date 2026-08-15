require("dotenv").config();
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const pool = require("../config/db");

(async () => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const directory = path.resolve(__dirname, "../../database/migrations");
        const files = readdirSync(directory).filter(file => file.endsWith(".sql")).sort();

        for (const file of files) {
            const found = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
            if (found.rows.length) continue;
            await client.query(readFileSync(path.join(directory, file), "utf8"));
            await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
            console.log(`Applied ${file}`);
        }

        await client.query("COMMIT");
        console.log("Database migrations are up to date.");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
})().catch(error => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
});
