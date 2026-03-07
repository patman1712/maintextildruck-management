
const nodemailer = require('nodemailer');
const dns = require('dns');
const net = require('net');
const tls = require('tls');

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

console.log(`--- External SMTP Test (Diagnostic) ---`);
console.log(`Target: ${config.host}:${config.port}`);

async function resolveHost(hostname) {
    return new Promise((resolve, reject) => {
        dns.lookup(hostname, { family: 4 }, (err, address) => {
            if (err) reject(err);
            else resolve(address);
        });
    });
}

async function checkRawConnection(host, port, secure, servername) {
    console.log('1. Testing Raw TCP/TLS Connection...');
    return new Promise((resolve, reject) => {
        if (secure) {
            // TLS Connection
            const socket = tls.connect(port, host, {
                servername: servername,
                rejectUnauthorized: false, // Always loose for raw test
                timeout: 10000
            }, () => {
                console.log('   ✅ Raw TLS Connection Successful!');
                console.log(`   Cipher: ${socket.getCipher().name}`);
                socket.end();
                resolve(true);
            });
            socket.on('error', (err) => {
                console.log(`   ❌ Raw TLS Error: ${err.message}`);
                resolve(false);
            });
            socket.on('timeout', () => {
                console.log(`   ❌ Raw TLS Timeout`);
                socket.destroy();
                resolve(false);
            });
        } else {
            // TCP Connection
            const socket = new net.Socket();
            socket.setTimeout(10000);
            socket.connect(port, host, () => {
                console.log('   ✅ Raw TCP Connection Successful!');
                socket.end();
                resolve(true);
            });
            socket.on('error', (err) => {
                console.log(`   ❌ Raw TCP Error: ${err.message}`);
                resolve(false);
            });
            socket.on('timeout', () => {
                console.log(`   ❌ Raw TCP Timeout`);
                socket.destroy();
                resolve(false);
            });
        }
    });
}

async function run() {
    let targetHost = config.host;
    let sniHost = config.host;

    // 1. Resolve DNS
    try {
        console.log(`\nResolving DNS for ${config.host}...`);
        const ip = await resolveHost(config.host);
        console.log(`✅ Resolved to: ${ip}`);
        targetHost = ip; 
    } catch (e) {
        console.log(`⚠️ DNS Resolution failed: ${e.message}. Using hostname.`);
    }

    // 2. Raw Check
    const rawSuccess = await checkRawConnection(targetHost, Number(config.port), Boolean(config.secure), sniHost);
    
    if (!rawSuccess) {
        console.log('\n❌ ABORTING: Even a raw connection failed. Firewall or Network issue!');
        console.log('Please check your firewall, antivirus, or ISP settings.');
        process.exit(1);
    }

    // 3. Nodemailer Check
    console.log('\n2. Testing Nodemailer (Application Logic)...');
    
    const transportConfig = {
        host: targetHost, 
        port: Number(config.port),
        secure: Boolean(config.secure),
        auth: {
            user: config.auth.user,
            pass: config.auth.pass
        },
        tls: {
            servername: sniHost,
            rejectUnauthorized: !config.ignore_certs,
            minVersion: 'TLSv1'
        },
        // Increased Timeouts
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        debug: true,
        logger: true
    };

    try {
        const transporter = nodemailer.createTransport(transportConfig);

        console.log('   Verifying connection...');
        await transporter.verify();
        console.log('✅ VERIFY_SUCCESS');

        console.log('   Sending test mail...');
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
        console.error('❌ NODEMAILER ERROR:', err.message);
        if (err.code) console.error('CODE:', err.code);
        process.exit(1);
    }
}

run();
