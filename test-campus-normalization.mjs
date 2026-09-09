import { canManageRecord } from './controllers/campusAuthController.js';

console.log('\n=== CAMPUS NORMALIZATION TEST ===\n');

const testCases = [
  // Exact matches
  { user: 'Bongabong', record: 'Bongabong', expect: true, desc: 'Exact match' },
  { user: 'Victoria', record: 'Victoria', expect: true, desc: 'Exact match' },
  { user: 'Calapan', record: 'Calapan', expect: true, desc: 'Exact match' },
  
  // With "Campus" suffix
  { user: 'Bongabong', record: 'Bongabong Campus', expect: true, desc: 'User without suffix, record with suffix' },
  { user: 'Bongabong Campus', record: 'Bongabong', expect: true, desc: 'User with suffix, record without suffix' },
  { user: 'Victoria Campus', record: 'Victoria Campus', expect: true, desc: 'Both with suffix' },
  
  // Case variations
  { user: 'bongabong', record: 'BONGABONG', expect: true, desc: 'Case insensitive' },
  { user: 'VICTORIA', record: 'victoria campus', expect: true, desc: 'Case insensitive with suffix' },
  
  // Whitespace variations
  { user: '  Bongabong  ', record: 'Bongabong Campus ', expect: true, desc: 'Extra whitespace' },
  
  // Cross-campus (should fail)
  { user: 'Bongabong', record: 'Victoria', expect: false, desc: 'Different campus' },
  { user: 'Victoria Campus', record: 'Calapan', expect: false, desc: 'Different campus with suffix' },
  
  // Null/empty (should fail)
  { user: null, record: 'Bongabong', expect: false, desc: 'Null user campus' },
  { user: 'Bongabong', record: null, expect: false, desc: 'Null record campus' },
  { user: '', record: 'Bongabong', expect: false, desc: 'Empty user campus' },
];

let passed = 0;
let failed = 0;

testCases.forEach(test => {
  const result = canManageRecord(test.user, test.record);
  const status = result === test.expect ? '✓ PASS' : '✗ FAIL';
  
  if (result === test.expect) {
    passed++;
  } else {
    failed++;
  }
  
  const userDisplay = test.user ? `"${test.user}"`.padEnd(25) : 'null'.padEnd(25);
  const recordDisplay = test.record ? `"${test.record}"`.padEnd(25) : 'null'.padEnd(25);
  console.log(`${status} | ${userDisplay} | ${recordDisplay} | ${test.desc}`);
});

console.log();
console.log('=== RESULTS ===');
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);
console.log();

if (failed === 0) {
  console.log('✅ All campus normalization tests passed!');
} else {
  console.log(`❌ ${failed} test(s) failed!`);
}
