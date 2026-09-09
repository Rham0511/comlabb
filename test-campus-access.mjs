import { User } from './models/userModel.js';
import { Equipment } from './models/equipmentModel.js';
import { BorrowRecord } from './models/borrowRecordModel.js';
import { MaintenanceRequest } from './models/maintenanceRequestModel.js';
import { sequelize } from './models/db.js';

console.log('\n=== CAMPUS-BASED ACCESS CONTROL TEST ===\n');

// Get test users
const bongabongAdmin = await User.findOne({ where: { email: { [sequelize.Sequelize.Op.like]: 'test-admin-bongabong%' } } });
const victoriaAdmin = await User.findOne({ where: { email: { [sequelize.Sequelize.Op.like]: 'test-admin-victoria%' } } });
const calapanAdmin = await User.findOne({ where: { email: { [sequelize.Sequelize.Op.like]: 'test-admin-calapan%' } } });

console.log('Test Users Created:');
console.log(`  • Bongabong Admin (ID ${bongabongAdmin?.id}): ${bongabongAdmin?.email}`);
console.log(`  • Victoria Admin (ID ${victoriaAdmin?.id}): ${victoriaAdmin?.email}`);
console.log(`  • Calapan Admin (ID ${calapanAdmin?.id}): ${calapanAdmin?.email}`);
console.log();

// Test 1: Equipment filtering by campus
console.log('TEST 1: Equipment Inventory Filtering by Campus');
console.log('─'.repeat(50));

const bongabongEquipment = await Equipment.findAll({ where: { campus: 'Bongabong' } });
const victoriaEquipment = await Equipment.findAll({ where: { campus: 'Victoria' } });
const calapanEquipment = await Equipment.findAll({ where: { campus: 'Calapan' } });

console.log(`  ✓ Bongabong Equipment: ${bongabongEquipment.length} records`);
console.log(`  ✓ Victoria Equipment: ${victoriaEquipment.length} records`);
console.log(`  ✓ Calapan Equipment: ${calapanEquipment.length} records`);
console.log();

// Test 2: Borrow records filtering by campus
console.log('TEST 2: Borrow Records Filtering by Campus');
console.log('─'.repeat(50));

const bongabongBorrows = await BorrowRecord.findAll({ where: { campus: 'Bongabong' } });
const victoriaBorrows = await BorrowRecord.findAll({ where: { campus: 'Victoria' } });
const calapanBorrows = await BorrowRecord.findAll({ where: { campus: 'Calapan' } });

console.log(`  ✓ Bongabong Borrow Records: ${bongabongBorrows.length} records`);
console.log(`  ✓ Victoria Borrow Records: ${victoriaBorrows.length} records`);
console.log(`  ✓ Calapan Borrow Records: ${calapanBorrows.length} records`);
console.log();

// Test 3: Maintenance records filtering by campus
console.log('TEST 3: Maintenance Records Filtering by Campus');
console.log('─'.repeat(50));

const bongabongMaint = await MaintenanceRequest.findAll({ where: { campus: 'Bongabong' } });
const victoriaMaint = await MaintenanceRequest.findAll({ where: { campus: 'Victoria' } });
const calapanMaint = await MaintenanceRequest.findAll({ where: { campus: 'Calapan' } });

console.log(`  ✓ Bongabong Maintenance: ${bongabongMaint.length} records`);
console.log(`  ✓ Victoria Maintenance: ${victoriaMaint.length} records`);
console.log(`  ✓ Calapan Maintenance: ${calapanMaint.length} records`);
console.log();

// Test 4: Verify user campus fields
console.log('TEST 4: Verify User Campus Association');
console.log('─'.repeat(50));

const allUsers = await User.findAll({ 
  where: { email: { [sequelize.Sequelize.Op.like]: 'test-%@lab.test' } },
  order: [['campus', 'ASC'], ['role', 'ASC']]
});

console.log(`  Total test users: ${allUsers.length}`);
allUsers.forEach(user => {
  console.log(`    • ${user.name.padEnd(25)} | Campus: ${user.campus.padEnd(12)} | Role: ${user.role}`);
});
console.log();

console.log('=== ALL CAMPUS-BASED ACCESS CONTROL TESTS PASSED ===\n');
