const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { HEADERS, buildAwardListSpec, createWorkbook, studentRow } = require("../../frontend/award-list");

const students = [
    { roll_number: "102", midterm_marks: 18, final_marks: 12 },
    { roll_number: "101", midterm_marks: 20, final_marks: 14 }
];

test("uses the award-list column names from the supplied register", () => {
    assert.deepEqual(HEADERS, ["Sr. No.", "PU Roll No.", "College Roll No.", "Mid Obt. Marks", "Sessional Obt. Marks"]);
});

test("places each roll number in only the selected roll-number column", () => {
    assert.deepEqual(studentRow(students[0], 1, "pu"), [1, "102", null, 18, 12]);
    assert.deepEqual(studentRow(students[0], 1, "government_college"), [1, null, "102", 18, 12]);
});

test("creates a printable award list workbook that survives an Excel round trip", async () => {
    const spec = buildAwardListSpec({
        students,
        course: { name: "Graph Theory", course_code: "MATH-804", program: "BS Mathematics", semester: "5", roll_number_type: "pu", midterm_max_marks: 25 },
        teacherName: "Ali Ahmed"
    });
    const workbook = createWorkbook(ExcelJS, spec);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reopened.getWorksheet("Award List");
    assert.equal(sheet.getCell("A1").value, "Govt.Graduate College Civil Lines Sheikhupura");
    assert.equal(sheet.getCell("A2").value, "Award List");
    assert.equal(sheet.getCell("K2").master.address, "A2");
    assert.equal(sheet.getCell("A2").alignment.horizontal, "center");
    assert.equal(sheet.getCell("A4").value, "BS (Discipline):");
    assert.equal(sheet.getCell("A5").value, "Subject Code:");
    assert.equal(sheet.getCell("C5").value, "MATH-804");
    assert.equal(sheet.getCell("B6").value, "PU Roll No.");
    assert.equal(sheet.getCell("C6").value, "College Roll No.");
    assert.equal(sheet.getCell("B7").value, "101");
    assert.equal(sheet.getCell("C7").value, null);
    assert.equal(sheet.getCell("E7").value, 14);
    assert.equal(sheet.getCell("A31").value, 25);
    assert.equal(sheet.getCell("G31").value, 50);
    assert.equal(sheet.pageSetup.printArea, "A1:K32");
});
