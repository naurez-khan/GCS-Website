require("dotenv").config();
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const app = require("../server");

(async () => {
    const courseResult = await pool.query(
        `SELECT c.id, c.teacher_id FROM courses c
         JOIN users u ON u.id = c.teacher_id
         WHERE u.role = 'teacher' ORDER BY c.id LIMIT 1`
    );
    if (!courseResult.rows.length) throw new Error("Create at least one teacher course before checking protected APIs");
    const course = courseResult.rows[0];
    const token = jwt.sign({ id: course.teacher_id, role: "teacher" }, process.env.JWT_SECRET, { expiresIn: "5m" });
    const server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = (path, options = {}) => fetch(`${origin}${path}`, {
        ...options,
        headers: { Cookie: `token=${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
    });

    try {
        const checks = [
            ["course", await request(`/api/courses/${course.id}/students`), 200],
            ["audit", await request(`/api/attendance/course/${course.id}/audit/log`), 200],
            ["import validation", await request(`/api/courses/${course.id}/students/import`, { method: "POST", body: JSON.stringify({ students: [] }) }), 400],
            ["settings validation", await request(`/api/courses/${course.id}/settings`, { method: "PUT", body: JSON.stringify({ name: "" }) }), 400],
            ["attendance validation", await request(`/api/attendance/course/${course.id}/invalid-date`, { method: "PUT", body: JSON.stringify({ absentStudentIds: [] }) }), 400]
        ];
        for (const [name, response, expected] of checks) {
            if (response.status !== expected) throw new Error(`${name} returned ${response.status}; expected ${expected}`);
        }
        console.log("Protected course, attendance-audit, settings, and import routes passed live checks.");
    } finally {
        await new Promise(resolve => server.close(resolve));
        await pool.end();
    }
})().catch(async error => {
    console.error(`Live API check failed: ${error.message}`);
    process.exitCode = 1;
});
