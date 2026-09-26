const PDFDocument = require("pdfkit");
const fs = require("node:fs");
const path = require("node:path");

const ROWS_PER_PAGE = 25;
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const PAGE_MARGIN = 18;
const DEFAULT_LOGO_PATH = path.join(__dirname, "../../frontend/assets/department-logo.png");
const REGULAR_FONT_PATH = path.join(__dirname, "../../frontend/assets/fonts/poppins/poppins-latin-400-normal.ttf");
const BOLD_FONT_PATH = path.join(__dirname, "../../frontend/assets/fonts/poppins/poppins-latin-700-normal.ttf");
const REGULAR_FONT = "PortalPoppins";
const BOLD_FONT = "PortalPoppinsBold";

function dateKey(value) {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}

function compareRollNumbers(left, right) {
    return String(left).localeCompare(String(right), undefined, { numeric: true });
}

function monthLabel(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(year, month - 1, 1)));
}

function buildMonthlyAttendancePdfSpec({
    course = {},
    students = [],
    records = [],
    holidays = [],
    selectedMonth = "",
    teacherName = "",
    selectedTest = null,
    testMarks = []
}) {
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) throw new Error("Select a valid attendance month");
    const [year, month] = selectedMonth.split("-").map(Number);
    if (month < 1 || month > 12) throw new Error("Select a valid attendance month");

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const normalizedRecords = records
        .map(record => ({ ...record, attendance_date: dateKey(record.attendance_date), status: String(record.status || "").toLowerCase() }))
        .filter(record => /^\d{4}-\d{2}-\d{2}$/.test(record.attendance_date) && record.attendance_date.slice(0, 7) <= selectedMonth);
    const currentLectureDates = new Set(normalizedRecords
        .filter(record => record.status === "present" || record.status === "absent")
        .filter(record => record.attendance_date.startsWith(`${selectedMonth}-`))
        .map(record => record.attendance_date));
    const previousLectureDates = new Set(normalizedRecords
        .filter(record => record.status === "present" || record.status === "absent")
        .filter(record => record.attendance_date.slice(0, 7) < selectedMonth)
        .map(record => record.attendance_date));
    if (!currentLectureDates.size) throw new Error("No saved attendance is available for the selected month");

    const holidayDates = new Set(holidays.map(holiday => dateKey(holiday.holiday_date)));
    const excludedDays = new Set();
    for (let day = 1; day <= 31; day += 1) {
        if (day > daysInMonth) {
            excludedDays.add(day);
            continue;
        }
        const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
        if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0 || holidayDates.has(date)) excludedDays.add(day);
    }

    const statusByStudent = new Map();
    normalizedRecords.forEach(record => {
        const studentId = Number(record.student_id);
        if (!statusByStudent.has(studentId)) statusByStudent.set(studentId, new Map());
        statusByStudent.get(studentId).set(record.attendance_date, record.status);
    });
    const testMarksByStudent = new Map(
        testMarks
            .filter(mark => mark && mark.marks !== null && mark.marks !== undefined && mark.marks !== "")
            .map(mark => [Number(mark.student_id), mark.marks])
    );

    const rows = students
        .slice()
        .sort((a, b) => compareRollNumbers(a.roll_number, b.roll_number))
        .map(student => {
            const studentStatuses = statusByStudent.get(Number(student.id)) || new Map();
            const currentTheoryAttended = new Set([...studentStatuses.entries()]
                .filter(([date, status]) => date.startsWith(`${selectedMonth}-`) && (status === "present" || status === "leave"))
                .map(([date]) => date)).size;
            // B.F. is the previous month's Total T, which already carries all earlier attendance forward.
            const broughtForwardTheoryAttended = new Set([...studentStatuses.entries()]
                .filter(([date, status]) => date.slice(0, 7) < selectedMonth && (status === "present" || status === "leave"))
                .map(([date]) => date)).size;
            const days = [];
            for (let day = 1; day <= 31; day += 1) {
                if (day > daysInMonth || excludedDays.has(day)) {
                    days.push("");
                    continue;
                }
                const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                const status = studentStatuses.get(date);
                days.push(status === "present" ? "P" : status === "leave" ? "L" : status === "absent" || currentLectureDates.has(date) ? "A" : "");
            }
            return {
                rollNumber: String(student.roll_number ?? ""),
                days,
                periodsAttended: { theory: currentTheoryAttended, practical: "" },
                periodsBroughtForward: { theory: broughtForwardTheoryAttended, practical: "" },
                totalPeriods: { theory: currentTheoryAttended + broughtForwardTheoryAttended, practical: "" },
                testMark: selectedTest
                    ? (testMarksByStudent.has(Number(student.id)) ? testMarksByStudent.get(Number(student.id)) : "A")
                    : "",
                remarks: ""
            };
        });

    const isIntermediate = String(course.class_type || "").toLowerCase() === "intermediate";
    return {
        selectedMonth,
        selectedMonthLabel: monthLabel(selectedMonth),
        daysInMonth,
        excludedDays: [...excludedDays],
        lectureCounts: {
            currentTheory: currentLectureDates.size,
            broughtForwardTheory: previousLectureDates.size,
            totalTheory: currentLectureDates.size + previousLectureDates.size
        },
        teacherName: teacherName || "Teacher",
        className: isIntermediate ? (course.intermediate_year || "Intermediate") : (course.program || "Bachelors"),
        sectionSemester: isIntermediate ? (course.section || "") : (course.semester ? `Semester ${course.semester}` : ""),
        subject: isIntermediate ? (course.name || "Mathematics") : (course.name || ""),
        courseCode: isIntermediate ? "" : (course.course_code || ""),
        selectedTest,
        rows
    };
}

function drawCenteredText(doc, text, x, y, width, height, options = {}) {
    const content = String(text ?? "");
    const textHeight = options.lineBreak
        ? doc.heightOfString(content, { width, align: "center", ...options })
        : doc.currentLineHeight();
    doc.text(content, x, y + Math.max((height - textHeight) / 2, 1), {
        width,
        height,
        align: "center",
        lineBreak: false,
        ellipsis: true,
        ...options
    });
}

function drawCell(doc, x, y, width, height, text, options = {}) {
    const fill = options.fill || "#FFFFFF";
    doc.save().fillColor(fill).rect(x, y, width, height).fill().restore();
    doc.save().lineWidth(0.45).strokeColor("#4B4B4B").rect(x, y, width, height).stroke().restore();
    doc.font(options.bold ? BOLD_FONT : REGULAR_FONT)
        .fontSize(options.fontSize || 7)
        .fillColor(options.color || "#171717");
    drawCenteredText(doc, text, x + 1, y, width - 2, height, { align: "center", lineBreak: options.lineBreak === true });
}

function drawHeader(doc, spec, pageNumber, pageCount) {
    try {
        if (fs.existsSync(DEFAULT_LOGO_PATH)) doc.image(DEFAULT_LOGO_PATH, 24, 12, { fit: [48, 48] });
    } catch (error) {
        console.warn("Monthly attendance PDF logo could not be loaded:", error.message);
    }
    doc.font(BOLD_FONT).fontSize(13.5).fillColor("#7E0D16")
        .text("Govt. Graduate College Civil Lines Sheikhupura", 82, 14, { width: PAGE_WIDTH - 164, align: "center" });
    doc.font(BOLD_FONT).fontSize(12).fillColor("#171717")
        .text("Monthly Attendance Register", 82, 34, { width: PAGE_WIDTH - 164, align: "center" });
    doc.font(REGULAR_FONT).fontSize(7.5).fillColor("#333333")
        .text(`Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - 95, 18, { width: 70, align: "right" });

    const metaX = PAGE_MARGIN;
    const metaY = 64;
    const tableWidth = PAGE_WIDTH - (PAGE_MARGIN * 2);
    const firstRowWidths = [142, 133, 200, 125, tableWidth - 600];
    const firstRowValues = [
        `Class: ${spec.className}`,
        `Section/Sem: ${spec.sectionSemester || "-"}`,
        `Subject: ${spec.subject || "-"}`,
        `Paper: ${spec.courseCode || "-"}`,
        `Month: ${spec.selectedMonthLabel}`
    ];
    let cellX = metaX;
    firstRowValues.forEach((value, index) => {
        drawCell(doc, cellX, metaY, firstRowWidths[index], 18, value, { fontSize: 7.2 });
        cellX += firstRowWidths[index];
    });

    const detailsY = metaY + 18;
    const lectureWidth = 235;
    const syllabusWidth = tableWidth - lectureWidth;
    drawCell(doc, metaX, detailsY, syllabusWidth, 44, "Syllabus/Topic Covered During the Month: ______________________________________________", {
        fontSize: 7.2
    });
    const lectureX = metaX + syllabusWidth;
    drawCell(doc, lectureX, detailsY, lectureWidth, 14, "LECTURES DELIVERED", { bold: true, fontSize: 7.5, fill: "#F0F0F0" });
    const lectureRows = [
        ["B.F.", spec.lectureCounts.broughtForwardTheory],
        ["Current", spec.lectureCounts.currentTheory],
        ["Total", spec.lectureCounts.totalTheory]
    ];
    lectureRows.forEach((row, index) => {
        const y = detailsY + 14 + (index * 10);
        drawCell(doc, lectureX, y, 55, 10, row[0], { bold: true, fontSize: 6.4 });
        drawCell(doc, lectureX + 55, y, 90, 10, `Theory ${row[1]}`, { fontSize: 6.4 });
        drawCell(doc, lectureX + 145, y, 90, 10, "Practical -", { fontSize: 6.4 });
    });
    return detailsY + 48;
}

function drawRegister(doc, spec, pageRows, top) {
    const tableX = PAGE_MARGIN;
    const tableWidth = PAGE_WIDTH - (PAGE_MARGIN * 2);
    const rollWidth = 48;
    const dailyWidth = 12;
    const practicalWidth = 12;
    const summaryWidth = 25;
    const testMarksWidth = 44;
    const remarksWidth = tableWidth - rollWidth - (dailyWidth * 31) - (practicalWidth * 6) - (summaryWidth * 6) - testMarksWidth;
    const groupHeight = 19;
    const headerHeight = 21;
    const rowHeight = 15.7;

    drawCell(doc, tableX, top, rollWidth, groupHeight + headerHeight, "Roll No.", { bold: true, fontSize: 7.5, fill: "#F0F0F0" });
    drawCell(doc, tableX + rollWidth, top, dailyWidth * 31, groupHeight, "Theory", { bold: true, fontSize: 7.5, fill: "#F0F0F0" });
    const practicalX = tableX + rollWidth + (dailyWidth * 31);
    drawCell(doc, practicalX, top, practicalWidth * 6, groupHeight, "Practical", { bold: true, fontSize: 7.2, fill: "#F0F0F0" });
    let summaryX = practicalX + (practicalWidth * 6);
    const groupedHeaders = ["Periods\nAttended", "Periods\nB.F.", "Total Periods\nAttended"];
    groupedHeaders.forEach(header => {
        drawCell(doc, summaryX, top, summaryWidth * 2, groupHeight, header, { bold: true, fontSize: 5.8, fill: "#F0F0F0", lineBreak: true });
        drawCell(doc, summaryX, top + groupHeight, summaryWidth, headerHeight, "T", { bold: true, fontSize: 7, fill: "#F0F0F0" });
        drawCell(doc, summaryX + summaryWidth, top + groupHeight, summaryWidth, headerHeight, "P", { bold: true, fontSize: 7, fill: "#F0F0F0" });
        summaryX += summaryWidth * 2;
    });
    const testLabel = spec.selectedTest
        ? String(spec.selectedTest.name || "Test Marks") + " / " + spec.selectedTest.maxMarks
        : "Test Marks";
    drawCell(doc, summaryX, top, testMarksWidth, groupHeight + headerHeight, testLabel, {
        bold: true,
        fontSize: 5.5,
        fill: "#F0F0F0",
        lineBreak: true
    });
    drawCell(doc, summaryX + testMarksWidth, top, remarksWidth, groupHeight + headerHeight, "Remarks", { bold: true, fontSize: 6.5, fill: "#F0F0F0" });

    const excluded = new Set(spec.excludedDays);
    for (let day = 1; day <= 31; day += 1) {
        const fill = day > spec.daysInMonth ? "#E7E7E7" : excluded.has(day) ? "#FFF5BF" : "#FFFFFF";
        drawCell(doc, tableX + rollWidth + ((day - 1) * dailyWidth), top + groupHeight, dailyWidth, headerHeight, day, {
            bold: true,
            fontSize: 6.7,
            fill
        });
    }
    for (let practical = 0; practical < 6; practical += 1) {
        drawCell(doc, practicalX + (practical * practicalWidth), top + groupHeight, practicalWidth, headerHeight, "", {
            fill: "#FFFFFF"
        });
    }

    pageRows.forEach((row, rowIndex) => {
        const y = top + groupHeight + headerHeight + (rowIndex * rowHeight);
        drawCell(doc, tableX, y, rollWidth, rowHeight, row.rollNumber, { bold: true, fontSize: 7.3 });
        row.days.forEach((status, dayIndex) => {
            const day = dayIndex + 1;
            const fill = day > spec.daysInMonth ? "#E7E7E7" : excluded.has(day) ? "#FFF5BF" : "#FFFFFF";
            const color = status === "P" ? "#168047" : status === "L" ? "#2563EB" : status === "A" ? "#C8202F" : "#171717";
            drawCell(doc, tableX + rollWidth + (dayIndex * dailyWidth), y, dailyWidth, rowHeight, status, {
                bold: Boolean(status),
                fontSize: 7.2,
                color,
                fill
            });
        });
        for (let practical = 0; practical < 6; practical += 1) {
            drawCell(doc, practicalX + (practical * practicalWidth), y, practicalWidth, rowHeight, "", { fontSize: 7 });
        }
        summaryX = practicalX + (practicalWidth * 6);
        const summaryValues = [
            row.periodsAttended.theory,
            "",
            row.periodsBroughtForward.theory,
            "",
            row.totalPeriods.theory,
            ""
        ];
        summaryValues.forEach((value, index) => {
            drawCell(doc, summaryX, y, summaryWidth, rowHeight, value, { bold: index === 4, fontSize: 7 });
            summaryX += summaryWidth;
        });
        drawCell(doc, summaryX, y, testMarksWidth, rowHeight, row.testMark, { bold: row.testMark === "A", fontSize: 7 });
        drawCell(doc, summaryX + testMarksWidth, y, remarksWidth, rowHeight, row.remarks, { fontSize: 7 });
    });

    const bottom = top + groupHeight + headerHeight + (pageRows.length * rowHeight);
    const signatureY = Math.min(bottom + 7, PAGE_HEIGHT - 17);
    doc.font(BOLD_FONT).fontSize(7.5).fillColor("#171717")
        .text("Teacher's Signature: __________________________", PAGE_WIDTH - 270, signatureY, {
            width: 245,
            height: 12,
            align: "right",
            lineBreak: false
        });
}

function createMonthlyAttendancePdf(spec) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            autoFirstPage: false,
            size: "A4",
            layout: "landscape",
            margins: 0,
            font: REGULAR_FONT_PATH,
            info: { Title: `Monthly Attendance Register - ${spec.selectedMonthLabel}` }
        });
        doc.registerFont(REGULAR_FONT, REGULAR_FONT_PATH);
        doc.registerFont(BOLD_FONT, BOLD_FONT_PATH);
        const chunks = [];
        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const pageCount = Math.max(1, Math.ceil(spec.rows.length / ROWS_PER_PAGE));
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
            doc.addPage({ size: "A4", layout: "landscape", margins: 0 });
            const top = drawHeader(doc, spec, pageIndex + 1, pageCount);
            drawRegister(doc, spec, spec.rows.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE), top);
        }
        doc.end();
    });
}

module.exports = {
    ROWS_PER_PAGE,
    buildMonthlyAttendancePdfSpec,
    createMonthlyAttendancePdf
};
