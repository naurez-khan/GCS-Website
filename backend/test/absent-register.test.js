const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");

const { buildAbsentStudentsRegister, createWorkbook } = require("../../frontend/absent-register");

const students = [
    { id: 1, roll_number: "10", name: "Ten" },
    { id: 2, roll_number: "2", name: "Two" },
    { id: 3, roll_number: "11", name: "Eleven" }
];

test("exports saved attendance dates and numerically sorted absent rolls", () => {
    const records = [
        { student_id: 1, attendance_date: "2026-09-01", status: "absent" },
        { student_id: 2, attendance_date: "2026-09-01", status: "absent" },
        { student_id: 3, attendance_date: "2026-09-01", status: "present" },
        { student_id: 1, attendance_date: "2026-09-02", status: "leave" },
        { student_id: 2, attendance_date: "2026-09-03", status: "present" },
        { student_id: 3, attendance_date: "2026-09-03", status: "leave" }
    ];

    const spec = buildAbsentStudentsRegister({
        students,
        records,
        course: { name: "Calculus" },
        fromDate: "2026-09-01",
        toDate: "2026-09-03"
    });

    assert.deepEqual(spec.recordedDates, ["2026-09-01", "2026-09-03"]);
    assert.deepEqual(spec.sheets[0].absentRolls[0], ["2", "10"]);
    assert.deepEqual(spec.sheets[0].absentRolls[1], []);
    assert.equal(spec.sheets[0].rows[0][0], "2");
    assert.equal(spec.sheets[0].rows[0][1], "10");
});

test("splits long date ranges into printable groups of five dates", () => {
    const records = Array.from({ length: 12 }, (_, index) => ({
        student_id: 1,
        attendance_date: `2026-09-${String(index + 1).padStart(2, "0")}`,
        status: index % 2 ? "present" : "absent"
    }));
    const spec = buildAbsentStudentsRegister({
        students,
        records,
        course: { name: "Graph Theory" },
        fromDate: "2026-09-01",
        toDate: "2026-09-12"
    });

    assert.deepEqual(spec.sheets.map(sheet => sheet.dates.length), [5, 5, 2]);
    assert.deepEqual(spec.sheets.map(sheet => sheet.name), ["Absent 1", "Absent 2", "Absent 3"]);
});

test("uses the correct class and section fields", () => {
    const records = [{ student_id: 1, attendance_date: "2026-09-01", status: "present" }];
    const intermediate = buildAbsentStudentsRegister({
        students,
        records,
        course: { name: "Mathematics", class_type: "intermediate", intermediate_year: "1st Year", section: "C1" },
        fromDate: "2026-09-01",
        toDate: "2026-09-01"
    });
    const bachelors = buildAbsentStudentsRegister({
        students,
        records,
        course: { name: "Calculus", class_type: "bachelors", program: "BS Mathematics", semester: "5" },
        fromDate: "2026-09-01",
        toDate: "2026-09-01"
    });

    assert.equal(intermediate.className, "1st Year");
    assert.equal(intermediate.section, "C1");
    assert.equal(bachelors.className, "BS Mathematics");
    assert.equal(bachelors.section, "5");
});

test("rejects reversed or empty attendance ranges", () => {
    assert.throws(() => buildAbsentStudentsRegister({
        records: [],
        fromDate: "2026-09-03",
        toDate: "2026-09-01"
    }), /From date/);
    assert.throws(() => buildAbsentStudentsRegister({
        records: [],
        fromDate: "2026-09-01",
        toDate: "2026-09-03"
    }), /No saved attendance/);
});

test("creates a printable workbook that survives an Excel round trip", async () => {
    const records = [
        { student_id: 1, attendance_date: "2026-09-01", status: "absent" },
        { student_id: 2, attendance_date: "2026-09-01", status: "present" }
    ];
    const spec = buildAbsentStudentsRegister({
        students,
        records,
        teacherName: "Ali Ahmed",
        course: { name: "Calculus", class_type: "intermediate", intermediate_year: "1st Year", section: "C1" },
        fromDate: "2026-09-01",
        toDate: "2026-09-01"
    });
    const workbook = createWorkbook(ExcelJS, spec);
    const buffer = await workbook.xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(buffer);
    const sheet = reopened.getWorksheet("Absent Students");

    assert.equal(reopened.worksheets.length, 1);
    assert.equal(sheet.getCell("A1").value, "Govt. Graduate College Civil Lines Sheikhupura");
    assert.equal(sheet.getCell("A2").value, "Name of Teacher Ali Ahmed");
    assert.equal(sheet.getCell("E2").value, "Class 1st Year");
    assert.equal(sheet.getCell("H2").value, "Section C1");
    assert.equal(sheet.getCell("A4").value, "01-09-2026");
    assert.equal(sheet.getCell("A5").value, "10");
    assert.equal(sheet.pageSetup.orientation, "portrait");
    assert.equal(sheet.pageSetup.fitToWidth, 1);
    assert.equal(sheet.views[0].showGridLines, false);
});
