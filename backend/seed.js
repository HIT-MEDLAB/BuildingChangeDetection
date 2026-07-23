require('dotenv').config();

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: false
});

async function seedUser() {
    try{
        const passwordHash = await bcrypt.hash('password123', 10);
        await pool.query(
            `INSERT INTO users (email, password_hash, name, role)
             VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
             ['yair@medlab.hit.ac.il', passwordHash, 'Yair Katsav', 'inspector']
        );
        console.log ('Test user created: email: yair@medlab.hit.ac.il, password: password123 (role: inspector)');

        // US-6: seed one admin so there's always a way into /api/admin without
        // manual SQL after a fresh docker-compose up.
        const adminPasswordHash = await bcrypt.hash('admin123', 10);
        await pool.query(
            `INSERT INTO users (email, password_hash, name, role)
             VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
             ['admin@medlab.hit.ac.il', adminPasswordHash, 'System Admin', 'admin']
        );
        console.log ('Admin user created: email: admin@medlab.hit.ac.il, password: admin123 (role: admin)');
    } catch (err){
        console.error('Error seeding user:', err);
    } finally{
        pool.end();
    }
}

seedUser();