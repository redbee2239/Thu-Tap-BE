const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const FILE = process.argv[2] || path.join(__dirname, '..', 'large-file.txt');

function sync() {
  const start = performance.now();
  const data = fs.readFileSync(FILE);
  const lines = data.toString().split('\n').length;
  const elapsed = performance.now() - start;
  console.log(`readFileSync: ${elapsed.toFixed(2)}ms | ${(data.length / 1024 / 1024).toFixed(2)} MB | ${lines.toLocaleString()} lines`);
  return elapsed;
}

function async() {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    fs.readFile(FILE, (err, data) => {
      if (err) return reject(err);
      const lines = data.toString().split('\n').length;
      const elapsed = performance.now() - start;
      console.log(`readFile    : ${elapsed.toFixed(2)}ms | ${(data.length / 1024 / 1024).toFixed(2)} MB | ${lines.toLocaleString()} lines`);
      resolve(elapsed);
    });
  });
}

function streamBased() {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const readline = require('readline');
    const rl = readline.createInterface({ input: fs.createReadStream(FILE) });
    let lines = 0;
    rl.on('line', () => lines++);
    rl.on('close', () => {
      const elapsed = performance.now() - start;
      console.log(`stream      : ${elapsed.toFixed(2)}ms | lines: ${lines.toLocaleString()}`);
      resolve(elapsed);
    });
    rl.on('error', reject);
  });
}

(async () => {
  if (!fs.existsSync(FILE)) {
    console.log(`File "${FILE}" not found. Generate one with: npm run generate:large-file`);
    process.exit(1);
  }

  console.log(`Comparing read methods for: ${FILE}\n`);

  // Warm up / ensure cache fairness
  const warm = fs.readFileSync(FILE);
  console.log(`File size: ${(warm.length / 1024 / 1024).toFixed(2)} MB\n`);

  const [tSync, tAsync, tStream] = await Promise.all([sync(), async(), streamBased()]);

  console.log(`\nSummary:`);
  console.log(`  readFileSync : ${tSync.toFixed(2)}ms`);
  console.log(`  readFile     : ${tAsync.toFixed(2)}ms`);
  console.log(`  stream       : ${tStream.toFixed(2)}ms`);
  console.log(`  stream vs sync: ${(tSync / tStream).toFixed(2)}x`);
})();
