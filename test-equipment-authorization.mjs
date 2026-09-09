import { Equipment } from './models/equipmentModel.js';
import { User } from './models/userModel.js';
import { canManageRecord } from './controllers/campusAuthController.js';
import { Op } from 'sequelize';

console.log('\n=== COMPREHENSIVE CAMPUS AUTHORIZATION TEST ===\n');

// Get test data
const bongabongAdmin = await User.findOne({ where: { email: 'test-admin-bongabong-17867286614043d4@lab.test' } });
const victoriaAdmin = await User.findOne({ where: { email: 'test-admin-victoria-1786728661674a57@lab.test' } });
const calapanAdmin = await User.findOne({ where: { email: 'test-admin-calapan-178672866178181c@lab.test' } });

// Get sample equipment from each campus
const bongabongEquip = await Equipment.findOne({ where: { campus: { [Op.like]: 'Bongabong%' } } });
const victoriaEquip = await Equipment.findOne({ where: { campus: { [Op.like]: 'Victoria%' } } });
const calapanEquip = await Equipment.findOne({ where: { campus: { [Op.like]: 'Calapan%' } } });

console.log('TEST USERS:');
console.log(`  Bongabong Admin: ID ${bongabongAdmin?.id} | Campus: ${bongabongAdmin?.campus}`);
console.log(`  Victoria Admin:  ID ${victoriaAdmin?.id} | Campus: ${victoriaAdmin?.campus}`);
console.log(`  Calapan Admin:   ID ${calapanAdmin?.id} | Campus: ${calapanAdmin?.campus}`);

console.log();
console.log('SAMPLE EQUIPMENT:');
console.log(`  Bongabong: ${bongabongEquip?.equipmentId} | Campus: ${bongabongEquip?.campus}`);
console.log(`  Victoria:  ${victoriaEquip?.equipmentId} | Campus: ${victoriaEquip?.campus}`);
console.log(`  Calapan:   ${calapanEquip?.equipmentId} | Campus: ${calapanEquip?.campus}`);

console.log();
console.log('=== AUTHORIZATION TEST SCENARIOS ===\n');

const tests = [
  {
    name: 'Bongabong Admin → Delete Bongabong equipment',
    user: bongabongAdmin,
    equipment: bongabongEquip,
    expect: true,
    action: 'DELETE'
  },
  {
    name: 'Bongabong Admin → Edit Bongabong equipment',
    user: bongabongAdmin,
    equipment: bongabongEquip,
    expect: true,
    action: 'EDIT'
  },
  {
    name: 'Bongabong Admin → Delete Victoria equipment',
    user: bongabongAdmin,
    equipment: victoriaEquip,
    expect: false,
    action: 'DELETE'
  },
  {
    name: 'Bongabong Admin → Edit Victoria equipment',
    user: bongabongAdmin,
    equipment: victoriaEquip,
    expect: false,
    action: 'EDIT'
  },
  {
    name: 'Bongabong Admin → Delete Calapan equipment',
    user: bongabongAdmin,
    equipment: calapanEquip,
    expect: false,
    action: 'DELETE'
  },
  {
    name: 'Victoria Admin → Delete Victoria equipment',
    user: victoriaAdmin,
    equipment: victoriaEquip,
    expect: true,
    action: 'DELETE'
  },
  {
    name: 'Victoria Admin → Edit Bongabong equipment',
    user: victoriaAdmin,
    equipment: bongabongEquip,
    expect: false,
    action: 'EDIT'
  },
  {
    name: 'Calapan Admin → Delete Calapan equipment',
    user: calapanAdmin,
    equipment: calapanEquip,
    expect: true,
    action: 'DELETE'
  },
  {
    name: 'Calapan Admin → Delete Victoria equipment',
    user: calapanAdmin,
    equipment: victoriaEquip,
    expect: false,
    action: 'DELETE'
  }
];

let passCount = 0;
let failCount = 0;

tests.forEach(test => {
  if (!test.user || !test.equipment) {
    console.log(`⚠️  SKIP | ${test.name} (Missing test data)`);
    return;
  }
  
  const result = canManageRecord(test.user.campus, test.equipment.campus);
  const authorized = result === test.expect;
  const status = authorized ? '✓ PASS' : '✗ FAIL';
  
  if (authorized) {
    passCount++;
  } else {
    failCount++;
  }
  
  const expectedAction = test.expect ? 'ALLOW' : 'DENY';
  const resultAction = result ? 'ALLOW' : 'DENY';
  console.log(`${status} | ${test.name}`);
  console.log(`       Expected: ${expectedAction} | Got: ${resultAction}`);
});

console.log();
console.log('=== TEST RESULTS ===');
console.log(`Passed: ${passCount}/${tests.length}`);
console.log(`Failed: ${failCount}/${tests.length}`);
console.log();

if (failCount === 0) {
  console.log('✅ All authorization tests passed!');
  console.log('Campus-based access control is working correctly.');
} else {
  console.log(`❌ ${failCount} test(s) failed!`);
}
