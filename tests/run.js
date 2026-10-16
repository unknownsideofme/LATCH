#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testsDir = path.resolve(__dirname);
const filter = process.argv[2] || '';

function findTestFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = findTestFiles(testsDir).sort();
const matchingFiles = filter
  ? allFiles.filter(f => f.includes(filter))
  : allFiles;

if (matchingFiles.length === 0) {
  console.error(`No test files found matching filter: "${filter}"`);
  process.exit(1);
}

const relativeFiles = matchingFiles.map(f => path.relative(process.cwd(), f));

const result = spawnSync(process.execPath, ['--test', ...relativeFiles], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
