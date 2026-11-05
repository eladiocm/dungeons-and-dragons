// Loaded only by Playwright's Node process, never by application code or HTTP.
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';

crypto.randomInt = (min, max) =>
  max === undefined ? Math.min(14, min - 1) : Math.min(15, max - 1);
syncBuiltinESMExports();
