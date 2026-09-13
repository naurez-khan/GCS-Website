const test = require("node:test");
const assert = require("node:assert/strict");

const {
    ROWS_PER_PAGE,
    buildLectureStatementSpec,
    createLectureStatementPdf
} = require("../lib/lectureStatementPdf");

const students = [
    { id: 1, roll_number: 10 },
    { id: 2, roll_number: 2 },
    { id: 3, roll_number: 11 }
];

const records = [
    { student_id: 1, attendance_date: "2026-09-01", status: "present" },
    { student_id: 2, attendance_date: "2026-09-01", status: "absent" },
    { student_id: 3, attendance_date: "2026-09-01", status: "leave" },
    { student_id: 1, attendance_date: "2026-09-02", status: "absent" },
    { student_id: 2, attendance_date: "2026-09-02", status: "present" },
    { student_id: 3, attendance_date: "2026-09-02", status: "present" }
];

test("uses course code and the selected Bachelors roll-number column", () => {
    const spec = buildLectureStatementSpec({
        course: {
            name: "Graph Theory",
            course_code: "MATH-804",
            class_type: "bachelors",
            program: "BS Mathematics",
            semester: "7",
            class_shift: "Morning",
            roll_number_type: "pu"
        },
        students,
        records,
        teacherName: "Ali Ahmed",
        fromDate: "2026-09-01",
        toDate: "2026-09-02"
    });

    assert.equal(spec.courseCodeOrSubject, "MATH-804");
    assert.equal(spec.delivered, 2);
    assert.deepEqual(spec.rows.map(row => row.puRollNumber), ["2", "10", "11"]);
    assert.deepEqual(spec.rows.map(row => row.collegeRollNumber), ["", "", ""]);
    assert.deepEqual(spec.rows[0], {
        puRollNumber: "2",
        collegeRollNumber: "",
        attended: 1,
        absent: 1,
        percentage: "50.0%"
    });
});

test("always puts Intermediate rolls in College Roll No. and uses the subject", () => {
    const spec = buildLectureStatementSpec({
        course: {
            name: "Mathematics",
            course_code: "MATH-101",
            class_type: "intermediate",
            intermediate_year: "1st Year",
            section: "A",
            class_shift: "Morning",
            roll_number_type: "pu"
        },
        students,
        records,
        fromDate: "2026-09-01",
        toDate: "2026-09-02"
    });

    assert.equal(spec.courseCodeOrSubject, "Mathematics");
    assert.equal(spec.rollNumberType, "government_college");
    assert.deepEqual(spec.rows.map(row => row.puRollNumber), ["", "", ""]);
    assert.deepEqual(spec.rows.map(row => row.collegeRollNumber), ["2", "10", "11"]);
});

test("counts leave as attended and missing saved-day entries as absent", () => {
    const spec = buildLectureStatementSpec({
        course: { class_type: "bachelors", roll_number_type: "government_college" },
        students,
        records: records.filter(record => !(record.student_id === 3 && record.attendance_date === "2026-09-02")),
        fromDate: "2026-09-01",
        toDate: "2026-09-02"
    });

    const roll11 = spec.rows.find(row => row.collegeRollNumber === "11");
    assert.equal(roll11.attended, 1);
    assert.equal(roll11.absent, 1);
    assert.equal(roll11.percentage, "50.0%");
});

test("calculates the statement only between the selected From and To dates", () => {
    const spec = buildLectureStatementSpec({
        course: { class_type: "bachelors", roll_number_type: "pu" },
        students,
        records,
        fromDate: "2026-09-02",
        toDate: "2026-09-02"
    });

    assert.equal(spec.startDate, "2026-09-02");
    assert.equal(spec.endDate, "2026-09-02");
    assert.equal(spec.delivered, 1);
    assert.equal(spec.rows.find(row => row.puRollNumber === "10").absent, 1);
    assert.equal(spec.rows.find(row => row.puRollNumber === "2").attended, 1);
});

test("creates a valid multi-page PDF buffer for large classes", async () => {
    const manyStudents = Array.from({ length: ROWS_PER_PAGE + 1 }, (_, index) => ({
        id: index + 1,
        roll_number: index + 100
    }));
    const manyRecords = manyStudents.map(student => ({
        student_id: student.id,
        attendance_date: "2026-09-01",
        status: "present"
    }));
    const spec = buildLectureStatementSpec({
        course: { name: "Calculus", course_code: "MATH-401", class_type: "bachelors" },
        students: manyStudents,
        records: manyRecords
    });
    const buffer = await createLectureStatementPdf(spec);

    assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
    assert.ok(buffer.length > 5000);
    assert.match(buffer.toString("latin1"), /\/Count 2/);
});
