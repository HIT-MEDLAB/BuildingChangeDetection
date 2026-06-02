require('dotenv').config();
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
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
            `INSERT INTO users (email, password_hash, name)
             VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
             ['yair@medlab.hit.ac.il', passwordHash, 'Yair Katsav']
        );
        console.log ('Test user created: email: yair@medlab.hit.ac.il, password: password123');
    } catch (err){
        console.error(' Error seeding user:', err);
    } finally{
        pool.end();
    }
}

seedUser();