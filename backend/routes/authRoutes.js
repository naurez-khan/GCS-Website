const express = require("express");

const {
    login,
    logout,
    getCurrentUser,
    selectRole,
    changePassword
} = require("../controllers/authController");

const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.post("/select-role", authenticate, selectRole);
router.get("/me", authenticate, getCurrentUser);
router.post("/change-password", authenticate, changePassword);

module.exports = router;
