const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'student-report-issue.html');
const content = fs.readFileSync(filePath, 'utf8');

console.log('File size:', content.length);
console.log('Has pcSetPickerWrapper:', content.includes('pcSetPickerWrapper'));
console.log('Has issue-type-btn:', content.includes('issue-type-btn'));
console.log('Has "Report an Issue":', content.includes('Report an Issue'));
console.log('Has "Submit a damage":', content.includes('Submit a damage'));
console.log('Has "Find Equipment":', content.includes('Find Equipment'));
