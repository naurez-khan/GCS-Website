async function backfillStudentAbsences(client, courseId, studentIds) {
    const normalizedStudentIds = [...new Set((studentIds || []).map(Number))]
        .filter(studentId => Number.isInteger(studentId) && studentId > 0);
    if (!normalizedStudentIds.length) return 0;

    const result = await client.query(
        `WITH recorded_lecture_dates AS (
             SELECT DISTINCT attendance_date
             FROM attendance
             WHERE course_id = $1
               AND status IN ('present', 'absent')
               AND EXTRACT(DOW FROM attendance_date) <> 0
               AND NOT EXISTS (
                   SELECT 1
                   FROM course_holidays
                   WHERE course_holidays.course_id = $1
                     AND course_holidays.holiday_date = attendance.attendance_date
               )
         )
         INSERT INTO attendance (course_id, student_id, attendance_date, status)
         SELECT $1, new_students.student_id, recorded_lecture_dates.attendance_date, 'absent'
         FROM UNNEST($2::INTEGER[]) AS new_students(student_id)
         CROSS JOIN recorded_lecture_dates
         ON CONFLICT DO NOTHING`,
        [courseId, normalizedStudentIds]
    );

    return result.rowCount || 0;
}

module.exports = { backfillStudentAbsences };
