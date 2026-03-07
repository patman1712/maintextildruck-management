
import tls from 'tls';
import net from 'net';
import dns from 'dns';

const host = 'w0138694.kasserver.com';
const port = 465;

console.log('--- Debugging SMTP Connection ---');

// 1. DNS Lookup
dns.lookup(host, { family: 4 }, (err, address, family) => {
    if (err) {
        console.error('DNS Error:', err);
        return;
    }
    console.log(`DNS Resolved: ${address} (IPv${family})`);

    // 2. TCP Connect
    console.log('Attempting TCP connect to IP...');
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.connect(port, address, () => {
        console.log('TCP Connected successfully!');
        socket.destroy();
        
        // 3. TLS Connect using RESOLVED IP
        console.log(`Attempting TLS connect to IP ${address} with servername ${host}...`);
        try {
            const tlsSocket = tls.connect(port, address, {
                servername: host, // SNI
                timeout: 5000,
                rejectUnauthorized: false 
            }, () => {
                console.log('TLS Handshake success!');
                console.log('Cipher:', tlsSocket.getCipher());
                tlsSocket.end();
            });
            
            tlsSocket.on('error', (e) => console.error('TLS Error:', e));
            tlsSocket.on('timeout', () => {
                console.error('TLS Timeout');
                tlsSocket.destroy();
            });
        } catch (e) {
            console.error('TLS Exception:', e);
        }
    });

    socket.on('error', (e) => console.error('TCP Error:', e));
    socket.on('timeout', () => {
        console.error('TCP Timeout');
        socket.destroy();
    });
});
