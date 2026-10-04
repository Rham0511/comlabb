#!/usr/bin/env node
// Script to normalize campus values to canonical names
import { LaboratorySchedule } from '../models/laboratoryScheduleModel.js';
import { sequelize } from '../models/db.js';

const CANONICAL = ['Bongabong','Calapan','Victoria'];

const normalize = (v) => {
  if (!v && v !== '') return null;
  const t = String(v || '').trim();
  const found = CANONICAL.find(c => c.toLowerCase() === t.toLowerCase());
  return found || null;
};

const main = async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    const schedules = await LaboratorySchedule.findAll();
    console.log(`Found ${schedules.length} schedules`);
    for (const s of schedules) {
      const n = normalize(s.campus);
      if (n && n !== s.campus) {
        console.log(`Normalizing campus [${s.id}] ${s.campus} -> ${n}`);
        s.campus = n;
        await s.save();
      }
    }
    console.log('Normalization complete');
    process.exit(0);
  } catch (err) {
    console.error('Normalization failed', err);
    process.exit(1);
  }
};

main();
