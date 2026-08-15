require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./config/db");

async function createAdmin() {

    try {

        const name = String(process.env.ADMIN_NAME || "Department Admin").trim();
        const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
        const password = String(process.env.ADMIN_PASSWORD || "");

        if (!email || password.length < 12) {
            throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in .env");
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Insert admin
        const result = await pool.query(
            `
            INSERT INTO users
            (name, email, password_hash, role, is_active)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, email, role
            `,
            [
                name,
                email,
                passwordHash,
                "admin",
                true
            ]
        );

        console.log("Admin created successfully!");
        console.log(result.rows[0]);

    } catch (error) {

        console.error("Error creating admin:");
        console.error(error);

    } finally {

        await pool.end();

    }
}

createAdmin();
