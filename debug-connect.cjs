
const net = require('net');
const tls = require('tls');

const HOST = 'w0138694.kasserver.com';
const PORT = 465;

console.log(`--- Node.js Connectivity Test ---`);
console.log(`Target: ${HOST}:${PORT}`);

// 1. TCP Connect
console.log(`\n1. Testing TCP Connection...`);
const socket = new net.Socket();
socket.setTimeout(5000);

const startTime = Date.now();

socket.connect(PORT, HOST, () => {
    const time = Date.now() - startTime;
    console.log(`✅ TCP Connected successfully in ${time}ms!`);
    socket.destroy();
    
    // 2. TLS Connect
    testTLS();
});

socket.on('timeout', () => {
    console.log('❌ TCP Timeout');
    socket.destroy();
});

socket.on('error', (err) => {
    console.log(`❌ TCP Error: ${err.message}`);
    socket.destroy();
});

function testTLS() {
    console.log(`\n2. Testing TLS Handshake...`);
    try {
        const tlsSocket = tls.connect(PORT, HOST, {
            servername: HOST,
            rejectUnauthorized: false,
            timeout: 5000
        }, () => {
            console.log('✅ TLS Handshake successful!');
            console.log('Cipher:', tlsSocket.getCipher().name);
            console.log('Protocol:', tlsSocket.getProtocol());
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
