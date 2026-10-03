const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { HEADERS, INTERMEDIATE_HEADERS, buildAwardListSpec, createWorkbook, studentRow } = require("../../frontend/award-list");
const { buildAwardListPdfSpec, createAwardListPdf } = require("../lib/awardListPdf");

const students = [
    { roll_number: "102", midterm_marks: 18, final_marks: 12 },
    { roll_number: "101", midterm_marks: 20, final_marks: 14 }
];

test("uses the award-list column names from the supplied register", () => {
    assert.deepEqual(HEADERS, ["Sr. No.", "PU Roll No.", "College Roll No.", "Mid Obt. Marks", "Sessional Obt. Marks"]);
    assert.deepEqual(INTERMEDIATE_HEADERS, ["Sr. No.", "College Roll No.", "Selected Test Obt. Marks", "Percentage"]);
});

test("creates the Intermediate award list with selected-test marks and test percentage", async () => {
    const intermediateStudents = [
        { id: 1, roll_number: "302" },
        { id: 2, roll_number: "301" }
    ];
    const spec = buildAwardListSpec({
        students: intermediateStudents,
        course: {
            name: "Mathematics",
            class_type: "intermediate",
            intermediate_year: "2nd Year",
            section: "A",
            class_shift: "morning"
        },
        teacherName: "Ali Ahmed",
        selectedTest: {
            key: "class:1",
            name: "Class Test 1",
            maxMarks: 20,
            marks: [{ student_id: 1, marks: 16 }]
        }
    });

    assert.equal(spec.isIntermediate, true);
    assert.deepEqual(spec.headers, ["Sr. No.", "College Roll No.", "Class Test 1 Obt. Marks", "Percentage"]);
    assert.deepEqual(studentRow(spec.pages[0][0], 1, "pu", { intermediate: true }), [1, "301", "A", "A"]);
    assert.deepEqual(studentRow(spec.pages[0][1], 2, "pu", { intermediate: true }), [2, "302", 16, 0.8]);

    const workbook = createWorkbook(ExcelJS, spec);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reopened.getWorksheet("Award List");
    assert.equal(sheet.getCell("B6").value, "College Roll No.");
    assert.equal(sheet.getCell("C6").value, "Class Test 1 Obt. Marks");
    assert.equal(sheet.getCell("D6").value, "Percentage");
    assert.equal(sheet.getCell("B7").value, "301");
    assert.equal(sheet.getCell("C7").value, "A");
    assert.equal(sheet.getCell("D7").value, "A");
    assert.equal(sheet.getCell("D8").value, 0.8);
    assert.equal(sheet.getCell("D8").numFmt, "0.0%");
    assert.equal(sheet.getCell("G6").value, "College Roll No.");
    assert.equal(sheet.pageSetup.printArea, "A1:I32");
});

test("creates a printable Intermediate award-list PDF with 50 students per page", async () => {
    const intermediateStudents = Array.from({ length: 51 }, (_, index) => ({
        id: index + 1,
        roll_number: String(500 + index)
    }));
    const spec = buildAwardListPdfSpec({
        students: intermediateStudents,
        course: {
            name: "Calculus II",
            class_type: "intermediate",
            intermediate_year: "1st Year",
            section: "C2",
            class_shift: "morning"
        },
        teacherName: "Naurez",
        selectedTest: {
            key: "monthly:8",
            name: "August Monthly Test",
            maxMarks: 25,
            marks: [{ student_id: 1, marks: 12 }]
        }
    });
    assert.equal(spec.pages.length, 2);
    assert.equal(spec.pages[0][0].test_percentage, 0.48);
    assert.equal(spec.pages[0][1].selected_test_marks, null);

    const buffer = await createAwardListPdf(spec);
    assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
    assert.ok(buffer.length > 5000);
    assert.match(buffer.toString("latin1"), /\/Count 2/);
    assert.match(buffer.toString("latin1"), /\/MediaBox \[0 0 595\.28 841\.89\]/);
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
