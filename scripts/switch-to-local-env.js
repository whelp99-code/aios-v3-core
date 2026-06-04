#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dir = path.resolve('data/learned');
const localBias = { preferredProvider: 'local', planner: 'local', executor: 'local', critic: 'local' };
for (const file of fs.readdirSync(dir)) {
  if (!file.startsWith('policy') || !file.endsWith('.json')) continue;
  const fp = path.join(dir, file);
  const p = JSON.parse(fs.readFileSync(fp, 'utf8'));
  p.routingBias = { ...p.routingBias, ...localBias };
  fs.writeFileSync(fp, JSON.stringify(p, null, 2));
  console.log('patched', file);
}
