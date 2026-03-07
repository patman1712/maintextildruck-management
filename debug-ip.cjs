
const net = require('net');
const tls = require('tls');

const HOST = 'w0138694.kasserver.com';
const IP = '85.13.142.85';
const PORT = 465;

console.log(`--- Node.js IP Connectivity Test ---`);
console.log(`Target: ${IP}:${PORT} (Host: ${HOST})`);

// 1. TCP Connect via IP
console.log(`\n1. Testing TCP Connection to IP...`);
const socket = new net.Socket();
socket.setTimeout(5000);

const startTime = Date.now();

socket.connect(PORT, IP, () => {
    const time = Date.now() - startTime;
    console.log(`✅ TCP Connected successfully to IP in ${time}ms!`);
    socket.destroy();
    
    // 2. TLS Connect via IP (with SNI)
    testTLS();
});

socket.on('timeout', () => {
    console.log('❌ TCP Timeout (Connecting to IP)');
    socket.destroy();
});

socket.on('error', (err) => {
    console.log(`❌ TCP Error (Connecting to IP): ${err.message}`);
    socket.destroy();
});

function testTLS() {
    console.log(`\n2. Testing TLS Handshake to IP (with SNI)...`);
    try {
        const tlsSocket = tls.connect(PORT, IP, {
            servername: HOST, // SNI is critical here!
            rejectUnauthorized: false,
            timeout: 5000
        }, () => {
            console.log('✅ TLS Handshake successful!');
            console.log('Cipher:', tlsSocket.getCipher().name);
            tlsSocket.end();
        });

        tlsSocket.on('error', (err) => {
            console.log(`❌ TLS Error: ${err.message}`);
        });

        tlsSocket.on('timeout', () => {
            console.log('❌ TLS Timeout');
            tlsSocket.destroy();
        });
    } catch (e) {
        console.log(`❌ TLS Exception: ${e.message}`);
    }
}
