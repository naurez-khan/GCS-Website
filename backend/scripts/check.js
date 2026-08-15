const { execFileSync } = require("node:child_process");
const { readdirSync, readFileSync, statSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const ignored = new Set(["node_modules", ".git"]);

function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (ignored.has(entry.name)) return [];
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(fullPath) : [fullPath];
    });
}

const jsFiles = walk(root).filter(file => file.endsWith(".js"));
for (const file of jsFiles) {
    execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

const schemaPath = path.join(root, "database", "schema.sql");
if (!statSync(schemaPath).isFile()) throw new Error("database/schema.sql is missing");
const schema = readFileSync(schemaPath, "utf8");
for (const table of ["users", "courses", "students", "attendance", "attendance_audit_logs", "assignments", "quizzes", "assignment_marks", "quiz_marks"]) {
    if (!schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
        throw new Error(`Schema is missing the ${table} table`);
    }
}

console.log(`Checked ${jsFiles.length} JavaScript files and the database schema.`);
