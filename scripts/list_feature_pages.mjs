import fs from 'fs';
const text = fs.readFileSync('./routes/index.js', 'utf8');
const lines = text.split('\n');
lines.forEach((line, index) => {
  const match = line.match(/"([a-zA-Z0-9_-]+)":\s*\{/);
  if (match && index > 90 && index < 6200) {
    console.log(index + 1, match[1]);
  }
});
