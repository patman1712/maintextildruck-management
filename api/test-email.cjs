
const nodemailer = require('nodemailer');
const dns = require('dns');

// Read config from command line arguments (base64 encoded JSON)
const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node test-email.cjs <base64-json-config>');
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

console.log(`--- External SMTP Test (Enhanced) ---`);
console.log(`Target: ${config.host}:${config.port}`);
console.log(`User: ${config.auth.user}`);

async function resolveHost(hostname) {
    return new Promise((resolve, reject) => {
        dns.lookup(hostname, { family: 4 }, (err, address) => {
            if (err) reject(err);
            else resolve(address);
        });
    });
}

async function run() {
    let targetHost = config.host;
    let sniHost = config.host;

    // 1. Manually resolve IP to ensure IPv4
    try {
        console.log(`1. Resolving DNS for ${config.host}...`);
        const ip = await resolveHost(config.host);
        console.log(`   ✅ Resolved to: ${ip}`);
        targetHost = ip; // Connect to IP directly
    } catch (e) {
        console.log(`   ⚠️ DNS Resolution failed: ${e.message}. Using hostname.`);
    }

    // Construct transport config
    const transportConfig = {
        host: targetHost, 
        port: Number(config.port),
        secure: Boolean(config.secure),
        auth: {
            user: config.auth.user,
            pass: config.auth.pass
        },
        tls: {
            servername: sniHost, // Critical for SNI when connecting to IP
            rejectUnauthorized: !config.ignore_certs,
            minVersion: 'TLSv1'
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        debug: true,
        logger: true
    };

    try {
        const transporter = nodemailer.createTransport(transportConfig);

        console.log('2. Verifying connection...');
        await transporter.verify();
        console.log('✅ VERIFY_SUCCESS');

        console.log('3. Sending test mail...');
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
        process.exit(1);
    }
}

run();
