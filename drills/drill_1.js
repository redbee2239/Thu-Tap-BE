const fs = require('fs');
const path = require('path');
const readline = require('readline');

const filePath = process.argv[2] || path.join(__dirname, '..', 'package.json');

let lines = 0;
const rl = readline.createInterface({ input: fs.createReadStream(filePath) });

rl.on('line', () => lines++);
rl.on('close', () => {
  console.log(`Total lines: ${lines.toLocaleString()}`);
});
rl.on('error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
