const express = require("express");
const { getStudentResult } = require("../controllers/resultController");

const router = express.Router();

const attempts = new Map();
router.use((req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowMs = 60 * 1000;
    const current = attempts.get(key);

    if (!current || current.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
        return next();
    }

    current.count += 1;
    if (current.count > 60) {
        res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
        return res.status(429).json({ success: false, message: "Too many result lookups. Try again shortly." });
    }

    next();
});

router.post("/lookup", getStudentResult);

module.exports = router;
