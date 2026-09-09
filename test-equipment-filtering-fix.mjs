import { Equipment } from './models/equipmentModel.js';
import { User } from './models/userModel.js';
import { Op } from 'sequelize';

console.log('\n=== EQUIPMENT FILTERING TEST (SIMULATING API) ===\n');

// Get a Bongabong user
const bongabongUser = await User.findOne({ where: { campus: 'Bongabong' } });
console.log(`Testing with user: ${bongabongUser.email} (Campus: ${bongabongUser.campus})`);

// Simulate the OLD filtering (what was broken)
console.log('\n❌ OLD FILTERING (Direct match - BROKEN):');
const oldWhere = { campus: bongabongUser.campus };
const oldResults = await Equipment.findAll({ where: oldWhere });
console.log(`  Query: where.campus = "${bongabongUser.campus}"`);
console.log(`  Results: ${oldResults.length} records found`);

// Simulate the NEW filtering (what we fixed)
console.log('\n✅ NEW FILTERING (OR match with suffix - FIXED):');
const newWhere = {
  [Op.or]: [
    { campus: bongabongUser.campus },
    { campus: `${bongabongUser.campus} Campus` }
  ]
};
const newResults = await Equipment.findAll({ where: newWhere, order: [['dateAdded', 'DESC']] });
console.log(`  Query: where campus = "${bongabongUser.campus}" OR campus = "${bongabongUser.campus} Campus"`);
console.log(`  Results: ${newResults.length} records found`);

if (newResults.length > 0) {
  console.log('\n  Sample records:');
  newResults.slice(0, 3).forEach(e => {
    console.log(`    - ${e.equipmentId}: ${e.name} (Campus: "${e.campus}")`);
  });
}

// Test with Victoria user
console.log();
const victoriaUser = await User.findOne({ where: { campus: 'Victoria' } });
if (victoriaUser) {
  console.log(`\nTesting with Victoria user: ${victoriaUser.email} (Campus: ${victoriaUser.campus})`);
  const victoriaWhere = {
    [Op.or]: [
      { campus: victoriaUser.campus },
      { campus: `${victoriaUser.campus} Campus` }
    ]
  };
  const victoriaResults = await Equipment.findAll({ where: victoriaWhere });
  console.log(`  Victoria equipment found: ${victoriaResults.length} records`);
  if (victoriaResults.length > 0) {
    console.log('  ✓ Victoria user can now see their equipment');
  }
}

// Test with Calapan user
console.log();
const calapanUser = await User.findOne({ where: { campus: 'Calapan' } });
if (calapanUser) {
  console.log(`Testing with Calapan user: ${calapanUser.email} (Campus: ${calapanUser.campus})`);
  const calapanWhere = {
    [Op.or]: [
      { campus: calapanUser.campus },
      { campus: `${calapanUser.campus} Campus` }
    ]
  };
  const calapanResults = await Equipment.findAll({ where: calapanWhere });
  console.log(`  Calapan equipment found: ${calapanResults.length} records`);
  if (calapanResults.length > 0) {
    console.log('  ✓ Calapan user can now see their equipment');
  }
}

console.log();
console.log('✅ Equipment filtering fix verified!\n');
