
const net = require('net');
const HOST = 'w0138694.kasserver.com';
const PORT = 25;

console.log(`--- Node.js Port 25 Connectivity Test ---`);
console.log(`Target: ${HOST}:${PORT}`);

const socket = new net.Socket();
socket.setTimeout(5000);

const startTime = Date.now();

socket.connect(PORT, HOST, () => {
    const time = Date.now() - startTime;
    console.log(`✅ TCP Connected successfully to Port 25 in ${time}ms!`);
    socket.destroy();
});

socket.on('timeout', () => {
    console.log('❌ TCP Timeout (Port 25)');
    socket.destroy();
});

socket.on('error', (err) => {
    console.log(`❌ TCP Error (Port 25): ${err.message}`);
    socket.destroy();
});
