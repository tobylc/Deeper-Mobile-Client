// Test script to diagnose Stripe subscription issue
const fetch = require('node-fetch');

async function testSubscription() {
  try {
    // First, try to login to get a valid session
    console.log('Testing subscription endpoint...');
    
    const response = await fetch('http://localhost:5000/api/subscription/upgrade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Test-Script'
      },
      body: JSON.stringify({
        tier: 'advanced',
        discountPercent: 50
      })
    });
    
    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSubscription();