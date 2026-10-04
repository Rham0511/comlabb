import bcrypt from 'bcrypt';
import { User } from './models/userModel.js';

const campuses = ['Bongabong', 'Victoria', 'Calapan'];
const roles = ['admin', 'technician', 'student'];

console.log('Creating test users for campus-based access control...\n');

for (const campus of campuses) {
  for (const role of roles) {
    const email = `test-${role}-${campus.toLowerCase()}-${Date.now()}${Math.random().toString(16).slice(2, 5)}@lab.test`;
    const user = await User.create({
      name: `${role.toUpperCase()} - ${campus}`,
      email,
      password: await bcrypt.hash('Test@12345', 8),
      role,
      campus,
      email_verified: true
    });
    console.log(`✓ Created ${role.padEnd(11)} for ${campus.padEnd(12)} | ID: ${user.id} | Email: ${email}`);
  }
  console.log();
}

console.log('Test users created successfully!');
