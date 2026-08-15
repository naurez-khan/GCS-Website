const resultForm = document.getElementById("resultForm");
const resultPanel = document.getElementById("resultPanel");
const message = document.getElementById("message");

const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const score = value => value === null || value === undefined ? "Not entered" : escapeHtml(value);

function assessmentRows(items) {
    return items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${score(item.marks)}</td><td>${score(item.max_marks)}</td></tr>`).join("");
}

function renderResult(result) {
    const rows = [assessmentRows(result.assignments), assessmentRows(result.quizzes)];
    if (result.midterm) rows.push(`<tr><td>Midterm</td><td>${score(result.midterm.marks)}</td><td>${score(result.midterm.maxMarks)}</td></tr>`);
    if (result.final) rows.push(`<tr><td>Final exam</td><td>${score(result.final.marks)}</td><td>${score(result.final.maxMarks)}</td></tr>`);

    resultPanel.innerHTML = `
        <div class="result-heading"><div><p class="eyebrow">PUBLISHED RESULT</p><h2>${escapeHtml(result.course.name)}</h2></div>
        <div class="result-score"><strong>${result.summary.percentage === null ? "—" : `${escapeHtml(result.summary.percentage)}%`}</strong><span>overall</span></div></div>
        <div class="result-meta">
            <div><span>Course code</span><strong>${escapeHtml(result.course.code || "—")}</strong></div>
            <div><span>Roll number</span><strong>${escapeHtml(result.student.rollNumber)}</strong></div>
            <div><span>Student</span><strong>${escapeHtml(result.student.name || "Name not recorded")}</strong></div>
            <div><span>Program</span><strong>${escapeHtml(result.course.program || "—")}</strong></div>
            <div><span>Semester / Section</span><strong>${escapeHtml([result.course.semester, result.course.section].filter(Boolean).join(" / ") || "—")}</strong></div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Assessment</th><th>Marks</th><th>Maximum</th></tr></thead><tbody>${rows.join("") || '<tr><td colspan="3">No assessments configured.</td></tr>'}</tbody>
        <tfoot><tr><th>Total</th><th>${escapeHtml(result.summary.earned)}</th><th>${escapeHtml(result.summary.maximum)}</th></tr></tfoot></table></div>
        <div class="attendance-card"><span>Attendance</span><strong>${result.attendance.percentage === null ? "No attendance recorded" : `${escapeHtml(result.attendance.percentage)}% (${escapeHtml(result.attendance.present)}/${escapeHtml(result.attendance.total)})`}</strong></div>
        <p class="muted small">Teacher: ${escapeHtml(result.course.teacherName)}</p>`;
    resultPanel.classList.remove("hidden");
}

resultForm.addEventListener("submit", async event => {
    event.preventDefault();
    message.className = "notice hidden";
    resultPanel.classList.add("hidden");
    const button = resultForm.querySelector("button");
    button.disabled = true;
    try {
        const response = await fetch("/api/results/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                resultCode: document.getElementById("resultCode").value.trim(),
                rollNumber: document.getElementById("rollNumber").value.trim()
            })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Result lookup failed");
        renderResult(data.result);
    } catch (error) {
        message.textContent = error.message;
        message.className = "notice error";
    } finally {
        button.disabled = false;
    }
});
