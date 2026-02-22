import fetch from 'node-fetch';

async function checkOrders() {
  try {
    const response = await fetch('http://localhost:8080/api/orders');
    const data = await response.json();
    
    console.log('Success:', data.success);
    if (data.data) {
      console.log('Orders count:', data.data.length);
      data.data.forEach((order: any) => {
        console.log(`Order: ${order.title}, Customer: ${order.customer_name}`);
        console.log('Files:', JSON.stringify(order.files, null, 2));
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkOrders();
