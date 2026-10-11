const PDFDocument = require("pdfkit");
const fs = require("node:fs");
const path = require("node:path");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const REGULAR_FONT_PATH = path.join(__dirname, "../../frontend/assets/fonts/poppins/poppins-latin-400-normal.ttf");
const BOLD_FONT_PATH = path.join(__dirname, "../../frontend/assets/fonts/poppins/poppins-latin-700-normal.ttf");
const LOGO_PATH = path.join(__dirname, "../../frontend/assets/department-logo.png");
const REGULAR_FONT = "PortalPoppins";
const BOLD_FONT = "PortalPoppinsBold";

function dateKey(value) {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}

function formatDate(value) {
    const key = dateKey(value);
    const [year, month, day] = key.split("-");
    return year && month && day ? `${day}-${month}-${year}` : key;
}

function monthLabel(month) {
    const [year, monthNumber] = String(month).split("-").map(Number);
    if (!year || !monthNumber) return String(month || "");
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function classLabel(lecture) {
    if (lecture.class_type === "intermediate") {
        return lecture.intermediate_year === "2nd_year" ? "2nd Year" : "1st Year";
    }
    return lecture.program || "Bachelors";
}

function sectionLabel(lecture) {
    return lecture.class_type === "intermediate"
        ? (lecture.section || "-")
        : (lecture.semester || "-");
}

function buildMonthlyLectureRecordSpec({ teacherName, month, shift, lectures = [] }) {
    const byDate = new Map();
    lectures.forEach(lecture => {
        const date = dateKey(lecture.attendance_date);
        const period = Number(lecture.period_number);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(period) || period < 1 || period > 7) return;
        if (!byDate.has(date)) byDate.set(date, Array(7).fill(null));
        byDate.get(date)[period - 1] = {
            className: classLabel(lecture),
            section: sectionLabel(lecture),
            courseId: Number(lecture.course_id)
        };
    });

    const rows = [...byDate.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, periods]) => ({
            date,
            periods,
            total: periods.filter(Boolean).length
        }));
    const courseIds = new Set(rows.flatMap(row => row.periods.filter(Boolean).map(item => item.courseId)));

    return {
        title: "Monthly Lectures Record",
        teacherName: teacherName || "Teacher",
        month,
        monthLabel: monthLabel(month),
        shift: shift === "evening" ? "Evening" : "Morning",
        subject: "Mathematics",
        classCount: courseIds.size,
        totalLectures: rows.reduce((sum, row) => sum + row.total, 0),
        rows
    };
}

function fitText(doc, text, x, y, width, height, options = {}) {
    const value = String(text ?? "");
    let fontSize = options.fontSize || 6;
    doc.font(options.bold ? BOLD_FONT : REGULAR_FONT);
    doc.fontSize(fontSize);
    while (fontSize > 4.2 && doc.widthOfString(value) > width - 4) {
        fontSize -= 0.3;
        doc.fontSize(fontSize);
    }
    doc.fontSize(fontSize).fillColor("#000000");
    const textHeight = doc.heightOfString(value, { width: width - 4, align: "center", lineGap: 0 });
    doc.text(value, x + 2, y + Math.max(1, (height - textHeight) / 2), {
        width: width - 4,
        height: height - 2,
        align: "center",
        lineGap: 0
    });
}

function drawCell(doc, x, y, width, height, text = "", options = {}) {
    if (options.fill) doc.save().fillColor(options.fill).rect(x, y, width, height).fill().restore();
    doc.save().lineWidth(options.lineWidth || 0.6).strokeColor("#111111").rect(x, y, width, height).stroke().restore();
    fitText(doc, text, x, y, width, height, options);
}

function createMonthlyLectureRecordPdf(spec) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margins: 0, font: REGULAR_FONT_PATH, info: { Title: "Monthly Lectures Record" } });
        doc.registerFont(REGULAR_FONT, REGULAR_FONT_PATH);
        doc.registerFont(BOLD_FONT, BOLD_FONT_PATH);
        const chunks = [];
        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        try {
            if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, 24, 20, { fit: [54, 54] });
        } catch (error) {
            console.warn("Monthly lecture record logo could not be loaded:", error.message);
        }

        doc.font(BOLD_FONT).fontSize(17).fillColor("#000000")
            .text("Govt. Graduate College Civil Lines Sheikhupura", 82, 26, { width: 486, align: "center" });
        doc.font(BOLD_FONT).fontSize(11)
            .text(spec.title, 82, 52, { width: 486, align: "center" });
        doc.font(REGULAR_FONT).fontSize(8.4)
            .text(`${spec.classCount} Classes  |  ${spec.shift}  |  ${spec.monthLabel}`, 82, 69, { width: 486, align: "center" });

        const metaY = 91;
        doc.font(BOLD_FONT).fontSize(8.5).text("Name of Teacher:", 24, metaY, { lineBreak: false });
        doc.font(REGULAR_FONT).text(spec.teacherName, 105, metaY, { width: 245, lineBreak: false });
        doc.font(BOLD_FONT).text("Subject:", 378, metaY, { lineBreak: false });
        doc.font(REGULAR_FONT).text(spec.subject, 425, metaY, { width: 145, lineBreak: false });
        doc.moveTo(104, metaY + 12).lineTo(350, metaY + 12).stroke();
        doc.moveTo(424, metaY + 12).lineTo(570, metaY + 12).stroke();

        const tableX = 20;
        const tableY = 112;
        const dateWidth = 48;
        const totalWidth = 32;
        const periodWidth = (PAGE_WIDTH - 40 - dateWidth - totalWidth) / 7;
        const groupHeaderHeight = 22;
        const subHeaderHeight = 25;
        const rowHeight = 19;

        drawCell(doc, tableX, tableY, dateWidth, groupHeaderHeight + subHeaderHeight, "Date", { bold: true, fontSize: 7.5, fill: "#eeeeee" });
        for (let index = 0; index < 7; index += 1) {
            const x = tableX + dateWidth + (index * periodWidth);
            drawCell(doc, x, tableY, periodWidth, groupHeaderHeight, `Period-${index + 1}`, { bold: true, fontSize: 7.1, fill: "#eeeeee" });
            drawCell(doc, x, tableY + groupHeaderHeight, periodWidth * 0.62, subHeaderHeight, "Class", { fontSize: 5.9, fill: "#f7f7f7" });
            drawCell(doc, x + (periodWidth * 0.62), tableY + groupHeaderHeight, periodWidth * 0.38, subHeaderHeight, "Sec/\nSem", { fontSize: 5.2, fill: "#f7f7f7" });
        }
        drawCell(doc, tableX + dateWidth + (7 * periodWidth), tableY, totalWidth, groupHeaderHeight + subHeaderHeight, "Total", { bold: true, fontSize: 6.3, fill: "#eeeeee" });

        for (let rowIndex = 0; rowIndex < 31; rowIndex += 1) {
            const row = spec.rows[rowIndex] || { periods: Array(7).fill(null), total: "" };
            const y = tableY + groupHeaderHeight + subHeaderHeight + (rowIndex * rowHeight);
            drawCell(doc, tableX, y, dateWidth, rowHeight, row.date ? formatDate(row.date) : "", { fontSize: 6.3 });
            for (let periodIndex = 0; periodIndex < 7; periodIndex += 1) {
                const x = tableX + dateWidth + (periodIndex * periodWidth);
                const lecture = row.periods[periodIndex];
                drawCell(doc, x, y, periodWidth * 0.62, rowHeight, lecture?.className || "", { fontSize: 5.1 });
                drawCell(doc, x + (periodWidth * 0.62), y, periodWidth * 0.38, rowHeight, lecture?.section || "", { fontSize: 4.8 });
            }
            drawCell(doc, tableX + dateWidth + (7 * periodWidth), y, totalWidth, rowHeight, row.total, { bold: true, fontSize: 6.5 });
        }

        const footerY = tableY + groupHeaderHeight + subHeaderHeight + (31 * rowHeight) + 22;
        doc.font(BOLD_FONT).fontSize(9).text(`No. of Total Lectures: ${spec.totalLectures}`, 24, footerY, { width: 250, lineBreak: false });
        doc.text("Signature: __________________________", 330, footerY, { width: 240, align: "right", lineBreak: false });
        doc.end();
    });
}

module.exports = { buildMonthlyLectureRecordSpec, createMonthlyLectureRecordPdf, formatDate };
