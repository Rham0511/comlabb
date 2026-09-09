import { User } from './models/userModel.js';
import { Op } from 'sequelize';

const testUsers = await User.findAll({ 
  where: { email: { [Op.like]: 'test-%@lab.test' } },
  attributes: ['id', 'name', 'email', 'campus', 'role']
});

console.log('Test Users Campus Info:');
console.log('─'.repeat(80));
testUsers.forEach(u => {
  const campusVal = u.campus || 'NULL';
  console.log(`ID: ${u.id.toString().padEnd(3)} | Campus: ${campusVal.padEnd(12)} | Role: ${u.role.padEnd(11)} | Email: ${u.email}`);
});

console.log();
console.log('Campus Distribution:');
const campusCounts = {};
testUsers.forEach(u => {
  const campus = u.campus || 'NULL';
  campusCounts[campus] = (campusCounts[campus] || 0) + 1;
});
Object.entries(campusCounts).forEach(([campus, count]) => {
  console.log(`  ${campus.padEnd(12)}: ${count} users`);
});
