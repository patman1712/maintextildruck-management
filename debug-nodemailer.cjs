
const nodemailer = require('nodemailer');

async function test() {
    console.log('--- Nodemailer Standalone Test ---');
    
    const config = {
        host: "w0138694.kasserver.com",
        port: 465,
        secure: true,
        auth: {
            user: "m035e53f",
            pass: "BITTE_HIER_PASSWORT_EINGEBEN" // I will ask user or just use a placeholder, wait, I can't know the password.
            // Actually, I don't need the password to test CONNECTION. 
            // Verify() will fail with EAUTH if connection works but password is wrong.
            // It will fail with ETIMEDOUT if connection fails.
        },
        tls: {
            servername: "w0138694.kasserver.com",
            rejectUnauthorized: false,
            minVersion: "TLSv1"
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        logger: true,
        debug: true
    };

    console.log('Config:', JSON.stringify(config, null, 2));

    try {
        const transporter = nodemailer.createTransport(config);
        console.log('Verifying connection...');
        await transporter.verify();
        console.log('✅ Connection Verified!');
    } catch (err) {
        console.log('❌ Error:', err.message);
        console.log('Code:', err.code);
    }
}

test();
