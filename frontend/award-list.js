(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.AwardList = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const HEADERS = Object.freeze([
        "Sr. No.",
        "PU Roll No.",
        "College Roll No.",
        "Mid Obt. Marks",
        "Sessional Obt. Marks"
    ]);

    const numericRollSort = (first, second) => String(first.roll_number).localeCompare(
        String(second.roll_number), undefined, { numeric: true }
    );

    function normalizeRollNumberType(value) {
        return value === "government_college" ? "government_college" : "pu";
    }

    function buildAwardListSpec({ students = [], course = {}, teacherName = "" }) {
        const sortedStudents = students.slice().sort(numericRollSort);
        const pages = [];
        for (let index = 0; index < Math.max(1, sortedStudents.length); index += 50) {
            pages.push(sortedStudents.slice(index, index + 50));
        }
        return {
            title: "Govt.Graduate College Civil Lines Sheikhupura",
            reportTitle: "Award List",
            headers: [...HEADERS],
            rollNumberType: normalizeRollNumberType(course.roll_number_type),
            examinationFor: "Midterm and Sessional",
            discipline: course.program || "",
            subjectCode: course.course_code || "",
            semester: course.semester || "",
            teacherName: teacherName || course.teacher_name || "",
            shift: course.class_shift === "evening" ? "Evening" : "Morning",
            midtermMaximum: Number(course.midterm_max_marks) || 25,
            sessionalMaximum: 15,
            pages,
            filename: `${String(course.name || "Course").replace(/[^a-z0-9]/gi, "_")}_Award_List.xlsx`
        };
    }

    function studentRow(student, serial, rollNumberType) {
        const roll = student ? String(student.roll_number ?? "") : null;
        return [
            serial,
            rollNumberType === "pu" ? roll : null,
            rollNumberType === "government_college" ? roll : null,
            student?.midterm_marks ?? null,
            student?.final_marks ?? null
        ];
    }

    function addAwardWorksheet(workbook, spec, students, pageIndex) {
        const worksheet = workbook.addWorksheet(pageIndex === 0 ? "Award List" : `Award List ${pageIndex + 1}`);
        worksheet.columns = [6, 13, 15, 11, 14, 2.5, 6, 13, 15, 11, 14].map(width => ({ width }));
        worksheet.views = [{ showGridLines: false }];
        worksheet.pageSetup = {
            paperSize: 9,
            orientation: "portrait",
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 1,
            margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
            printArea: "A1:K32"
        };

        worksheet.mergeCells("A1:K1");
        worksheet.getCell("A1").value = spec.title;
        worksheet.mergeCells("A2:K2");
        worksheet.getCell("A2").value = spec.reportTitle;
        worksheet.mergeCells("A3:B3");
        worksheet.getCell("A3").value = "Examination For:";
        worksheet.mergeCells("C3:E3");
        worksheet.getCell("C3").value = spec.examinationFor;
        worksheet.mergeCells("G3:H3");
        worksheet.getCell("G3").value = "Teacher's Name:";
        worksheet.mergeCells("I3:K3");
        worksheet.getCell("I3").value = spec.teacherName;
        worksheet.mergeCells("A4:B4");
        worksheet.getCell("A4").value = "BS (Discipline):";
        worksheet.getCell("C4").value = spec.discipline;
        worksheet.getCell("D4").value = "Semester:";
        worksheet.getCell("E4").value = spec.semester;
        worksheet.getCell("G4").value = "Shift:";
        worksheet.mergeCells("H4:K4");
        worksheet.getCell("H4").value = spec.shift === "Evening" ? "☐ Morning,     ☒ Evening" : "☒ Morning,     ☐ Evening";
        worksheet.mergeCells("A5:B5");
        worksheet.getCell("A5").value = "Subject Code:";
        worksheet.mergeCells("C5:E5");
        worksheet.getCell("C5").value = spec.subjectCode;
        worksheet.mergeCells("G5:K5");
        worksheet.getCell("G5").value = `Mid /${spec.midtermMaximum} & Sessional /${spec.sessionalMaximum}`;

        spec.headers.forEach((header, index) => {
            worksheet.getCell(6, index + 1).value = header;
            worksheet.getCell(6, index + 7).value = header;
        });

        for (let offset = 0; offset < 25; offset += 1) {
            const left = studentRow(students[offset], pageIndex * 50 + offset + 1, spec.rollNumberType);
            const right = studentRow(students[offset + 25], pageIndex * 50 + offset + 26, spec.rollNumberType);
            left.forEach((value, index) => { worksheet.getCell(7 + offset, 1 + index).value = value; });
            right.forEach((value, index) => { worksheet.getCell(7 + offset, 7 + index).value = value; });
        }

        worksheet.getCell("A32").value = "No. of Pass: ______";
        worksheet.getCell("D32").value = "No. of Fail: ______";
        worksheet.getCell("G32").value = "No. of Absent: ______";
        worksheet.getCell("J32").value = "Signature: ______";

        const thinBorder = {
            top: { style: "thin", color: { argb: "FF000000" } },
            left: { style: "thin", color: { argb: "FF000000" } },
            bottom: { style: "thin", color: { argb: "FF000000" } },
            right: { style: "thin", color: { argb: "FF000000" } }
        };
        worksheet.getCell("A1").font = { name: "Arial", size: 16, bold: true };
        worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
        worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
        worksheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
        worksheet.getCell("A2").font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
        worksheet.getRow(1).height = 24;
        worksheet.getRow(2).height = 22;
        worksheet.getRow(6).height = 38;

        for (let row = 3; row <= 5; row += 1) {
            for (let column = 1; column <= 11; column += 1) {
                const cell = worksheet.getCell(row, column);
                cell.font = { name: "Arial", size: 9, bold: [1, 4, 7].includes(column) };
                cell.alignment = { vertical: "middle", wrapText: true };
            }
        }
        for (let row = 6; row <= 31; row += 1) {
            for (const column of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]) {
                const cell = worksheet.getCell(row, column);
                cell.border = thinBorder;
                cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                cell.font = { name: "Arial", size: row === 6 ? 8 : 9, bold: row === 6 };
            }
            if (row > 6) worksheet.getRow(row).height = 18;
        }
        for (const address of ["A32", "D32", "G32", "J32"]) {
            worksheet.getCell(address).font = { name: "Arial", size: 9, bold: true };
        }
        return worksheet;
    }

    function createWorkbook(ExcelJS, spec) {
        if (!ExcelJS || typeof ExcelJS.Workbook !== "function") {
            throw new Error("Excel export library is unavailable");
        }
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Department of Mathematics Portal";
        workbook.created = new Date();
        spec.pages.forEach((students, pageIndex) => addAwardWorksheet(workbook, spec, students, pageIndex));
        return workbook;
    }

    return { HEADERS, buildAwardListSpec, createWorkbook, normalizeRollNumberType, studentRow };
}));
