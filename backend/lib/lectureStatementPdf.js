const PDFDocument = require("pdfkit");
const fs = require("node:fs");
const path = require("node:path");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 22;
const TABLE_GAP = 10;
const ROWS_PER_REGISTER = 22;
const ROWS_PER_PAGE = ROWS_PER_REGISTER * 2;
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

function formatDate(value) {
    const [year, month, day] = dateKey(value).split("-");
    return year && month && day ? `${day}-${month}-${year}` : "";
}

function compareRollNumbers(left, right) {
    return String(left).localeCompare(String(right), undefined, { numeric: true });
}

function buildLectureStatementSpec({ course = {}, students = [], records = [], teacherName = "", fromDate = "", toDate = "", throughDate = "" }) {
    const usableRecords = records
        .map(record => ({ ...record, attendance_date: dateKey(record.attendance_date) }))
        .filter(record => /^\d{4}-\d{2}-\d{2}$/.test(record.attendance_date));

    const recordedDates = usableRecords
        .filter(record => record.status === "present" || record.status === "absent")
        .map(record => record.attendance_date)
        .sort();
    const startDate = fromDate || recordedDates[0] || "";
    const endDate = toDate || throughDate || recordedDates.at(-1) || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        throw new Error("No saved attendance is available for the lecture statement");
    }
    if (startDate > endDate) {
        throw new Error("From date cannot be after To date");
    }

    const includedRecords = usableRecords.filter(record => (
        record.attendance_date >= startDate && record.attendance_date <= endDate
    ));
    const lectureDates = [...new Set(includedRecords
        .filter(record => record.status === "present" || record.status === "absent")
        .map(record => record.attendance_date))]
        .sort();
    if (!lectureDates.length) {
        throw new Error("No saved attendance is available through the selected date");
    }

    const lectureDateSet = new Set(lectureDates);
    const delivered = lectureDates.length;
    const isIntermediate = String(course.class_type || "").toLowerCase() === "intermediate";
    const rollNumberType = isIntermediate
        ? "government_college"
        : (course.roll_number_type === "government_college" ? "government_college" : "pu");

    const recordsByStudent = new Map();
    includedRecords.forEach(record => {
        if (!lectureDateSet.has(record.attendance_date)) return;
        const studentId = Number(record.student_id);
        if (!recordsByStudent.has(studentId)) recordsByStudent.set(studentId, []);
        recordsByStudent.get(studentId).push(record);
    });

    const rows = students
        .slice()
        .sort((a, b) => compareRollNumbers(a.roll_number, b.roll_number))
        .map(student => {
            const studentRecords = recordsByStudent.get(Number(student.id)) || [];
            const attended = new Set(studentRecords
                .filter(record => record.status === "present" || record.status === "leave")
                .map(record => record.attendance_date)).size;
            const absent = Math.max(delivered - attended, 0);
            return {
                puRollNumber: rollNumberType === "pu" ? String(student.roll_number) : "",
                collegeRollNumber: rollNumberType === "government_college" ? String(student.roll_number) : "",
                attended,
                absent,
                percentage: delivered ? `${((attended / delivered) * 100).toFixed(1)}%` : "0.0%"
            };
        });

    const className = isIntermediate
        ? [course.intermediate_year || "Intermediate", course.section ? `Section ${course.section}` : ""].filter(Boolean).join(" - ")
        : (course.program || "Bachelors");
    const semesterOrShift = isIntermediate
        ? (course.class_shift || "")
        : [course.semester ? `Semester ${course.semester}` : "", course.class_shift || ""].filter(Boolean).join(" / ");

    return {
        title: "Lecture Statement",
        startDate,
        endDate,
        teacherName: teacherName || "Teacher",
        courseCodeOrSubject: isIntermediate ? (course.name || "") : (course.course_code || course.name || ""),
        className,
        semesterOrShift,
        delivered,
        rows,
        isIntermediate,
        rollNumberType
    };
}

function centeredText(doc, text, x, y, width, height, options = {}) {
    const content = String(text ?? "");
    const textHeight = doc.heightOfString(content, { width, align: "center", ...options });
    doc.text(content, x, y + Math.max((height - textHeight) / 2, 1), {
        width,
        height,
        align: "center",
        lineBreak: true,
        ...options
    });
}

function drawCell(doc, { x, y, width, height, text = "", bold = false, fontSize = 8.2, fill = null, align = "left" }) {
    if (fill) doc.save().fillColor(fill).rect(x, y, width, height).fill().restore();
    doc.save().lineWidth(0.55).strokeColor("#000000").rect(x, y, width, height).stroke().restore();
    doc.font(bold ? BOLD_FONT : REGULAR_FONT).fontSize(fontSize).fillColor("#000000");
    const padding = align === "center" ? 2 : 5;
    centeredText(doc, text, x + padding, y, width - (padding * 2), height, { align });
}

function drawMeta(doc, spec, top) {
    const x = 42;
    const widths = [88, 158, 104, 161];
    const rowHeight = 23;
    const rows = [
        ["Teacher Name", spec.teacherName, "Course Code / Subject", spec.courseCodeOrSubject],
        ["Class", spec.className, "Semester / Shift", spec.semesterOrShift]
    ];

    rows.forEach((row, rowIndex) => {
        let cellX = x;
        row.forEach((value, columnIndex) => {
            drawCell(doc, {
                x: cellX,
                y: top + (rowIndex * rowHeight),
                width: widths[columnIndex],
                height: rowHeight,
                text: value,
                bold: columnIndex % 2 === 0,
                fontSize: columnIndex % 2 === 0 ? 8.1 : 8.5
            });
            cellX += widths[columnIndex];
        });
    });

    const deliveredTop = top + (rows.length * rowHeight);
    drawCell(doc, { x, y: deliveredTop, width: widths[0], height: rowHeight, text: "Lectures Delivered", bold: true, fontSize: 8.1 });
    drawCell(doc, {
        x: x + widths[0],
        y: deliveredTop,
        width: widths.slice(1).reduce((sum, width) => sum + width, 0),
        height: rowHeight,
        text: spec.delivered,
        bold: true,
        fontSize: 12
    });

    return deliveredTop + rowHeight;
}

function drawRegister(doc, rows, x, top, width) {
    const columnWidths = [48, 56, 50, 42, width - 196];
    const headers = ["PU Roll\nNo.", "College Roll\nNo.", "Lectures\nAttended", "Absent\nDays", "Attendance\nPercentage"];
    const headerHeight = 34;
    const rowHeight = 23;
    let cellX = x;

    headers.forEach((header, index) => {
        drawCell(doc, { x: cellX, y: top, width: columnWidths[index], height: headerHeight, text: header, bold: true, fontSize: 7.1, fill: "#E7E7E7", align: "center" });
        cellX += columnWidths[index];
    });

    for (let index = 0; index < ROWS_PER_REGISTER; index += 1) {
        const row = rows[index] || {};
        const values = [row.puRollNumber, row.collegeRollNumber, row.attended, row.absent, row.percentage];
        cellX = x;
        values.forEach((value, columnIndex) => {
            drawCell(doc, { x: cellX, y: top + headerHeight + (index * rowHeight), width: columnWidths[columnIndex], height: rowHeight, text: value ?? "", fontSize: 8.1, align: "center" });
            cellX += columnWidths[columnIndex];
        });
    }
}

function drawPage(doc, spec, pageRows, pageNumber, pageCount) {
    try {
        if (fs.existsSync(DEFAULT_LOGO_PATH)) {
            doc.image(DEFAULT_LOGO_PATH, 34, 20, { fit: [55, 55], align: "center", valign: "center" });
        }
    } catch (error) {
        console.warn("Lecture statement PDF logo could not be loaded:", error.message);
    }
    doc.font(BOLD_FONT).fontSize(14).fillColor("#000000")
        .text("Govt. Graduate College Civil Lines Sheikhupura", 100, 27, { width: PAGE_WIDTH - 125, align: "center" });
    doc.font(BOLD_FONT).fontSize(14)
        .text(spec.title, 100, 50, { width: PAGE_WIDTH - 125, align: "center" });
    doc.font(BOLD_FONT).fontSize(10.5)
        .text(`From ${formatDate(spec.startDate)} to ${formatDate(spec.endDate)}`, 100, 70, { width: PAGE_WIDTH - 125, align: "center" });

    const metaBottom = drawMeta(doc, spec, 91);
    const tableTop = metaBottom + 8;
    const registerWidth = (PAGE_WIDTH - (PAGE_MARGIN * 2) - TABLE_GAP) / 2;
    drawRegister(doc, pageRows.slice(0, ROWS_PER_REGISTER), PAGE_MARGIN, tableTop, registerWidth);
    drawRegister(doc, pageRows.slice(ROWS_PER_REGISTER), PAGE_MARGIN + registerWidth + TABLE_GAP, tableTop, registerWidth);

    doc.font(BOLD_FONT).fontSize(9).text("Teacher's Signature: __________________________", PAGE_WIDTH - 245, PAGE_HEIGHT - 45, { width: 220, height: 14, align: "right", lineBreak: false });
    doc.font(REGULAR_FONT).fontSize(7.5).fillColor("#555555").text(`Page ${pageNumber} of ${pageCount}`, PAGE_MARGIN, PAGE_HEIGHT - 31, { width: PAGE_WIDTH - (PAGE_MARGIN * 2), height: 12, align: "center", lineBreak: false });
}

function createLectureStatementPdf(spec) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            autoFirstPage: false,
            size: "A4",
            margins: 0,
            font: REGULAR_FONT_PATH,
            info: { Title: "Lecture Statement" }
        });
        doc.registerFont(REGULAR_FONT, REGULAR_FONT_PATH);
        doc.registerFont(BOLD_FONT, BOLD_FONT_PATH);
        const chunks = [];
        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const pageCount = Math.max(1, Math.ceil(spec.rows.length / ROWS_PER_PAGE));
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
            doc.addPage({ size: "A4", margins: 0 });
            drawPage(
                doc,
                spec,
                spec.rows.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE),
                pageIndex + 1,
                pageCount
            );
        }
        doc.end();
    });
}

module.exports = {
    ROWS_PER_PAGE,
    buildLectureStatementSpec,
    createLectureStatementPdf,
    formatDate
};
