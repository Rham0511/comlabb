import bcryptjs from 'bcryptjs';
import { sequelize } from './models/db.js';
import { Sequelize } from 'sequelize';

const User = sequelize.define('users', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  },
  role: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: 'admin'
  },
  student_number: Sequelize.STRING,
  program: Sequelize.STRING,
  year: Sequelize.STRING,
  section: Sequelize.STRING,
  photo: Sequelize.STRING,
  last_login_at: Sequelize.DATE,
  email_verified: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  },
  verification_token: Sequelize.STRING,
  verification_expires_at: Sequelize.DATE,
  otp_code: Sequelize.STRING(6),
  otp_expires_at: Sequelize.DATE,
  otp_purpose: Sequelize.STRING,
  campus: Sequelize.STRING
}, {
  timestamps: true
});

async function createAdmin() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Hash the password
    const hashedPassword = await bcryptjs.hash('admin123', 8);
    
    // Create the admin user
    const admin = await User.create({
      name: 'Danica Serdena',
      email: 'danicaserdena7@gmail.com',
      password: hashedPassword,
      role: 'admin',
      email_verified: true,
      campus: 'Bongabong'
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password: admin123');
    console.log('👤 Role:', admin.role);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
