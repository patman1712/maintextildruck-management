
const orders = [
    {
        id: 'o1',
        files: [
            { url: 'u1', type: 'print', status: 'pending', name: 'f1' },
            { url: 'u2', type: 'print', status: 'pending', name: 'f2' },
            { url: 'u3', type: 'print', status: 'pending', name: 'f3' },
            // Duplicate URL
            { url: 'u1', type: 'print', status: 'pending', name: 'f1-copy' }
        ]
    }
];

let selectedFiles: any[] = [];

const addOrderFiles = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const filesToAdd = (order.files || [])
        .filter(f => (f.type === 'print' || f.type === 'vector') && f.status !== 'ordered')
        .map(f => ({
            id: Math.random().toString(36),
            url: f.url,
            name: f.name,
            orderId: order.id,
            quantity: 1
        }));

    console.log(`Files to add: ${filesToAdd.length}`);

    const newFiles = filesToAdd.map(file => ({
        ...file,
        id: Math.random().toString(36).substr(2, 9),
        quantity: 1
    }));

    // Mock setSelectedFiles
    const prev = selectedFiles;
    
    // Logic from DTFOrdering.tsx
    const uniqueNewFiles = newFiles.filter(nf => !prev.some(pf => pf.url === nf.url && pf.orderId === nf.orderId));
          
    if (uniqueNewFiles.length === 0) {
        selectedFiles = prev.map(pf => {
            const matchingNew = newFiles.find(nf => nf.url === pf.url && nf.orderId === pf.orderId);
            if (matchingNew) {
                return { ...pf, quantity: pf.quantity + matchingNew.quantity };
            }
            return pf;
        });
    } else {
        selectedFiles = [...prev, ...uniqueNewFiles];
    }
};

addOrderFiles('o1');
console.log('Result 1:', selectedFiles.length, selectedFiles.map(f => f.name));

// Add again
addOrderFiles('o1');
console.log('Result 2:', selectedFiles.length, selectedFiles.map(f => `${f.name} (${f.quantity})`));
