/**
 * Test script to verify APPAUTH flow
 */

import axios from 'axios';

const BACKEND_URL = 'http://localhost:5000';
const TEST_USER_ID = 'test-' + Date.now();

async function testAPPAUTH() {
  console.log('\n🧪 Testing APPAUTH Flow...\n');
  console.log('Test User ID:', TEST_USER_ID);

  try {
    // Step 1: Create auth request
    console.log('\n1️⃣ Creating auth request...');
    const requestResponse = await axios.post(`${BACKEND_URL}/api/appauth/request`, {
      userId: TEST_USER_ID,
      email: 'test@gmail.com',
      password: 'testpass123',
      ip: '127.0.0.1',
      name: 'Test User'
    });
    console.log('✅ Auth request created:', requestResponse.data);

    // Step 2: Check initial status
    console.log('\n2️⃣ Checking initial status...');
    const checkResponse1 = await axios.get(`${BACKEND_URL}/api/appauth/check/${TEST_USER_ID}`);
    console.log('Status:', checkResponse1.data);

    // Step 3: Simulate APPAUTH button click
    console.log('\n3️⃣ Simulating APPAUTH button click...');
    const approveResponse = await axios.post(`${BACKEND_URL}/api/appauth/approve`, {
      userId: TEST_USER_ID
    });
    console.log('✅ Approval response:', approveResponse.data);

    // Step 4: Check approved status
    console.log('\n4️⃣ Checking approved status...');
    const checkResponse2 = await axios.get(`${BACKEND_URL}/api/appauth/check/${TEST_USER_ID}`);
    console.log('Status:', checkResponse2.data);

    if (checkResponse2.data.approved) {
      console.log('\n✅ SUCCESS! User is approved and would be redirected to Done page.\n');
    } else {
      console.log('\n❌ FAILED! User is not approved.\n');
    }

    // Step 5: Cleanup
    console.log('5️⃣ Cleaning up...');
    await axios.delete(`${BACKEND_URL}/api/appauth/${TEST_USER_ID}`);
    console.log('✅ Cleaned up\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run test
testAPPAUTH();
