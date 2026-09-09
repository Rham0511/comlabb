import { User } from './models/userModel.js';

const users = await User.findAll({ 
  attributes: ['id', 'email', 'campus', 'role', 'name'],
  limit: 20 
});

console.log('Sample Users and their Campuses:');
console.log('─'.repeat(80));
users.forEach(u => {
  const campus = u.campus || 'NULL';
  console.log(`ID: ${u.id.toString().padEnd(3)} | Campus: ${campus.padEnd(12)} | Role: ${(u.role || 'NULL').padEnd(11)} | Email: ${u.email}`);
});

// Check for users without campus
const usersWithoutCampus = await User.findAll({
  where: { campus: null },
  attributes: ['id', 'email', 'role', 'name']
});

console.log();
console.log(`Users without campus field: ${usersWithoutCampus.length}`);
if (usersWithoutCampus.length > 0) {
  usersWithoutCampus.slice(0, 5).forEach(u => {
    console.log(`  - ID: ${u.id} | Email: ${u.email} | Role: ${u.role}`);
  });
}
