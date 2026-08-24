const test = require("node:test");
const assert = require("node:assert/strict");

const { buildMonthlyAttendanceRegister, attendanceStatusColor } = require("../../frontend/attendance-register");

const students = [
    { id: 1, roll_number: "101", name: "Student One" },
    { id: 2, roll_number: "102", name: "Student Two" }
];

const records = [
    { student_id: 1, attendance_date: "2026-06-01", status: "present" },
    { student_id: 1, attendance_date: "2026-07-01", status: "absent" },
    { student_id: 1, attendance_date: "2026-08-01", status: "present" },
    { student_id: 1, attendance_date: "2026-08-02", status: "absent" },
    { student_id: 2, attendance_date: "2026-08-01", status: "present" }
];

test("matches the printed register column order", () => {
    const spec = buildMonthlyAttendanceRegister({ students, records, selectedMonth: "2026-08", course: { name: "Calculus" } });
    assert.equal(spec.ranges.dailyStart, 1);
    assert.equal(spec.ranges.dailyEnd, 31);
    assert.equal(spec.ranges.practicalStart, 32);
    assert.equal(spec.ranges.practicalEnd + 1, spec.ranges.currentStart);
    assert.equal(spec.ranges.currentEnd + 1, spec.ranges.broughtForwardStart);
    assert.equal(spec.ranges.broughtForwardEnd + 1, spec.ranges.totalStart);
    assert.equal(spec.ranges.totalEnd + 1, spec.ranges.remarksColumn);
    assert.deepEqual(spec.previousMonths, ["2026-06", "2026-07"]);
    assert.equal(spec.rows[5][spec.ranges.currentStart], "Periods\nAttended\nT");
    assert.equal(spec.rows[5][spec.ranges.broughtForwardStart], "Periods\nB.F.\nT");
    assert.equal(spec.rows[5][spec.ranges.totalStart], "Total Periods\nAttended\nT");
});

test("always provides 31 daily columns and formula-driven totals", () => {
    const spec = buildMonthlyAttendanceRegister({ students, records, selectedMonth: "2026-02", course: { name: "Calculus" } });
    assert.equal(spec.ranges.dailyEnd - spec.ranges.dailyStart + 1, 31);
    assert.equal(spec.daysInMonth, 28);
    assert.equal(spec.rows[6][spec.ranges.dailyStart + 28], "");
    assert.match(spec.rows[6][spec.ranges.currentStart].f, /^COUNTIF\(/);
    assert.equal(spec.columns.length, spec.ranges.lastColumn + 1);
});

test("calculates current, brought-forward, and total attendance", () => {
    const spec = buildMonthlyAttendanceRegister({ students, records, selectedMonth: "2026-08", course: { name: "Calculus" } });
    assert.equal(spec.rows[6][spec.ranges.currentStart].v, 1);
    assert.equal(spec.rows[6][spec.ranges.broughtForwardStart].v, 1);
    assert.equal(spec.rows[6][spec.ranges.totalStart].v, 2);
    assert.equal(spec.lectureCounts.currentTheory, 2);
    assert.equal(spec.lectureCounts.broughtForwardTheory, 2);
    assert.equal(spec.lectureCounts.totalTheory, 4);
});

test("uses Intermediate class details in the printed header", () => {
    const spec = buildMonthlyAttendanceRegister({ students, records, selectedMonth: "2026-08", course: { class_type: "intermediate", intermediate_year: "1st Year", section: "C1", name: "Algebra", course_code: "MTH-101" } });
    assert.equal(spec.rows[0][0], "Class 1st Year");
    assert.equal(spec.rows[0][6], "Section/Sem C1");
    assert.equal(spec.rows[0][14], "Subject Mathematics");
    assert.equal(spec.rows[0][23], "Paper ____________");
});

test("uses BS program and course details in the printed header", () => {
    const spec = buildMonthlyAttendanceRegister({ students, records, selectedMonth: "2026-08", course: { class_type: "bachelors", program: "BS Mathematics", semester: "5", section: "A", name: "Graph Theory", course_code: "MATH-804" } });
    assert.equal(spec.rows[0][0], "Class BS Mathematics");
    assert.equal(spec.rows[0][6], "Section/Sem 5");

test("uses distinct Excel font colors for attendance statuses", () => {
    assert.equal(attendanceStatusColor("P"), "FF2563EB");
    assert.equal(attendanceStatusColor("A"), "FFDC2626");
    assert.equal(attendanceStatusColor("L"), "FF16A34A");
    assert.equal(attendanceStatusColor(""), null);
});
    assert.equal(spec.rows[0][14], "Subject Graph Theory");
    assert.equal(spec.rows[0][23], "Paper MATH-804");
});

test("counts leave as attended and marks it L in the register", () => {
    const leaveRecords = [{ student_id: 1, attendance_date: "2026-08-03", status: "leave" }];
    const spec = buildMonthlyAttendanceRegister({ students: [students[0]], records: leaveRecords, selectedMonth: "2026-08", course: { name: "Calculus" } });
    assert.equal(spec.rows[6][spec.ranges.dailyStart + 2], "L");
    assert.equal(spec.rows[6][spec.ranges.currentStart].v, 1);
    assert.match(spec.rows[6][spec.ranges.currentStart].f, /COUNTIF\(.+,"L"\)/);
});
