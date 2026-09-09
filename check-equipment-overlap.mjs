import { Equipment } from './models/equipmentModel.js';
import { Op } from 'sequelize';

console.log('\n=== INVESTIGATING EQUIPMENT OVERLAP ===\n');

// Get all Bongabong equipment
const bongabongEquip = await Equipment.findAll({
  where: {
    [Op.or]: [
      { campus: 'Bongabong' },
      { campus: 'Bongabong Campus' }
    ]
  },
  attributes: ['equipmentId', 'name', 'campus']
});

// Get all Victoria equipment
const victoriaEquip = await Equipment.findAll({
  where: {
    [Op.or]: [
      { campus: 'Victoria' },
      { campus: 'Victoria Campus' }
    ]
  },
  attributes: ['equipmentId', 'name', 'campus']
});

console.log(`Bongabong equipment: ${bongabongEquip.length}`);
console.log(`Victoria equipment: ${victoriaEquip.length}`);

// Find overlaps
const bongabongIds = new Set(bongabongEquip.map(e => e.equipmentId));
const victoriaIds = new Set(victoriaEquip.map(e => e.equipmentId));

const overlaps = Array.from(bongabongIds).filter(id => victoriaIds.has(id));

console.log();
console.log(`Overlapping equipment IDs: ${overlaps.length}`);

if (overlaps.length > 0) {
  console.log('\nOverlapping equipment:');
  for (const id of overlaps) {
    const bEquip = bongabongEquip.find(e => e.equipmentId === id);
    const vEquip = victoriaEquip.find(e => e.equipmentId === id);
    console.log(`  ${id}:`);
    console.log(`    Bongabong: "${bEquip?.campus}"`);
    console.log(`    Victoria: "${vEquip?.campus}"`);
  }
}

// Check for any equipment with NULL or unusual campus values
const abnormalEquip = await Equipment.findAll({
  where: {
    [Op.or]: [
      { campus: null },
      { 
        campus: {
          [Op.and]: [
            { [Op.not]: 'Bongabong Campus' },
            { [Op.not]: 'Victoria Campus' },
            { [Op.not]: 'Calapan Campus' },
            { [Op.not]: null }
          ]
        }
      }
    ]
  },
  attributes: ['equipmentId', 'campus']
});

console.log();
console.log(`Equipment with unusual campus values: ${abnormalEquip.length}`);
if (abnormalEquip.length > 0) {
  abnormalEquip.slice(0, 5).forEach(e => {
    console.log(`  ${e.equipmentId}: "${e.campus}"`);
  });
}
