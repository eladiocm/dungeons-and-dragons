// Test-only preload. The production application never imports this module.
import crypto from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';

const original = crypto.randomInt;
const file = resolve('.data/e2e/rng.json');
crypto.randomInt = (min, max) => {
  if (min !== 1 || ![5, 7, 9, 11, 13, 21].includes(max))
    return original(min, max);
  try {
    const queue = JSON.parse(readFileSync(file, 'utf8'));
    if (queue.length) {
      const value = queue.shift();
      writeFileSync(file, JSON.stringify(queue));
      if (Number.isInteger(value) && value >= min && value < max) return value;
      throw new Error('Invalid fixture die');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return Math.min(15, max - 1);
};
syncBuiltinESMExports();
