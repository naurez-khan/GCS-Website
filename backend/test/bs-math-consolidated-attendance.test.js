const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createBsMathConsolidatedAttendancePdf,
    compareRollNumbers
} = require("../lib/bsMathConsolidatedAttendancePdf");

test("compareRollNumbers correctly sorts roll numbers numerically and alphabetically", () => {
    const list = ["10", "2", "1", "20", "A-2", "A-10", "A-1"];
    list.sort(compareRollNumbers);
    assert.deepEqual(list, ["1", "2", "10", "20", "A-1", "A-2", "A-10"]);
});

test("createBsMathConsolidatedAttendancePdf generates a valid PDF buffer for BS Mathematics", async () => {
    const spec = {
        semester: "5th",
        section: "A",
        shift: "Morning",
        periodLabel: "October 2026",
        courses: [
            { id: 1, courseCode: "MATH-301", name: "Complex Analysis", teacherName: "Muhammad Waqas", totalLectures: 24 },
            { id: 2, courseCode: "MATH-303", name: "Linear Algebra", teacherName: "Shiraz Khan", totalLectures: 20 },
            { id: 3, courseCode: "MATH-305", name: "Computational Tools", teacherName: "Shiraz Khan", totalLectures: 22 }
        ],
        students: [
            {
                rollNumber: "01",
                name: "Ahmed Ali",
                courses: {
                    1: { present: 22, leave: 1, absent: 1, attended: 23, total: 24, pct: 95.8 },
                    2: { present: 18, leave: 0, absent: 2, attended: 18, total: 20, pct: 90.0 },
                    3: { present: 20, leave: 0, absent: 2, attended: 20, total: 22, pct: 90.9 }
                },
                overall: {
                    totalLectures: 66,
                    totalAttended: 61,
                    percentage: 92.4
                }
            },
            {
                rollNumber: "02",
                name: "Fatima Khan",
                courses: {
                    1: { present: 14, leave: 0, absent: 10, attended: 14, total: 24, pct: 58.3 },
                    2: { present: 12, leave: 1, absent: 7, attended: 13, total: 20, pct: 65.0 },
                    3: { present: 15, leave: 0, absent: 7, attended: 15, total: 22, pct: 68.2 }
                },
                overall: {
                    totalLectures: 66,
                    totalAttended: 42,
                    percentage: 63.6
                }
            }
        ]
    };

    const pdfBuffer = await createBsMathConsolidatedAttendancePdf(spec);
    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 1000);
    // PDF Magic bytes %PDF-
    assert.equal(pdfBuffer.subarray(0, 5).toString("utf8"), "%PDF-");
});
