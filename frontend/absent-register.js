(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.AbsentRegister = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const dateKey = value => String(value || "").slice(0, 10);
    const isIsoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

    function formatDate(value) {
        const [year, month, day] = dateKey(value).split("-");
        return `${day}-${month}-${year}`;
    }

    function safeFilename(value) {
        return String(value || "Course")
            .replace(/[^a-z0-9]+/gi, "_")
            .replace(/^_+|_+$/g, "") || "Course";
    }

    function classDetails(course) {
        const isIntermediate = course.class_type === "intermediate";
        return {
            className: isIntermediate
                ? (course.intermediate_year || "")
                : (course.program || ""),
            section: isIntermediate
                ? (course.section || "")
                : (course.semester || "")
        };
    }

    function buildAbsentStudentsRegister(options = {}) {
        const fromDate = dateKey(options.fromDate);
        const toDate = dateKey(options.toDate);
        if (!isIsoDate(fromDate) || !isIsoDate(toDate)) {
            throw new Error("Select valid From and To dates");
        }
        if (fromDate > toDate) {
            throw new Error("From date cannot be after To date");
        }

        const records = Array.isArray(options.records) ? options.records : [];
        const students = Array.isArray(options.students) ? options.students : [];
        const course = options.course || {};
        const studentById = new Map(students.map(student => [Number(student.id), student]));

        // A real attendance day has at least one Present or Absent record. Leave-only
        // dates can be created in advance and must not appear as delivered lectures.
        const recordedDates = [...new Set(records
            .filter(record => {
                const status = String(record.status || "").toLowerCase();
                const key = dateKey(record.attendance_date);
                return key >= fromDate && key <= toDate && (status === "present" || status === "absent");
            })
            .map(record => dateKey(record.attendance_date)))]
            .sort();

        if (!recordedDates.length) {
            throw new Error("No saved attendance was found in the selected date range");
        }

        const absentRollsByDate = new Map(recordedDates.map(date => [date, []]));
        records.forEach(record => {
            const key = dateKey(record.attendance_date);
            if (!absentRollsByDate.has(key) || String(record.status || "").toLowerCase() !== "absent") return;
            const student = studentById.get(Number(record.student_id)) || {};
            const rollNumber = student.roll_number ?? record.roll_number;
            if (rollNumber !== undefined && rollNumber !== null && String(rollNumber).trim() !== "") {
                absentRollsByDate.get(key).push(String(rollNumber));
            }
        });
        absentRollsByDate.forEach(rolls => rolls.sort((first, second) =>
            first.localeCompare(second, undefined, { numeric: true })
        ));

        const details = classDetails(course);
        const dateGroups = [];
        for (let index = 0; index < recordedDates.length; index += 5) {
            dateGroups.push(recordedDates.slice(index, index + 5));
        }

        const sheets = dateGroups.map((dates, sheetIndex) => {
            const maximumAbsent = Math.max(0, ...dates.map(date => absentRollsByDate.get(date).length));
            const dataRowCount = Math.max(34, Math.ceil(maximumAbsent / 2));
            const rows = Array.from({ length: dataRowCount }, () => Array(10).fill(null));

            dates.forEach((date, dateIndex) => {
                const rolls = absentRollsByDate.get(date);
                const firstColumn = dateIndex * 2;
                rolls.forEach((rollNumber, rollIndex) => {
                    const rowIndex = Math.floor(rollIndex / 2);
                    const columnIndex = firstColumn + (rollIndex % 2);
                    rows[rowIndex][columnIndex] = rollNumber;
                });
            });

            return {
                name: dateGroups.length === 1 ? "Absent Students" : `Absent ${sheetIndex + 1}`,
                dates,
                dateLabels: dates.map(formatDate),
                absentRolls: dates.map(date => absentRollsByDate.get(date).slice()),
                rows,
                dataRowCount
            };
        });

        return {
            title: options.collegeName || "Govt. Graduate College Civil Lines Sheikhupura",
            teacherName: String(options.teacherName || "").trim(),
            className: details.className,
            section: details.section,
            fromDate,
            toDate,
            recordedDates,
            sheets,
            filename: `${safeFilename(course.name)}_Absent_Students_${fromDate}_to_${toDate}.xlsx`
        };
    }

    function applyWorksheetStyles(worksheet, sheetSpec) {
        const black = { argb: "FF000000" };
        const border = {
            top: { style: "thin", color: black },
            bottom: { style: "thin", color: black },
            left: { style: "thin", color: black },
            right: { style: "thin", color: black }
        };
        const centered = { horizontal: "center", vertical: "middle", wrapText: true };
        const lastDataRow = 4 + sheetSpec.dataRowCount;

        worksheet.getRow(1).height = 28;
        worksheet.getCell("A1").font = { name: "Arial Narrow", size: 18, bold: true, color: black };
        worksheet.getCell("A1").alignment = centered;
        worksheet.getRow(2).height = 24;
        ["A2", "E2", "H2"].forEach(address => {
            worksheet.getCell(address).font = { name: "Arial Narrow", size: 11, bold: true, color: black };
            worksheet.getCell(address).alignment = { horizontal: "left", vertical: "middle" };
        });
        worksheet.getRow(3).height = 22;
        worksheet.getCell("A3").font = { name: "Arial Narrow", size: 12, bold: true, color: black };
        worksheet.getCell("A3").alignment = centered;

        for (let row = 4; row <= lastDataRow; row += 1) {
            worksheet.getRow(row).height = row === 4 ? 23 : 19;
            for (let column = 1; column <= 10; column += 1) {
                const cell = worksheet.getCell(row, column);
                cell.border = border;
                cell.alignment = centered;
                cell.font = {
                    name: "Arial Narrow",
                    size: row === 4 ? 11 : 10,
                    bold: row === 4,
                    color: black
                };
            }
        }

        const signatureRow = lastDataRow + 2;
        worksheet.getRow(signatureRow).height = 22;
        worksheet.getCell(signatureRow, 7).font = { name: "Arial Narrow", size: 11, bold: true, color: black };
        worksheet.getCell(signatureRow, 7).alignment = { horizontal: "right", vertical: "middle" };
    }

    function addWorksheet(workbook, reportSpec, sheetSpec) {
        const worksheet = workbook.addWorksheet(sheetSpec.name, {
            views: [{ showGridLines: false }],
            pageSetup: {
                paperSize: 9,
                orientation: "portrait",
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                horizontalCentered: true,
                verticalCentered: false,
                printTitlesRow: "1:4",
                margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 }
            }
        });

        for (let column = 1; column <= 10; column += 1) worksheet.getColumn(column).width = 9.5;
        worksheet.mergeCells("A1:J1");
        worksheet.getCell("A1").value = reportSpec.title;
        worksheet.mergeCells("A2:D2");
        worksheet.getCell("A2").value = `Name of Teacher ${reportSpec.teacherName || "________________"}`;
        worksheet.mergeCells("E2:G2");
        worksheet.getCell("E2").value = `Class ${reportSpec.className || "____________"}`;
        worksheet.mergeCells("H2:J2");
        worksheet.getCell("H2").value = `Section ${reportSpec.section || "________"}`;
        worksheet.mergeCells("A3:J3");
        worksheet.getCell("A3").value = "Roll No. of Absent Students";

        for (let slot = 0; slot < 5; slot += 1) {
            const firstColumn = 1 + (slot * 2);
            worksheet.mergeCells(4, firstColumn, 4, firstColumn + 1);
            worksheet.getCell(4, firstColumn).value = sheetSpec.dateLabels[slot] || null;
        }

        sheetSpec.rows.forEach(row => worksheet.addRow(row));
        const signatureRow = 4 + sheetSpec.dataRowCount + 2;
        worksheet.mergeCells(signatureRow, 7, signatureRow, 10);
        worksheet.getCell(signatureRow, 7).value = "Signature ____________________";
        worksheet.pageSetup.printArea = `A1:J${signatureRow}`;
        applyWorksheetStyles(worksheet, sheetSpec);
    }

    function createWorkbook(ExcelJS, reportSpec) {
        if (!ExcelJS || typeof ExcelJS.Workbook !== "function") {
            throw new Error("Excel export library is unavailable");
        }
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Department of Mathematics Attendance Portal";
        workbook.created = new Date();
        reportSpec.sheets.forEach(sheetSpec => addWorksheet(workbook, reportSpec, sheetSpec));
        return workbook;
    }

    return { buildAbsentStudentsRegister, createWorkbook, formatDate };
}));
