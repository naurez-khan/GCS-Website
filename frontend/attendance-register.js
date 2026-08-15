(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.AttendanceRegister = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const dateKey = value => String(value || "").slice(0, 10);
    const monthKey = value => dateKey(value).slice(0, 7);

    function columnName(index) {
        let value = index + 1;
        let name = "";
        while (value > 0) {
            const remainder = (value - 1) % 26;
            name = String.fromCharCode(65 + remainder) + name;
            value = Math.floor((value - 1) / 26);
        }
        return name;
    }

    function monthLabel(key) {
        const [year, month] = key.split("-").map(Number);
        return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
            month: "long",
            year: "numeric"
        });
    }

    function numericCell(value, formula) {
        return { t: "n", v: value, f: formula };
    }

    function buildMonthlyAttendanceRegister(options) {
        const selectedMonth = String(options.selectedMonth || "");
        if (!/^\d{4}-\d{2}$/.test(selectedMonth)) {
            throw new Error("Select a valid attendance month");
        }

        const students = Array.isArray(options.students) ? options.students.slice() : [];
        const records = Array.isArray(options.records) ? options.records.slice() : [];
        const course = options.course || {};
        const [year, month] = selectedMonth.split("-").map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const selectedMonthLabel = monthLabel(selectedMonth);
        const previousMonths = [...new Set(records.map(record => monthKey(record.attendance_date)))]
            .filter(key => /^\d{4}-\d{2}$/.test(key) && key < selectedMonth)
            .sort();

        students.sort((a, b) => String(a.roll_number).localeCompare(
            String(b.roll_number), undefined, { numeric: true }
        ));

        const studentById = new Map(students.map(student => [Number(student.id), student]));
        const attendanceByStudent = new Map();
        records.forEach(record => {
            const studentId = Number(record.student_id);
            if (!attendanceByStudent.has(studentId)) attendanceByStudent.set(studentId, new Map());
            attendanceByStudent.get(studentId).set(dateKey(record.attendance_date), String(record.status || "").toLowerCase());
        });

        // Visible columns mirror the supplied printed register from left to right.
        const rollColumn = 0;
        const dailyStart = 1;
        const dailyEnd = dailyStart + 30;
        const practicalStart = dailyEnd + 1;
        const practicalEnd = practicalStart + 5;
        const currentStart = practicalEnd + 1;
        const currentEnd = currentStart + 1;
        const broughtForwardStart = currentEnd + 1;
        const broughtForwardEnd = broughtForwardStart + 1;
        const totalStart = broughtForwardEnd + 1;
        const totalEnd = totalStart + 1;
        const remarksColumn = totalEnd + 1;
        const lastColumn = remarksColumn;
        const dataStart = 6;

        const attendedStatuses = new Set(["present", "absent"]);
        const currentDates = new Set(records
            .filter(record => monthKey(record.attendance_date) === selectedMonth)
            .filter(record => attendedStatuses.has(String(record.status || "").toLowerCase()))
            .map(record => dateKey(record.attendance_date)));
        const previousDates = new Set(records
            .filter(record => monthKey(record.attendance_date) < selectedMonth)
            .filter(record => attendedStatuses.has(String(record.status || "").toLowerCase()))
            .map(record => dateKey(record.attendance_date)));

        const rows = Array.from({ length: dataStart }, () => []);
        rows[0][0] = `Class ${course.program || "________________"}`;
        rows[0][6] = `Section/Sem ${[course.section, course.semester].filter(Boolean).join(" / ") || "____________"}`;
        rows[0][14] = `Subject ${course.name || "________________"}`;
        rows[0][23] = `Paper ${course.course_code || "____________"}`;
        rows[0][31] = `Month ${selectedMonthLabel}`;
        rows[0][39] = "LECTURES DELIVERED";

        rows[1][0] = `Syllabus/Topic Covered During the Month ${options.syllabusTopic || "____________________________________________"}`;
        rows[1][39] = "B.F";
        rows[1][41] = `Theory ${previousDates.size}`;
        rows[1][43] = "Practical —";

        rows[2][0] = "";
        rows[2][39] = "Current";
        rows[2][41] = `Theory ${currentDates.size}`;
        rows[2][43] = "Practical —";

        rows[3][39] = "Total";
        rows[3][41] = `Theory ${previousDates.size + currentDates.size}`;
        rows[3][43] = "Practical —";

        rows[4][dailyStart] = "Theory";
        rows[4][practicalStart] = "Practical";

        rows[5][rollColumn] = "Roll No.";
        for (let day = 1; day <= 31; day += 1) rows[5][dailyStart + day - 1] = day;
        rows[5][currentStart] = "Periods\nAttended\nT";
        rows[5][currentStart + 1] = "P";
        rows[5][broughtForwardStart] = "Periods\nB.F.\nT";
        rows[5][broughtForwardStart + 1] = "P";
        rows[5][totalStart] = "Total Periods\nAttended\nT";
        rows[5][totalStart + 1] = "P";
        rows[5][remarksColumn] = "Remarks";

        const rawRows = [["Student ID", "Roll Number", "Student Name", "Attendance Date", "Status", "Month"]];
        records
            .slice()
            .sort((a, b) => dateKey(a.attendance_date).localeCompare(dateKey(b.attendance_date)))
            .forEach(record => {
                const student = studentById.get(Number(record.student_id)) || {};
                const key = dateKey(record.attendance_date);
                rawRows.push([
                    Number(record.student_id),
                    student.roll_number ?? record.roll_number ?? "",
                    student.name || record.student_name || "",
                    new Date(`${key}T00:00:00`),
                    String(record.status || "").toLowerCase(),
                    key.slice(0, 7)
                ]);
            });

        const rawLastRow = Math.max(2, rawRows.length);
        const rawIdRange = `'_Attendance Data'!$A$2:$A$${rawLastRow}`;
        const rawDateRange = `'_Attendance Data'!$D$2:$D$${rawLastRow}`;
        const rawStatusRange = `'_Attendance Data'!$E$2:$E$${rawLastRow}`;
        const monthStartFormula = `DATE(${year},${month},1)`;

        students.forEach((student, studentIndex) => {
            const excelRow = dataStart + studentIndex + 1;
            const row = [];
            row[rollColumn] = student.roll_number;
            const studentAttendance = attendanceByStudent.get(Number(student.id)) || new Map();

            for (let day = 1; day <= 31; day += 1) {
                if (day > daysInMonth) {
                    row[dailyStart + day - 1] = "";
                    continue;
                }
                const key = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                const status = studentAttendance.get(key);
                row[dailyStart + day - 1] = status === "present" ? "P" : (status === "absent" ? "A" : "");
            }
            for (let column = practicalStart; column <= practicalEnd; column += 1) row[column] = "";

            const dayRange = `${columnName(dailyStart)}${excelRow}:${columnName(dailyEnd)}${excelRow}`;
            const currentPresent = [...studentAttendance.entries()]
                .filter(([key, status]) => key.slice(0, 7) === selectedMonth && status === "present").length;
            const previousPresent = [...studentAttendance.entries()]
                .filter(([key, status]) => key.slice(0, 7) < selectedMonth && status === "present").length;
            const totalPresent = currentPresent + previousPresent;
            const studentId = Number(student.id);

            row[currentStart] = numericCell(currentPresent, `COUNTIF(${dayRange},"P")`);
            row[currentStart + 1] = "";
            row[broughtForwardStart] = numericCell(previousPresent, `COUNTIFS(${rawIdRange},${studentId},${rawDateRange},"<"&${monthStartFormula},${rawStatusRange},"present")`);
            row[broughtForwardStart + 1] = "";
            row[totalStart] = numericCell(totalPresent, `${columnName(currentStart)}${excelRow}+${columnName(broughtForwardStart)}${excelRow}`);
            row[totalStart + 1] = "";
            row[remarksColumn] = "";
            rows.push(row);
        });

        const signatureRow = rows.length + 2;
        rows.push([]);
        rows.push([]);
        rows[signatureRow - 1][38] = "Signature of HOD ____________________";

        const merges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
            { s: { r: 0, c: 6 }, e: { r: 0, c: 13 } },
            { s: { r: 0, c: 14 }, e: { r: 0, c: 22 } },
            { s: { r: 0, c: 23 }, e: { r: 0, c: 25 } },
            { s: { r: 0, c: 31 }, e: { r: 0, c: 38 } },
            { s: { r: 0, c: 39 }, e: { r: 0, c: 44 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 31 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 31 } },
            { s: { r: 1, c: 39 }, e: { r: 1, c: 40 } },
            { s: { r: 1, c: 41 }, e: { r: 1, c: 42 } },
            { s: { r: 1, c: 43 }, e: { r: 1, c: 44 } },
            { s: { r: 2, c: 39 }, e: { r: 2, c: 40 } },
            { s: { r: 2, c: 41 }, e: { r: 2, c: 42 } },
            { s: { r: 2, c: 43 }, e: { r: 2, c: 44 } },
            { s: { r: 3, c: 39 }, e: { r: 3, c: 40 } },
            { s: { r: 3, c: 41 }, e: { r: 3, c: 42 } },
            { s: { r: 3, c: 43 }, e: { r: 3, c: 44 } },
            { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
            { s: { r: 4, c: dailyStart }, e: { r: 4, c: dailyEnd } },
            { s: { r: 4, c: practicalStart }, e: { r: 4, c: practicalEnd } },
            { s: { r: 4, c: currentStart }, e: { r: 4, c: currentEnd } },
            { s: { r: 4, c: broughtForwardStart }, e: { r: 4, c: broughtForwardEnd } },
            { s: { r: 4, c: totalStart }, e: { r: 4, c: totalEnd } },
            { s: { r: 4, c: remarksColumn }, e: { r: 5, c: remarksColumn } },
            { s: { r: signatureRow - 1, c: 38 }, e: { r: signatureRow - 1, c: lastColumn } }
        ];

        const columns = [
            { wch: 10 },
            ...Array.from({ length: 31 }, () => ({ wch: 3.05 })),
            ...Array.from({ length: 6 }, () => ({ wch: 3.05 })),
            ...Array.from({ length: 6 }, () => ({ wch: 5.2 })),
            { wch: 24 }
        ];

        return {
            rows,
            rawRows,
            merges,
            columns,
            rowHeights: [{ hpt: 24 }, { hpt: 22 }, { hpt: 18 }, { hpt: 18 }, { hpt: 18 }, { hpt: 36 }],
            selectedMonth,
            selectedMonthLabel,
            daysInMonth,
            previousMonths,
            studentNames: students.map(student => student.name || ""),
            lectureCounts: {
                currentTheory: currentDates.size,
                broughtForwardTheory: previousDates.size,
                totalTheory: currentDates.size + previousDates.size
            },
            ranges: {
                rollColumn, dailyStart, dailyEnd, practicalStart, practicalEnd,
                currentStart, currentEnd, broughtForwardStart, broughtForwardEnd,
                totalStart, totalEnd, remarksColumn, lastColumn,
                dataStart, dataEnd: dataStart + students.length - 1,
                signatureRow: signatureRow - 1
            },
            filename: `${String(course.name || "Course").replace(/[^a-z0-9]/gi, "_")}_Attendance_Register_${selectedMonth}.xlsx`
        };
    }

    return { buildMonthlyAttendanceRegister, columnName };
}));
