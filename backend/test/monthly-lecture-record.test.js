const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMonthlyLectureRecordSpec, createMonthlyLectureRecordPdf } = require("../lib/monthlyLectureRecordPdf");

const lectures = [
    {
        attendance_date: "2026-10-01",
        period_number: 1,
        course_id: 10,
        name: "Calculus",
        class_type: "bachelors",
        program: "BS Mathematics",
        semester: "3",
        section: "A"
    },
    {
        attendance_date: "2026-10-15",
        period_number: 1,
        course_id: 20,
        name: "Linear Algebra",
        class_type: "bachelors",
        program: "BS Mathematics",
        semester: "1",
        section: "B"
    },
    {
        attendance_date: "2026-10-15",
        period_number: 3,
        course_id: 10,
        name: "Calculus",
        class_type: "bachelors",
        program: "BS Mathematics",
        semester: "3",
        section: "A"
    }
];

test("keeps timetable changes on their effective lecture dates", () => {
    const spec = buildMonthlyLectureRecordSpec({
        teacherName: "Example Teacher",
        month: "2026-10",
        shift: "morning",
        lectures
    });

    assert.equal(spec.classCount, 2);
    assert.equal(spec.totalLectures, 3);
    assert.equal(spec.rows[0].periods[0].className, "BS Mathematics");
    assert.equal(spec.rows[0].periods[2], null);
    assert.equal(spec.rows[1].periods[0].section, "1");
    assert.equal(spec.rows[1].periods[2].section, "3");
});

test("uses Intermediate year as class and only its section in Sec/Sem", () => {
    const spec = buildMonthlyLectureRecordSpec({
        teacherName: "Example Teacher",
        month: "2026-10",
        shift: "morning",
        lectures: [{
            attendance_date: "2026-10-02",
            period_number: 2,
            course_id: 30,
            name: "Mathematics",
            class_type: "intermediate",
            intermediate_year: "2nd_year",
            section: "C2"
        }]
    });

    assert.equal(spec.rows[0].periods[1].className, "2nd Year");
    assert.equal(spec.rows[0].periods[1].section, "C2");
});

test("creates a valid one-page monthly lecture record PDF", async () => {
    const spec = buildMonthlyLectureRecordSpec({
        teacherName: "Example Teacher",
        month: "2026-10",
        shift: "morning",
        lectures
    });
    const pdf = await createMonthlyLectureRecordPdf(spec);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 10000);
});
