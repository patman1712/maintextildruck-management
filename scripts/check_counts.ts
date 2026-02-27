
import db from '../api/db.js';

const customers = db.prepare('SELECT count(*) as c FROM customers').get();
const orders = db.prepare('SELECT count(*) as c FROM orders').get();
const files = db.prepare('SELECT count(*) as c FROM files').get();

console.log('Counts:');
console.log('Customers:', customers);
console.log('Orders:', orders);
console.log('Files:', files);
