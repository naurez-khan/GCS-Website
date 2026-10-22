const PDFDocument = require("pdfkit");
const fs = require("node:fs");
const path = require("node:path");

const PAGE_WIDTH = 841.89; // A4 Landscape
const PAGE_HEIGHT = 595.28;
const PAGE_MARGIN_X = 24;
const ROWS_PER_PAGE = 22;

const DEFAULT_LOGO_PATH = path.join(__dirname, "../../frontend/assets/department-logo.png");
const REGULAR_FONT_PATH = path.join(__dirname, "../../frontend/assets/fonts/poppins/poppins-latin-400-normal.ttf");
const BOLD_FONT_PATH = path.join(__dirname, "../../frontend/assets/fonts/poppins/poppins-latin-700-normal.ttf");

const REGULAR_FONT = "PortalPoppins";
const BOLD_FONT = "PortalPoppinsBold";

function compareRollNumbers(left, right) {
    return String(left).localeCompare(String(right), undefined, { numeric: true });
}

function fitText(doc, text, x, y, width, height, options = {}) {
    const value = String(text ?? "");
    let fontSize = options.fontSize || 7;
    doc.font(options.bold ? BOLD_FONT : REGULAR_FONT);
    doc.fontSize(fontSize);
    while (fontSize > 4.5 && doc.widthOfString(value) > width - 4) {
        fontSize -= 0.3;
        doc.fontSize(fontSize);
    }
    doc.fontSize(fontSize).fillColor(options.color || "#000000");
    const textHeight = doc.heightOfString(value, { width: width - 4, align: options.align || "center", lineGap: 0 });
    doc.text(value, x + 2, y + Math.max(1, (height - textHeight) / 2), {
        width: width - 4,
        height: height - 2,
        align: options.align || "center",
        lineGap: 0
    });
}

function drawCell(doc, x, y, width, height, text = "", options = {}) {
    if (options.fill) {
        doc.save().fillColor(options.fill).rect(x, y, width, height).fill().restore();
    }
    doc.save()
        .lineWidth(options.lineWidth || 0.5)
        .strokeColor(options.strokeColor || "#333333")
        .rect(x, y, width, height)
        .stroke()
        .restore();
    fitText(doc, text, x, y, width, height, options);
}

function renderHeader(doc, spec, pageNumber, totalPages) {
    try {
        if (fs.existsSync(DEFAULT_LOGO_PATH)) {
            doc.image(DEFAULT_LOGO_PATH, PAGE_MARGIN_X, 16, { fit: [46, 46] });
        }
    } catch (e) {
        // Logo optional fallback
    }

    const contentWidth = PAGE_WIDTH - (PAGE_MARGIN_X * 2);
    const centerX = PAGE_MARGIN_X + 50;
    const centerWidth = contentWidth - 100;

    doc.font(BOLD_FONT).fontSize(14).fillColor("#111827")
        .text("GOVT. GRADUATE COLLEGE CIVIL LINES SHEIKHUPURA", centerX, 16, { width: centerWidth, align: "center" });

    doc.font(BOLD_FONT).fontSize(10).fillColor("#1e3a8a")
        .text("DEPARTMENT OF MATHEMATICS — CONSOLIDATED ATTENDANCE RECORD", centerX, 33, { width: centerWidth, align: "center" });

    const metaParts = [
        `Program: BS Mathematics`,
        `Semester: ${spec.semester}`,
        spec.section ? `Section: ${spec.section}` : null,
        spec.shift ? `Shift: ${spec.shift}` : null,
        spec.periodLabel ? `Period: ${spec.periodLabel}` : "Full Semester"
    ].filter(Boolean).join("   |   ");

    doc.font(REGULAR_FONT).fontSize(7.5).fillColor("#374151")
        .text(metaParts, centerX, 47, { width: centerWidth, align: "center" });
}

function createBsMathConsolidatedAttendancePdf(spec) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            autoFirstPage: false,
            size: "A4",
            layout: "landscape",
            margins: 0,
            font: REGULAR_FONT_PATH,
            info: { Title: `BS Mathematics - Consolidated Attendance - Semester ${spec.semester}` }
        });

        doc.registerFont(REGULAR_FONT, REGULAR_FONT_PATH);
        doc.registerFont(BOLD_FONT, BOLD_FONT_PATH);

        const chunks = [];
        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const students = [...(spec.students || [])].sort((a, b) => compareRollNumbers(a.rollNumber, b.rollNumber));
        const courses = spec.courses || [];
        const totalPages = Math.max(1, Math.ceil(students.length / ROWS_PER_PAGE));

        const contentX = PAGE_MARGIN_X;
        const totalContentWidth = PAGE_WIDTH - (PAGE_MARGIN_X * 2);

        const srWidth = 26;
        const rollWidth = 54;
        const studentFixedColWidth = srWidth + rollWidth;

        const overallPresWidth = 36;
        const overallTotWidth = 36;
        const overallPctWidth = 42;
        const overallGroupWidth = overallPresWidth + overallTotWidth + overallPctWidth;

        const courseAvailableWidth = totalContentWidth - studentFixedColWidth - overallGroupWidth;
        const numCourses = Math.max(1, courses.length);
        const perCourseWidth = courseAvailableWidth / numCourses;

        const tableStartY = 64;
        const groupHeaderH = 26;
        const subHeaderH = 14;
        const headerTotalH = groupHeaderH + subHeaderH;
        const rowH = 18;

        for (let page = 1; page <= totalPages; page += 1) {
            doc.addPage({ size: "A4", layout: "landscape", margins: 0 });

            renderHeader(doc, spec, page, totalPages);

            let currentX = contentX;

            // Roll identity headers (no student name column)
            drawCell(doc, currentX, tableStartY, srWidth, headerTotalH, "Sr #", { bold: true, fontSize: 7.2, fill: "#e5e7eb" });
            currentX += srWidth;
            drawCell(doc, currentX, tableStartY, rollWidth, headerTotalH, "Roll No", { bold: true, fontSize: 7.2, fill: "#e5e7eb" });
            currentX += rollWidth;

            // Course headers (single column per course, without percent column)
            courses.forEach(course => {
                const courseTitle = `${course.courseCode || course.name}\n${course.teacherName || ""}`.trim();
                drawCell(doc, currentX, tableStartY, perCourseWidth, groupHeaderH, courseTitle, {
                    bold: true,
                    fontSize: 6.5,
                    fill: "#dbeafe"
                });

                drawCell(doc, currentX, tableStartY + groupHeaderH, perCourseWidth, subHeaderH, `Att / Tot (${course.totalLectures || 0})`, {
                    bold: true,
                    fontSize: 6,
                    fill: "#eff6ff"
                });

                currentX += perCourseWidth;
            });

            // Overall Summary headers
            drawCell(doc, currentX, tableStartY, overallGroupWidth, groupHeaderH, "Overall Summary", {
                bold: true,
                fontSize: 7,
                fill: "#fef3c7"
            });
            drawCell(doc, currentX, tableStartY + groupHeaderH, overallPresWidth, subHeaderH, "Attended", {
                bold: true,
                fontSize: 6,
                fill: "#fffbeb"
            });
            drawCell(doc, currentX + overallPresWidth, tableStartY + groupHeaderH, overallTotWidth, subHeaderH, "Total", {
                bold: true,
                fontSize: 6,
                fill: "#fffbeb"
            });
            drawCell(doc, currentX + overallPresWidth + overallTotWidth, tableStartY + groupHeaderH, overallPctWidth, subHeaderH, "%", {
                bold: true,
                fontSize: 6.5,
                fill: "#fffbeb"
            });

            // Rows on this page
            const startIdx = (page - 1) * ROWS_PER_PAGE;
            const pageStudents = students.slice(startIdx, startIdx + ROWS_PER_PAGE);

            let rowY = tableStartY + headerTotalH;
            pageStudents.forEach((st, idx) => {
                const isEven = idx % 2 === 0;
                const rowFill = isEven ? "#ffffff" : "#f9fafb";
                const isShortAttendance = (st.overall?.percentage || 0) < 75;

                let colX = contentX;
                drawCell(doc, colX, rowY, srWidth, rowH, String(startIdx + idx + 1), { fontSize: 6.8, fill: rowFill });
                colX += srWidth;
                drawCell(doc, colX, rowY, rollWidth, rowH, String(st.rollNumber || ""), { bold: true, fontSize: 7, fill: rowFill });
                colX += rollWidth;

                // Course stats (single column per course)
                courses.forEach(course => {
                    const cStat = st.courses?.[course.id] || { attended: 0, total: course.totalLectures || 0, pct: 0 };
                    const ptText = `${cStat.attended} / ${course.totalLectures || 0}`;

                    drawCell(doc, colX, rowY, perCourseWidth, rowH, ptText, {
                        fontSize: 6.8,
                        fill: rowFill,
                        bold: cStat.pct < 75,
                        color: cStat.pct < 75 ? "#b91c1c" : "#000000"
                    });
                    colX += perCourseWidth;
                });

                // Overall stats
                const ov = st.overall || { totalAttended: 0, totalLectures: 0, percentage: 0 };
                drawCell(doc, colX, rowY, overallPresWidth, rowH, String(ov.totalAttended), { fontSize: 6.8, fill: rowFill });
                drawCell(doc, colX + overallPresWidth, rowY, overallTotWidth, rowH, String(ov.totalLectures), { fontSize: 6.8, fill: rowFill });
                drawCell(doc, colX + overallPresWidth + overallTotWidth, rowY, overallPctWidth, rowH, `${ov.percentage.toFixed(1)}%`, {
                    bold: true,
                    fontSize: 7,
                    fill: isShortAttendance ? "#fee2e2" : rowFill,
                    color: isShortAttendance ? "#991b1b" : "#065f46"
                });

                rowY += rowH;
            });

            // Footer info
            const footerY = PAGE_HEIGHT - 32;
            doc.font(REGULAR_FONT).fontSize(6.5).fillColor("#6b7280")
                .text(`Report Generated: ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`, contentX, footerY, { align: "left" });
            doc.font(REGULAR_FONT).fontSize(6.5).fillColor("#6b7280")
                .text(`Page ${page} of ${totalPages}`, contentX, footerY, { width: totalContentWidth, align: "right" });

            // If last page, render signatures
            if (page === totalPages) {
                const sigY = footerY - 24;
                doc.font(BOLD_FONT).fontSize(7).fillColor("#111827");
                doc.text("__________________________", contentX + 40, sigY - 10);
                doc.text("Prepared by / Incharge", contentX + 40, sigY);

                doc.text("__________________________", contentX + (totalContentWidth / 2) - 50, sigY - 10);
                doc.text("Semester Coordinator", contentX + (totalContentWidth / 2) - 50, sigY);

                doc.text("__________________________", contentX + totalContentWidth - 140, sigY - 10);
                doc.text("Head, Department of Mathematics", contentX + totalContentWidth - 140, sigY);
            }
        }

        doc.end();
    });
}

module.exports = {
    createBsMathConsolidatedAttendancePdf,
    compareRollNumbers
};
