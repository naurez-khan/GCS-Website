const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildAbsentStudentsPdfSpec,
    createAbsentStudentsPdf
} = require("../lib/absentStudentsPdf");

test("builds the PDF from the same date groups and sorted rolls as the Excel register", () => {
    const spec = buildAbsentStudentsPdfSpec({
        course: {
            name: "Calculus",
            class_type: "bachelors",
            program: "BS Mathematics",
            semester: "7"
        },
        teacherName: "Ali Ahmed",
        students: [
            { id: 1, roll_number: 10 },
            { id: 2, roll_number: 2 },
            { id: 3, roll_number: 11 }
        ],
        records: [
            { student_id: 1, attendance_date: "2026-09-01", status: "absent" },
            { student_id: 2, attendance_date: "2026-09-01", status: "absent" },
            { student_id: 3, attendance_date: "2026-09-01", status: "present" },
            { student_id: 1, attendance_date: "2026-09-02", status: "present" }
        ],
        fromDate: "2026-09-01",
        toDate: "2026-09-02"
    });

    assert.equal(spec.filename, "Calculus_Absent_Students_2026-09-01_to_2026-09-02.pdf");
    assert.deepEqual(spec.recordedDates, ["2026-09-01", "2026-09-02"]);
    assert.deepEqual(spec.sheets[0].absentRolls, [["2", "10"], []]);
});

test("creates a valid multi-page absent-students PDF", async () => {
    const students = Array.from({ length: 69 }, (_, index) => ({
        id: index + 1,
        roll_number: index + 100
    }));
    const records = students.map(student => ({
        student_id: student.id,
        attendance_date: "2026-09-01",
        status: "absent"
    }));
    const spec = buildAbsentStudentsPdfSpec({
        course: { name: "Calculus", class_type: "bachelors" },
        students,
        records,
        fromDate: "2026-09-01",
        toDate: "2026-09-01"
    });
    const buffer = await createAbsentStudentsPdf(spec);

    assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
    assert.ok(buffer.length > 5000);
    assert.ok(buffer.toString("latin1").includes("/Count 2"));
});
