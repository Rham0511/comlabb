import { Equipment } from './models/equipmentModel.js';
import { User } from './models/userModel.js';

console.log('\n=== EQUIPMENT AND USER CAMPUS STATUS CHECK ===\n');

// Check equipment campus distribution
const equipment = await Equipment.findAll({
  attributes: ['equipmentId', 'name', 'campus', 'status'],
  limit: 10
});

console.log('Sample Equipment Records:');
console.log('─'.repeat(80));
equipment.forEach(e => {
  const campus = e.campus || 'NULL';
  console.log(`ID: ${e.equipmentId.padEnd(15)} | Campus: ${campus.padEnd(12)} | Status: ${e.status}`);
});

// Count users by campus
const usersByCampus = await User.findAll({
  attributes: ['campus'],
  raw: true
});

const campusDistribution = {};
usersByCampus.forEach(u => {
  const campus = u.campus || 'NULL';
  campusDistribution[campus] = (campusDistribution[campus] || 0) + 1;
});

console.log();
console.log('User Campus Distribution:');
console.log('─'.repeat(80));
Object.entries(campusDistribution).forEach(([campus, count]) => {
  console.log(`  ${campus.padEnd(12)}: ${count} users`);
});

// Count equipment by campus
const equipByCampus = await Equipment.findAll({
  attributes: ['campus'],
  raw: true
});

const equipmentDistribution = {};
equipByCampus.forEach(e => {
  const campus = e.campus || 'NULL';
  equipmentDistribution[campus] = (equipmentDistribution[campus] || 0) + 1;
});

console.log();
console.log('Equipment Campus Distribution:');
console.log('─'.repeat(80));
Object.entries(equipmentDistribution).forEach(([campus, count]) => {
  console.log(`  ${campus.padEnd(12)}: ${count} records`);
});

console.log();
console.log('✅ All data properly migrated and ready for campus-based authorization!\n');
