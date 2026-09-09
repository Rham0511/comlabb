import { User } from './models/userModel.js';

console.log('\n=== DATA MIGRATION: Assign Campus to Existing Users ===\n');

// Find users without campus
const usersWithoutCampus = await User.findAll({
  where: { campus: null },
  attributes: ['id', 'email', 'role', 'name']
});

console.log(`Found ${usersWithoutCampus.length} users without campus assigned.\n`);

if (usersWithoutCampus.length === 0) {
  console.log('No users need migration. All users have campus assigned.');
  process.exit(0);
}

// Assign default campus (Bongabong) to all users without campus
const defaultCampus = 'Bongabong';
console.log(`Assigning default campus '${defaultCampus}' to ${usersWithoutCampus.length} users...\n`);

let successCount = 0;
let errorCount = 0;

for (const user of usersWithoutCampus) {
  try {
    await user.update({ campus: defaultCampus });
    console.log(`✓ ID: ${user.id.toString().padEnd(3)} | ${user.email.padEnd(40)} → ${defaultCampus}`);
    successCount++;
  } catch (error) {
    console.error(`✗ ID: ${user.id} | ${user.email} | Error: ${error.message}`);
    errorCount++;
  }
}

console.log();
console.log('=== MIGRATION COMPLETE ===');
console.log(`Successfully updated: ${successCount} users`);
console.log(`Failed updates: ${errorCount} users`);
console.log();

if (errorCount === 0) {
  console.log('✅ All users now have a campus assigned!');
} else {
  console.log(`⚠️  Migration completed with ${errorCount} errors.`);
}
