
const nodemailer = require('nodemailer');

// Read config from command line arguments (base64 encoded JSON)
const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node test-email.js <base64-json-config>');
    process.exit(1);
}

let config;
try {
    const jsonStr = Buffer.from(args[0], 'base64').toString('utf-8');
    config = JSON.parse(jsonStr);
} catch (e) {
    console.error('Failed to parse config:', e.message);
    process.exit(1);
}

console.log(`--- External SMTP Test ---`);
console.log(`Host: ${config.host}`);
console.log(`Port: ${config.port}`);
console.log(`Secure: ${config.secure}`);
console.log(`User: ${config.auth.user}`);

async function run() {
    // Construct transport config exactly as it should be
    const transportConfig = {
        host: config.host, // Use hostname directly, let Node handle DNS
        port: Number(config.port),
        secure: Boolean(config.secure),
        auth: {
            user: config.auth.user,
            pass: config.auth.pass
        },
        tls: {
            servername: config.host, // SNI
            rejectUnauthorized: !config.ignore_certs,
            minVersion: 'TLSv1'
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        debug: true,
        logger: true
    };

    try {
        const transporter = nodemailer.createTransport(transportConfig);

        console.log('1. Verifying connection...');
        await transporter.verify();
        console.log('✅ VERIFY_SUCCESS');

        console.log('2. Sending test mail...');
        await transporter.sendMail({
            from: config.sender_email,
            to: config.test_email,
            subject: 'Test Email - System Einstellungen',
            text: 'Dies ist eine Test-Email um die SMTP-Einstellungen zu überprüfen.\n\nErfolgreich gesendet!',
            html: '<h3>SMTP Test erfolgreich!</h3><p>Dies ist eine Test-Email um die SMTP-Einstellungen zu überprüfen.</p>'
        });
        console.log('✅ SEND_SUCCESS');
        process.exit(0);
    } catch (err) {
        console.error('❌ ERROR:', err.message);
        if (err.code) console.error('CODE:', err.code);
        // Print full error for debugging
        console.error(JSON.stringify(err, Object.getOwnPropertyNames(err)));
        process.exit(1);
    }
}

run();
