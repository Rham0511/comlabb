import fetch from 'node-fetch';

// Test data
const testBorrowRequest = {
  borrowerName: 'Test Student',
  borrowerType: 'Student',
  departmentInfo: 'BS Information Technology • 3rd Year',
  instructorName: 'Dr. Smith',
  equipmentId: 'LAB-001',
  equipmentName: 'Multimeter',
  quantity: 1,
  borrowDate: new Date().toISOString().split('T')[0],
  borrowStartTime: '09:00',
  expectedReturnDate: new Date().toISOString().split('T')[0],
  expectedReturnTime: '11:00',
  purpose: 'Electronics laboratory experiment',
  processedBy: 'Student'
};

async function testBorrowAPI() {
  try {
    console.log('Testing Borrow Equipment API...');
    console.log('Payload:', JSON.stringify(testBorrowRequest, null, 2));
    
    const response = await fetch('http://localhost:3000/api/borrow-records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testBorrowRequest)
    });

    const data = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Borrow record created successfully!');
      console.log('Record ID:', data.id);
    } else {
      console.log('❌ Error creating borrow record:', data.error);
    }
  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
  }
}

testBorrowAPI();
