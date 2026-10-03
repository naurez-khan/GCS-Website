const PDFDocument = require("pdfkit");
const path = require("node:path");
const { buildAwardListSpec, studentRow } = require("../../frontend/award-list");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 18;
const ROWS_PER_SIDE = 25;
const REGULAR_FONT_PATH = path.join(__dirname, "../../frontend/assets/fonts/poppins/poppins-latin-400-normal.ttf");
const BOLD_FONT_PATH = path.join(__dirname, "../../frontend/assets/fonts/poppins/poppins-latin-700-normal.ttf");
const REGULAR_FONT = "PortalPoppins";
const BOLD_FONT = "PortalPoppinsBold";

function buildAwardListPdfSpec(options = {}) {
    const spec = buildAwardListSpec(options);
    if (!spec.isIntermediate) {
        throw new Error("The Intermediate award-list PDF is only available for Intermediate classes");
    }
    return {
        ...spec,
        filename: spec.filename.replace(/\.xlsx$/i, ".pdf")
    };
}

function drawCell(doc, { x, y, width, height, text = "", bold = false, fontSize = 7, align = "center", fill = null }) {
    if (fill) doc.save().fillColor(fill).rect(x, y, width, height).fill().restore();
    doc.save().lineWidth(0.55).strokeColor("#000000").rect(x, y, width, height).stroke().restore();
    doc.font(bold ? BOLD_FONT : REGULAR_FONT).fontSize(fontSize).fillColor("#000000");
    const value = String(text ?? "");
    const lineHeight = doc.currentLineHeight();
    doc.text(value, x + 2, y + Math.max(1, (height - lineHeight) / 2), {
        width: width - 4,
        height: Math.max(1, height - 2),
        align,
        lineBreak: false,
        ellipsis: true
    });
}

function drawMeta(doc, label, value, x, y, labelWidth, valueWidth) {
    doc.font(BOLD_FONT).fontSize(7.5).fillColor("#000000")
        .text(label, x, y, { width: labelWidth, height: 12, lineBreak: false });
    doc.font(REGULAR_FONT).fontSize(7.5)
        .text(String(value || ""), x + labelWidth, y, { width: valueWidth, height: 12, lineBreak: false, ellipsis: true });
}

function displayPercentage(value) {
    return typeof value === "number" && Number.isFinite(value)
        ? `${(value * 100).toFixed(1)}%`
        : value ?? "";
}

function drawTable(doc, spec, students, x, y, startSerial) {
    const widths = [27, 82, 72, 88];
    const headerHeight = 36;
    const rowHeight = 18;
    let columnX = x;
    spec.headers.forEach((header, index) => {
        drawCell(doc, {
            x: columnX,
            y,
            width: widths[index],
            height: headerHeight,
            text: header,
            bold: true,
            fontSize: index > 1 ? 6.2 : 6.8,
            fill: "#F2F2F2"
        });
        columnX += widths[index];
    });

    for (let offset = 0; offset < ROWS_PER_SIDE; offset += 1) {
        const row = studentRow(students[offset], startSerial + offset, spec.rollNumberType, { intermediate: true });
        row[3] = displayPercentage(row[3]);
        columnX = x;
        row.forEach((value, index) => {
            drawCell(doc, {
                x: columnX,
                y: y + headerHeight + (offset * rowHeight),
                width: widths[index],
                height: rowHeight,
                text: value,
                fontSize: 7.2
            });
            columnX += widths[index];
        });
    }
}

function drawPage(doc, spec, students, pageIndex, pageCount) {
    doc.font(BOLD_FONT).fontSize(14).fillColor("#000000")
        .text(spec.title, PAGE_MARGIN, 20, { width: PAGE_WIDTH - (PAGE_MARGIN * 2), height: 20, align: "center", lineBreak: false });
    doc.save().fillColor("#000000").rect(PAGE_MARGIN, 45, PAGE_WIDTH - (PAGE_MARGIN * 2), 24).fill().restore();
    doc.font(BOLD_FONT).fontSize(12).fillColor("#FFFFFF")
        .text(spec.reportTitle, PAGE_MARGIN, 50, { width: PAGE_WIDTH - (PAGE_MARGIN * 2), height: 16, align: "center", lineBreak: false });

    drawMeta(doc, "Award List For:", spec.examinationFor, PAGE_MARGIN, 78, 67, 129);
    drawMeta(doc, "Teacher's Name:", spec.teacherName, 335, 78, 76, 155);
    drawMeta(doc, "Class:", spec.className, PAGE_MARGIN, 96, 34, 88);
    drawMeta(doc, "Shift:", spec.shift, 335, 96, 27, 100);
    drawMeta(doc, "Subject:", spec.subject, PAGE_MARGIN, 114, 41, 190);
    drawMeta(doc, "Section:", spec.section, 335, 114, 39, 100);

    const tableTop = 138;
    drawTable(doc, spec, students.slice(0, ROWS_PER_SIDE), PAGE_MARGIN, tableTop, (pageIndex * 50) + 1);
    drawTable(doc, spec, students.slice(ROWS_PER_SIDE), 308, tableTop, (pageIndex * 50) + 26);

    const footerY = tableTop + 36 + (ROWS_PER_SIDE * 18) + 14;
    doc.font(BOLD_FONT).fontSize(7.2).fillColor("#000000")
        .text("No. of Pass: ______", PAGE_MARGIN, footerY, { width: 120, lineBreak: false })
        .text("No. of Fail: ______", 160, footerY, { width: 120, lineBreak: false })
        .text("No. of Absent: ______", 308, footerY, { width: 130, lineBreak: false })
        .text("Signature: __________", 445, footerY, { width: 130, align: "right", lineBreak: false });
    doc.font(REGULAR_FONT).fontSize(7).fillColor("#555555")
        .text(`Page ${pageIndex + 1} of ${pageCount}`, PAGE_MARGIN, PAGE_HEIGHT - 24, {
            width: PAGE_WIDTH - (PAGE_MARGIN * 2),
            align: "center",
            lineBreak: false
        });
}

function createAwardListPdf(spec) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            autoFirstPage: false,
            size: "A4",
            margins: 0,
            font: REGULAR_FONT_PATH,
            info: { Title: `${spec.subject || "Intermediate"} Award List` }
        });
        doc.registerFont(REGULAR_FONT, REGULAR_FONT_PATH);
        doc.registerFont(BOLD_FONT, BOLD_FONT_PATH);

        const chunks = [];
        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        spec.pages.forEach((students, pageIndex) => {
            doc.addPage({ size: "A4", margins: 0 });
            drawPage(doc, spec, students, pageIndex, spec.pages.length);
        });
        doc.end();
    });
}

module.exports = {
    ROWS_PER_SIDE,
    buildAwardListPdfSpec,
    createAwardListPdf
};
