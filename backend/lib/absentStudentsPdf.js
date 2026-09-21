const PDFDocument = require("pdfkit");
const fs = require("node:fs");
const path = require("node:path");
const { buildAbsentStudentsRegister } = require("../../frontend/absent-register");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 22;
const ROWS_PER_PAGE = 34;
const DEFAULT_LOGO_PATH = path.join(__dirname, "../../frontend/assets/department-logo.png");
const REGULAR_FONT_PATH = path.join(__dirname, "../../frontend/assets/fonts/poppins/poppins-latin-400-normal.ttf");
const BOLD_FONT_PATH = path.join(__dirname, "../../frontend/assets/fonts/poppins/poppins-latin-700-normal.ttf");
const REGULAR_FONT = "PortalPoppins";
const BOLD_FONT = "PortalPoppinsBold";

function buildAbsentStudentsPdfSpec(options = {}) {
    const register = buildAbsentStudentsRegister(options);
    return {
        ...register,
        filename: register.filename.replace(/.xlsx$/i, ".pdf")
    };
}

function drawCell(doc, { x, y, width, height, text = "", bold = false, fontSize = 8, fill = null, align = "center" }) {
    if (fill) {
        doc.save().fillColor(fill).rect(x, y, width, height).fill().restore();
    }
    doc.save().lineWidth(0.55).strokeColor("#000000").rect(x, y, width, height).stroke().restore();
    doc.font(bold ? BOLD_FONT : REGULAR_FONT).fontSize(fontSize).fillColor("#000000");
    const value = String(text ?? "");
    const textHeight = doc.currentLineHeight();
    doc.text(value, x + 3, y + Math.max(1, (height - textHeight) / 2), {
        width: width - 6,
        height: Math.max(1, height - 2),
        align,
        lineBreak: false,
        ellipsis: true
    });
}

function drawHeader(doc, spec) {
    try {
        if (fs.existsSync(DEFAULT_LOGO_PATH)) {
            doc.image(DEFAULT_LOGO_PATH, 32, 18, { fit: [54, 54], align: "center", valign: "center" });
        }
    } catch (error) {
        console.warn("Absent students PDF logo could not be loaded:", error.message);
    }

    doc.font(BOLD_FONT).fontSize(14).fillColor("#000000")
        .text(spec.title, 92, 25, { width: PAGE_WIDTH - 118, height: 22, align: "center", lineBreak: false });
    doc.font(BOLD_FONT).fontSize(13)
        .text("ROLL NO. OF ABSENT STUDENTS", 92, 50, { width: PAGE_WIDTH - 118, height: 20, align: "center", lineBreak: false });

    const metaTop = 84;
    const usableWidth = PAGE_WIDTH - (PAGE_MARGIN * 2);
    const widths = [usableWidth * 0.46, usableWidth * 0.3, usableWidth * 0.24];
    const values = [
        `Name of Teacher  ${spec.teacherName || "________________"}`,
        `Class  ${spec.className || "____________"}`,
        `Section  ${spec.section || "________"}`
    ];
    let x = PAGE_MARGIN;
    values.forEach((value, index) => {
        drawCell(doc, {
            x,
            y: metaTop,
            width: widths[index],
            height: 28,
            text: value,
            bold: true,
            fontSize: 8,
            align: "left"
        });
        x += widths[index];
    });

    doc.font(REGULAR_FONT).fontSize(8).fillColor("#333333")
        .text(`Attendance dates from ${spec.fromDate} to ${spec.toDate}`, PAGE_MARGIN, 119, {
            width: usableWidth,
            height: 13,
            align: "center",
            lineBreak: false
        });
}

function drawRegister(doc, sheet, rowOffset) {
    const tableTop = 140;
    const usableWidth = PAGE_WIDTH - (PAGE_MARGIN * 2);
    const groupWidth = usableWidth / 5;
    const rollWidth = groupWidth / 2;
    const dateHeight = 29;
    const rowHeight = 17;

    for (let dateIndex = 0; dateIndex < 5; dateIndex += 1) {
        const groupX = PAGE_MARGIN + (dateIndex * groupWidth);
        drawCell(doc, {
            x: groupX,
            y: tableTop,
            width: groupWidth,
            height: dateHeight,
            text: sheet.dateLabels[dateIndex] || "",
            bold: true,
            fontSize: 8.2,
            fill: "#E7E7E7"
        });

        for (let rowIndex = 0; rowIndex < ROWS_PER_PAGE; rowIndex += 1) {
            const sourceRow = sheet.rows[rowOffset + rowIndex] || [];
            const y = tableTop + dateHeight + (rowIndex * rowHeight);
            const firstValue = sourceRow[dateIndex * 2] ?? "";
            const secondValue = sourceRow[(dateIndex * 2) + 1] ?? "";
            drawCell(doc, { x: groupX, y, width: rollWidth, height: rowHeight, text: firstValue, fontSize: 7.7 });
            drawCell(doc, { x: groupX + rollWidth, y, width: rollWidth, height: rowHeight, text: secondValue, fontSize: 7.7 });
        }
    }
}

function pageEntries(spec) {
    return spec.sheets.flatMap(sheet => {
        const count = Math.max(1, Math.ceil(sheet.dataRowCount / ROWS_PER_PAGE));
        return Array.from({ length: count }, (_, index) => ({
            sheet,
            rowOffset: index * ROWS_PER_PAGE
        }));
    });
}

function drawPage(doc, spec, entry, pageNumber, pageCount) {
    drawHeader(doc, spec);
    drawRegister(doc, entry.sheet, entry.rowOffset);
    doc.font(BOLD_FONT).fontSize(8.5).fillColor("#000000")
        .text("Signature ____________________", PAGE_WIDTH - 220, PAGE_HEIGHT - 48, {
            width: 195,
            height: 14,
            align: "right",
            lineBreak: false
        });
    doc.font(REGULAR_FONT).fontSize(7.5).fillColor("#555555")
        .text(`Page ${pageNumber} of ${pageCount}`, PAGE_MARGIN, PAGE_HEIGHT - 30, {
            width: PAGE_WIDTH - (PAGE_MARGIN * 2),
            height: 12,
            align: "center",
            lineBreak: false
        });
}

function createAbsentStudentsPdf(spec) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            autoFirstPage: false,
            size: "A4",
            margins: 0,
            font: REGULAR_FONT_PATH,
            info: { Title: "Absent Students Register" }
        });
        doc.registerFont(REGULAR_FONT, REGULAR_FONT_PATH);
        doc.registerFont(BOLD_FONT, BOLD_FONT_PATH);

        const chunks = [];
        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const pages = pageEntries(spec);
        pages.forEach((entry, index) => {
            doc.addPage({ size: "A4", margins: 0 });
            drawPage(doc, spec, entry, index + 1, pages.length);
        });
        doc.end();
    });
}

module.exports = {
    ROWS_PER_PAGE,
    buildAbsentStudentsPdfSpec,
    createAbsentStudentsPdf
};
