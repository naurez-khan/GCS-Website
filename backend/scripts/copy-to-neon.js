require("dotenv").config({ quiet: true });

const { readFileSync } = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

const tables = [
    "users",
    "courses",
    "students",
    "attendance",
    "attendance_audit_logs",
    "assignments",
    "quizzes",
    "assignment_marks",
    "quiz_marks"
];

function identifier(value) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
        throw new Error(`Unsafe SQL identifier: ${value}`);
    }
    return `"${value}"`;
}

function getNeonUrl() {
    if (process.env.NEON_DATABASE_URL) {
        return process.env.NEON_DATABASE_URL.trim();
    }

    const envPath = path.resolve(__dirname, "../.env.neon");
    try {
        const values = dotenv.parse(readFileSync(envPath));
        return String(values.DATABASE_URL || "").trim();
    } catch (error) {
        if (error.code === "ENOENT") {
            throw new Error("Create backend/.env.neon and add DATABASE_URL=<your pooled Neon connection string>");
        }
        throw error;
    }
}

function createLocalPool() {
    return new Pool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        max: 1
    });
}

function createNeonPool() {
    const connectionString = getNeonUrl();
    if (!connectionString) {
        throw new Error("DATABASE_URL is missing from backend/.env.neon");
    }
    if (!connectionString.includes("sslmode=")) {
        throw new Error("Use the complete Neon connection string containing sslmode=require");
    }
    return new Pool({
        connectionString,
        max: 1,
        connectionTimeoutMillis: 15000
    });
}

async function counts(client) {
    const result = {};
    for (const table of tables) {
        const response = await client.query(`SELECT COUNT(*)::int AS count FROM ${identifier(table)}`);
        result[table] = response.rows[0].count;
    }
    return result;
}

async function insertRows(client, table, rows) {
    if (!rows.length) return;

    const columns = Object.keys(rows[0]);
    const quotedColumns = columns.map(identifier).join(", ");
    const batchSize = 100;

    for (let offset = 0; offset < rows.length; offset += batchSize) {
        const batch = rows.slice(offset, offset + batchSize);
        const values = [];
        const placeholders = batch.map(row => {
            const rowPlaceholders = columns.map(column => {
                values.push(row[column]);
                return `$${values.length}`;
            });
            return `(${rowPlaceholders.join(", ")})`;
        });

        await client.query(
            `INSERT INTO ${identifier(table)} (${quotedColumns}) VALUES ${placeholders.join(", ")}`,
            values
        );
    }
}

async function supplyMissingMaxMarks(local, table, rows) {
    const markSources = {
        assignments: { table: "assignment_marks", foreignKey: "assignment_id" },
        quizzes: { table: "quiz_marks", foreignKey: "quiz_id" }
    };
    const source = markSources[table];
    if (!source) return rows;

    const commonMaximums = [10, 20, 25, 50, 100, 200, 500, 1000];
    for (const row of rows) {
        if (row.max_marks !== null && row.max_marks !== undefined) continue;

        const result = await local.query(
            `SELECT MAX(marks)::numeric AS highest FROM ${identifier(source.table)} WHERE ${identifier(source.foreignKey)} = $1`,
            [row.id]
        );
        const highest = Number(result.rows[0].highest || 0);
        row.max_marks = commonMaximums.find(maximum => maximum >= highest)
            || Math.ceil(highest / 100) * 100
            || 10;
        console.log(`Using ${row.max_marks} maximum marks for legacy ${table} record ${row.id}`);
    }
    return rows;
}

async function updateSequence(client, table) {
    await client.query(`
        SELECT setval(
            pg_get_serial_sequence('${table}', 'id'),
            COALESCE((SELECT MAX(id) FROM ${identifier(table)}), 1),
            EXISTS(SELECT 1 FROM ${identifier(table)})
        )
    `);
}

(async () => {
    const localPool = createLocalPool();
    const neonPool = createNeonPool();
    const local = await localPool.connect();
    const neon = await neonPool.connect();

    try {
        const localCounts = await counts(local);
        const neonCounts = await counts(neon);
        const occupied = Object.entries(neonCounts).filter(([, count]) => count > 0);

        if (occupied.length) {
            const description = occupied.map(([table, count]) => `${table}: ${count}`).join(", ");
            throw new Error(`Neon already contains portal records (${description}). No data was changed.`);
        }

        await neon.query("BEGIN");
        for (const table of tables) {
            const rows = await supplyMissingMaxMarks(
                local,
                table,
                (await local.query(`SELECT * FROM ${identifier(table)} ORDER BY id`)).rows
            );
            await insertRows(neon, table, rows);
            await updateSequence(neon, table);
            console.log(`Copied ${rows.length} row(s) into ${table}`);
        }
        await neon.query("COMMIT");

        const copiedCounts = await counts(neon);
        if (JSON.stringify(localCounts) !== JSON.stringify(copiedCounts)) {
            throw new Error("Copy finished, but the verification counts do not match");
        }

        console.log("Neon data migration completed and verified.");
    } catch (error) {
        try {
            await neon.query("ROLLBACK");
        } catch (_) {
            // The connection may have closed before a transaction began.
        }
        throw error;
    } finally {
        local.release();
        neon.release();
        await localPool.end();
        await neonPool.end();
    }
})().catch(error => {
    console.error(`Neon copy failed: ${error.message}`);
    process.exitCode = 1;
});
