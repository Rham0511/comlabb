import { Equipment } from './models/equipmentModel.js';
import { User } from './models/userModel.js';
import { sequelize } from './models/db.js';
import { Op } from 'sequelize';

console.log('\n=== EQUIPMENT AND USER CAMPUS MISMATCH DIAGNOSIS ===\n');

// Get unique campus values from both tables
const equipmentCampuses = await Equipment.findAll({
  attributes: [[sequelize.fn('DISTINCT', sequelize.col('campus')), 'campus']],
  raw: true
});

const userCampuses = await User.findAll({
  attributes: [[sequelize.fn('DISTINCT', sequelize.col('campus')), 'campus']],
  raw: true
});

console.log('Equipment Campus Values:');
equipmentCampuses.forEach(e => {
  console.log(`  - "${e.campus}"`);
});

console.log();
console.log('User Campus Values:');
userCampuses.forEach(u => {
  console.log(`  - "${u.campus}"`);
});

// Check if they match
console.log();
console.log('Campus Matching Analysis:');
console.log('─'.repeat(60));

equipmentCampuses.forEach(equip => {
  const equipCampus = equip.campus;
  const matchingUsers = userCampuses.filter(u => {
    const userCampus = u.campus;
    if (!equipCampus || !userCampus) return false;
    // Normalize like the authorization function does
    const normalize = (v) => String(v || "").trim().toLowerCase().replace(/\s*campus\s*$/i, "");
    return normalize(equipCampus) === normalize(userCampus);
  });
  
  console.log(`Equipment: "${equipCampus}"`);
  console.log(`  Matching users: ${matchingUsers.length}`);
  if (matchingUsers.length > 0) {
    matchingUsers.forEach(u => console.log(`    - "${u.campus}"`));
  }
});

// Count equipment by campus
console.log();
console.log('Equipment Count by Campus:');
const equipBycampus = {};
equipmentCampuses.forEach(e => {
  equipBycampus[e.campus || 'NULL'] = 0;
});

const allEquipment = await Equipment.findAll({ attributes: ['campus'] });
allEquipment.forEach(e => {
  equipBycampus[e.campus || 'NULL']++;
});

Object.entries(equipBycampus).forEach(([campus, count]) => {
  console.log(`  ${campus.padEnd(20)}: ${count} records`);
});
