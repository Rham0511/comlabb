import bcryptjs from 'bcryptjs';

const password = 'admin123';
const hash = await bcryptjs.hash(password, 8);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nSQL Update Command:');
console.log(`UPDATE users SET password='${hash}' WHERE email='danicaserdena7@gmail.com';`);

process.exit(0);
