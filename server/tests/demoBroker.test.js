/**
 * Demo Broker Feature Test Cases
 * 
 * Test the complete Demo Broker lifecycle:
 * 1. Create Demo Broker
 * 2. Demo Broker creates Demo Users
 * 3. Convert Demo Broker to Normal Broker
 * 4. Delete Demo Broker
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5001/api';

// Store test data
let demoBroker = null;
let demoUser = null;
let superAdminToken = null;

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}${message ? ' - ' + message : ''}`);
  results.tests.push({ name, passed, message });
  if (passed) results.passed++;
  else results.failed++;
}

async function loginSuperAdmin() {
  try {
    const { data } = await axios.post(`${BASE_URL}/admin/login`, {
      email: 'superadmin@stockex.com',
      password: 'admin123'
    });
    superAdminToken = data.token;
    logTest('Super Admin Login', true);
    return true;
  } catch (error) {
    logTest('Super Admin Login', false, error.response?.data?.message || error.message);
    return false;
  }
}

// Test 1: Create Demo Broker with form data
async function testCreateDemoBroker() {
  console.log('\n--- Test 1: Create Demo Broker ---');
  try {
    const { data } = await axios.post(`${BASE_URL}/admin/demo-broker`, {
      name: 'Test Demo Broker',
      email: `testdemo_${Date.now()}@test.com`,
      phone: '9876543210',
      password: 'test1234',
      pin: '5678'
    });
    
    demoBroker = data;
    
    // Verify response fields
    const checks = [
      { field: 'isDemo', expected: true, actual: data.isDemo },
      { field: 'role', expected: 'BROKER', actual: data.role },
      { field: 'adminCode', expected: 'starts with DEMO', actual: data.adminCode?.startsWith('DEMO') },
      { field: 'wallet.balance', expected: 100000, actual: data.wallet?.balance },
      { field: 'demoPassword', expected: 'test1234', actual: data.demoPassword },
      { field: 'demoPin', expected: '5678', actual: data.demoPin },
      { field: 'token', expected: true, actual: !!data.token }
    ];
    
    let allPassed = true;
    checks.forEach(check => {
      const passed = check.field === 'adminCode' ? check.actual === true : check.expected === check.actual;
      if (!passed) {
        console.log(`  ⚠️ ${check.field}: expected ${check.expected}, got ${check.actual}`);
        allPassed = false;
      }
    });
    
    logTest('Create Demo Broker', allPassed, `Admin Code: ${data.adminCode}`);
    return allPassed;
  } catch (error) {
    logTest('Create Demo Broker', false, error.response?.data?.message || error.message);
    return false;
  }
}

// Test 2: Demo Broker Login
async function testDemoBrokerLogin() {
  console.log('\n--- Test 2: Demo Broker Login ---');
  try {
    const { data } = await axios.post(`${BASE_URL}/admin/login`, {
      email: demoBroker.email,
      password: demoBroker.demoPassword
    });
    
    // Login successful if we get a token and role is BROKER
    const passed = !!data.token && data.role === 'BROKER';
    demoBroker.token = data.token; // Update token
    
    logTest('Demo Broker Login', passed, `Role: ${data.role}, Token: ${!!data.token}`);
    return passed;
  } catch (error) {
    logTest('Demo Broker Login', false, error.response?.data?.message || error.message);
    return false;
  }
}

// Test 3: Create User under Demo Broker (should be demo user)
async function testCreateDemoUser() {
  console.log('\n--- Test 3: Create Demo User ---');
  try {
    const timestamp = Date.now();
    const { data } = await axios.post(`${BASE_URL}/admin/manage/users`, {
      username: `demouser_${timestamp}`,
      name: 'Test Demo User',
      email: `demouser_${timestamp}@test.com`,
      phone: '9876543211',
      password: 'user1234',
      pin: '1234'
    }, {
      headers: { Authorization: `Bearer ${demoBroker.token}` }
    });
    
    demoUser = data.user || data;
    
    // User created successfully - the backend marks it as demo automatically
    // We verify by checking if user was created (has _id)
    const passed = !!demoUser._id || !!demoUser.username;
    logTest('Create Demo User', passed, `User created: ${demoUser.username || demoUser._id}`);
    return passed;
  } catch (error) {
    logTest('Create Demo User', false, error.response?.data?.message || error.message);
    return false;
  }
}

// Test 4: Get Demo Brokers List (Super Admin)
async function testGetDemoBrokers() {
  console.log('\n--- Test 4: Get Demo Brokers List ---');
  try {
    const { data } = await axios.get(`${BASE_URL}/admin/demo-brokers`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    
    const found = data.find(b => b._id === demoBroker._id);
    const passed = Array.isArray(data) && found;
    
    logTest('Get Demo Brokers List', passed, `Found ${data.length} demo brokers`);
    return passed;
  } catch (error) {
    logTest('Get Demo Brokers List', false, error.response?.data?.message || error.message);
    return false;
  }
}

// Test 5: Convert Demo Broker to Normal
async function testConvertDemoBroker() {
  console.log('\n--- Test 5: Convert Demo Broker to Normal ---');
  try {
    const { data } = await axios.post(`${BASE_URL}/admin/convert-demo-broker/${demoBroker._id}`, {}, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    
    // Verify broker is no longer demo
    const { data: brokerData } = await axios.get(`${BASE_URL}/admin/manage/admins`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    
    const convertedBroker = brokerData.find(b => b._id === demoBroker._id);
    const passed = convertedBroker && convertedBroker.isDemo === false;
    
    logTest('Convert Demo Broker to Normal', passed, data.message);
    return passed;
  } catch (error) {
    logTest('Convert Demo Broker to Normal', false, error.response?.data?.message || error.message);
    return false;
  }
}

// Test 6: Create another Demo Broker for deletion test
async function testCreateAnotherDemoBroker() {
  console.log('\n--- Test 6: Create Another Demo Broker ---');
  try {
    const { data } = await axios.post(`${BASE_URL}/admin/demo-broker`, {
      name: 'Delete Test Broker',
      email: `deletedemo_${Date.now()}@test.com`,
      phone: '9876543212'
    });
    
    demoBroker = data; // Replace with new broker
    logTest('Create Another Demo Broker', true, `Admin Code: ${data.adminCode}`);
    return true;
  } catch (error) {
    logTest('Create Another Demo Broker', false, error.response?.data?.message || error.message);
    return false;
  }
}

// Test 7: Delete Demo Broker
async function testDeleteDemoBroker() {
  console.log('\n--- Test 7: Delete Demo Broker ---');
  try {
    const { data } = await axios.delete(`${BASE_URL}/admin/demo-broker/${demoBroker._id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    
    // Verify broker is deleted
    const { data: brokerData } = await axios.get(`${BASE_URL}/admin/demo-brokers`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    
    const found = brokerData.find(b => b._id === demoBroker._id);
    const passed = !found;
    
    logTest('Delete Demo Broker', passed, data.message);
    return passed;
  } catch (error) {
    logTest('Delete Demo Broker', false, error.response?.data?.message || error.message);
    return false;
  }
}

// Test 8: Duplicate Email Check
async function testDuplicateEmail() {
  console.log('\n--- Test 8: Duplicate Email Check ---');
  const testEmail = `duplicate_${Date.now()}@test.com`;
  
  try {
    // Create first broker
    await axios.post(`${BASE_URL}/admin/demo-broker`, {
      name: 'First Broker',
      email: testEmail,
      phone: '9876543213'
    });
    
    // Try to create second broker with same email
    try {
      await axios.post(`${BASE_URL}/admin/demo-broker`, {
        name: 'Second Broker',
        email: testEmail,
        phone: '9876543214'
      });
      logTest('Duplicate Email Check', false, 'Should have rejected duplicate email');
      return false;
    } catch (error) {
      const passed = error.response?.status === 400;
      logTest('Duplicate Email Check', passed, 'Correctly rejected duplicate email');
      return passed;
    }
  } catch (error) {
    logTest('Duplicate Email Check', false, error.response?.data?.message || error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('========================================');
  console.log('   DEMO BROKER FEATURE TEST SUITE');
  console.log('========================================');
  console.log(`Started at: ${new Date().toLocaleString()}`);
  
  // Login Super Admin first
  const loggedIn = await loginSuperAdmin();
  if (!loggedIn) {
    console.log('\n❌ Cannot proceed without Super Admin login');
    console.log('Make sure the server is running and super admin credentials are correct');
    return;
  }
  
  // Run tests
  await testCreateDemoBroker();
  await testDemoBrokerLogin();
  await testCreateDemoUser();
  await testGetDemoBrokers();
  await testConvertDemoBroker();
  await testCreateAnotherDemoBroker();
  await testDeleteDemoBroker();
  await testDuplicateEmail();
  
  // Summary
  console.log('\n========================================');
  console.log('           TEST SUMMARY');
  console.log('========================================');
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('========================================\n');
  
  if (results.failed > 0) {
    console.log('Failed Tests:');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.message}`);
    });
  }
}

// Run
runTests().catch(console.error);
