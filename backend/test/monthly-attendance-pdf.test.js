const test = require("node:test");
const assert = require("node:assert/strict");

const {
    ROWS_PER_PAGE,
    buildMonthlyAttendancePdfSpec,
    createMonthlyAttendancePdf
} = require("../lib/monthlyAttendancePdf");

test("calculates the Theory T columns while leaving P columns available and empty", () => {
    const spec = buildMonthlyAttendancePdfSpec({
        selectedMonth: "2026-09",
        course: { class_type: "bachelors", program: "BS Mathematics", semester: "5", name: "Calculus", course_code: "MATH-501" },
        students: [{ id: 1, roll_number: "101" }],
        records: [
            { student_id: 1, attendance_date: "2026-07-01", status: "present" },
            { student_id: 1, attendance_date: "2026-08-01", status: "present" },
            { student_id: 1, attendance_date: "2026-08-02", status: "absent" },
            { student_id: 1, attendance_date: "2026-09-01", status: "present" },
            { student_id: 1, attendance_date: "2026-09-02", status: "leave" },
            { student_id: 1, attendance_date: "2026-09-03", status: "absent" }
        ],
        holidays: [{ holiday_date: "2026-09-04", name: "Public Holiday" }]
    });

    assert.deepEqual(spec.lectureCounts, {
        currentTheory: 2,
        broughtForwardTheory: 3,
        totalTheory: 5
    });
    assert.deepEqual(spec.rows[0].days.slice(0, 4), ["P", "L", "A", ""]);
    assert.equal(spec.rows[0].periodsAttended.theory, 2);
    assert.equal(spec.rows[0].periodsBroughtForward.theory, 2);
    assert.equal(spec.rows[0].totalPeriods.theory, 4);
    assert.equal(Object.hasOwn(spec.rows[0], "periodsPresent"), false);
    assert.ok(spec.excludedDays.includes(4));
    assert.ok(spec.excludedDays.includes(6));
});

test("creates an A4 landscape PDF with no more than 25 students per page", async () => {
    const students = Array.from({ length: ROWS_PER_PAGE + 1 }, (_, index) => ({ id: index + 1, roll_number: index + 100 }));
    const records = students.map(student => ({ student_id: student.id, attendance_date: "2026-09-01", status: "present" }));
    const spec = buildMonthlyAttendancePdfSpec({ selectedMonth: "2026-09", course: { name: "Calculus" }, students, records });
    const buffer = await createMonthlyAttendancePdf(spec);

    assert.equal(ROWS_PER_PAGE, 25);
    assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
    assert.ok(buffer.length > 5000);
    assert.match(buffer.toString("latin1"), /\/Count 2/);
    assert.match(buffer.toString("latin1"), /\/MediaBox \[0 0 841\.89 595\.28\]/);
});
