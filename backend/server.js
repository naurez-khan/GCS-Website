require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const courseRoutes = require("./routes/courseRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const resultRoutes = require("./routes/resultRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters");
}


// =========================
// MIDDLEWARE
// =========================

const allowedOrigins = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

if (allowedOrigins.length > 0) {
    app.use(cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error("Origin is not allowed by CORS"));
        },
        credentials: true
    }));
}

app.disable("x-powered-by");
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    if (req.path.startsWith("/api/")) {
        res.setHeader("Cache-Control", "no-store");
    }
    next();
});

app.use(express.json({ limit: "10mb" }));

app.use(express.urlencoded({
    extended: true
}));

app.use(cookieParser());


// =========================
// FRONTEND
// =========================

// Serves everything inside:
// E:\math-department-portal\frontend

const courseWorkflowPages = [
    "/edit-class.html",
    "/import-students.html",
    "/take-attendance.html",
    "/course-marks.html",
    "/attendance-history.html"
];

app.get(courseWorkflowPages, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/course.html"));
});

app.use(
    express.static(
        path.join(__dirname, "../frontend"),
        {
            etag: false,
            maxAge: 0,
            setHeaders(response) {
                response.setHeader("Cache-Control", "no-store");
            }
        }
    )
);


// =========================
// API ROUTES
// =========================

app.use("/api/auth", authRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/courses", courseRoutes);

app.use("/api/attendance", attendanceRoutes);
app.use("/api/results", resultRoutes);


// =========================
// DATABASE TEST
// =========================

app.get("/api/db-test", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT NOW()"
        );

        res.json({
            success: true,
            message: "PostgreSQL connected!",
            time: result.rows[0].now
        });

    } catch (error) {

        console.error(
            "Database error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });

    }

});


// =========================
// START SERVER
// =========================

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
