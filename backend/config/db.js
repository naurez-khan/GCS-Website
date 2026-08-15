const { Pool } = require("pg");

const connection = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL
    }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };

const pool = new Pool({
    ...connection,
    max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 5 : 10)),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: Boolean(process.env.VERCEL)
});

module.exports = pool;
