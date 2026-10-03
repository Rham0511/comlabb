import bcryptjs from 'bcryptjs';
import { sequelize } from './models/db.js';
import { User } from './models/userModel.js';

async function testLogin() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const email = 'danicaserdena7@gmail.com';
    const password = 'admin123';

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    
    if (!user) {
      console.log('❌ User not found in database');
      process.exit(1);
    }

    console.log('✅ User found:');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Email Verified:', user.email_verified);
    console.log('   Password Hash:', user.password);
    console.log();

    // Test password comparison
    const match = await bcryptjs.compare(password, user.password);
    
    if (match) {
      console.log('✅ Password matches! Login should work.');
    } else {
      console.log('❌ Password does NOT match!');
      console.log('\n--- Generating new hash for "admin123" ---');
      const newHash = await bcryptjs.hash(password, 8);
      console.log('New hash:', newHash);
      console.log('\n--- Updating user password ---');
      await user.update({ password: newHash });
      console.log('✅ Password updated! Try logging in again.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testLogin();
