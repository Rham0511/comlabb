const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'index.js'), 'utf8');

// extract renderFeaturePage header/footer
const renderMatch = src.match(/const renderFeaturePage = \(config,[\s\S]*?=>\s*`([\s\S]*?)\$\{config.content\}([\s\S]*?)`;/m);
if (!renderMatch) {
  console.error('Could not find renderFeaturePage');
  process.exit(2);
}
const header = renderMatch[1];
const footer = renderMatch[2];

// extract laboratory-schedules content
const labMatch = src.match(/"laboratory-schedules"\s*:\s*\{[\s\S]*?content\s*:\s*`([\s\S]*?)`\s*\}/m);
if (!labMatch) {
  console.error('Could not find laboratory-schedules content');
  process.exit(2);
}
const content = labMatch[1];

const full = header + content + footer;
const lines = full.split(/\n/);
const targetLine = 334; // browser reported line
const start = Math.max(1, targetLine - 6);
const end = Math.min(lines.length, targetLine + 6);
console.log('--- Showing lines', start, 'to', end, 'of generated HTML ---');
for (let i = start; i <= end; i++) {
  const num = String(i).padStart(4, ' ');
  console.log(`${num}: ${lines[i-1]}`);
}

// Also print the exact line 334
console.log('\n--- Line', targetLine, '---');
console.log(lines[targetLine-1]);

// Save to temp file for manual inspection if needed
fs.writeFileSync(path.join(__dirname, '..', 'tmp_laboratory_schedules_render.html'), full, 'utf8');
console.log('Wrote tmp_laboratory_schedules_render.html');
