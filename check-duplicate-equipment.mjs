import { Equipment } from './models/equipmentModel.js';
import { sequelize } from './models/db.js';
import { Op } from 'sequelize';

console.log('\n=== CHECKING FOR DUPLICATE EQUIPMENT IDs ===\n');

// Find all equipment with equipmentId = SPK-001 or SPK-002
const spk001 = await Equipment.findAll({
  where: { equipmentId: 'SPK-001' },
  attributes: ['id', 'equipmentId', 'name', 'campus']
});

const spk002 = await Equipment.findAll({
  where: { equipmentId: 'SPK-002' },
  attributes: ['id', 'equipmentId', 'name', 'campus']
});

console.log('Records with equipmentId = SPK-001:');
spk001.forEach(e => {
  console.log(`  ID: ${e.id} | equipmentId: ${e.equipmentId} | name: ${e.name} | campus: ${e.campus}`);
});

console.log();
console.log('Records with equipmentId = SPK-002:');
spk002.forEach(e => {
  console.log(`  ID: ${e.id} | equipmentId: ${e.equipmentId} | name: ${e.name} | campus: ${e.campus}`);
});

// Check if there are any duplicate equipmentIds
const duplicates = await Equipment.findAll({
  attributes: ['equipmentId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
  group: ['equipmentId'],
  having: sequelize.where(sequelize.fn('COUNT', sequelize.col('id')), Op.gt, 1),
  raw: true
});

console.log();
console.log(`Equipment IDs with multiple records: ${duplicates.length}`);
if (duplicates.length > 0) {
  duplicates.forEach(d => {
    console.log(`  ${d.equipmentId}: ${d.count} records`);
  });
}
