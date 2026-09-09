const test = require("node:test");
const assert = require("node:assert/strict");
const { backfillStudentAbsences } = require("../services/attendanceBackfill");

test("backfills new students as absent only on saved lecture dates", async () => {
    let executed;
    const client = {
        async query(sql, params) {
            executed = { sql, params };
            return { rowCount: 6 };
        }
    };

    const count = await backfillStudentAbsences(client, 47, [12, 13, 12]);

    assert.equal(count, 6);
    assert.deepEqual(executed.params, [47, [12, 13]]);
    assert.match(executed.sql, /SELECT DISTINCT attendance_date/);
    assert.match(executed.sql, /status IN \('present', 'absent'\)/);
    assert.match(executed.sql, /EXTRACT\(DOW FROM attendance_date\) <> 0/);
    assert.match(executed.sql, /course_holidays\.holiday_date = attendance\.attendance_date/);
    assert.match(executed.sql, /ON CONFLICT DO NOTHING/);
});

test("does nothing when no new student ids are supplied", async () => {
    let queryCount = 0;
    const client = { async query() { queryCount += 1; } };

    const count = await backfillStudentAbsences(client, 47, []);

    assert.equal(count, 0);
    assert.equal(queryCount, 0);
});
