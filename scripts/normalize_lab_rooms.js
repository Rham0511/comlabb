#!/usr/bin/env node
// Script to normalize existing laboratoryRoom values to canonical display strings.
import { LaboratorySchedule } from '../models/laboratoryScheduleModel.js';
import { sequelize } from '../models/db.js';

const CANONICAL_MAP = {
  'room 202': 'Laboratory 1 — Room 202',
  'room202': 'Laboratory 1 — Room 202',
  'rm 202': 'Laboratory 1 — Room 202',
  'rm202': 'Laboratory 1 — Room 202',
  'laboratory 1': 'Laboratory 1 — Room 202',
  'lab 1': 'Laboratory 1 — Room 202',
  'lab1': 'Laboratory 1 — Room 202',
  'laboratory1': 'Laboratory 1 — Room 202',
  'room 204': 'Laboratory 2 — Room 204',
  'room204': 'Laboratory 2 — Room 204',
  'rm 204': 'Laboratory 2 — Room 204',
  'rm204': 'Laboratory 2 — Room 204',
  'laboratory 2': 'Laboratory 2 — Room 204',
  'lab 2': 'Laboratory 2 — Room 204',
  'lab2': 'Laboratory 2 — Room 204',
  'laboratory2': 'Laboratory 2 — Room 204'
};

const normalize = (text) => {
  if (!text) return null;
  const key = String(text).trim().toLowerCase();
  if (CANONICAL_MAP[key]) return CANONICAL_MAP[key];
  // If already canonical, return it
  if (Object.values(CANONICAL_MAP).includes(text)) return text;
  return null;
};

const main = async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    const schedules = await LaboratorySchedule.findAll();
    console.log(`Found ${schedules.length} schedules`);
    for (const s of schedules) {
      const normalized = normalize(s.laboratoryRoom);
      if (normalized && normalized !== s.laboratoryRoom) {
        console.log(`Normalizing [${s.id}] ${s.laboratoryRoom} -> ${normalized}`);
        s.laboratoryRoom = normalized;
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
