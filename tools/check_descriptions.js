#!/usr/bin/env node
const games = require('../games.json');
const missing = games.filter(x => !x.description || !x.description.trim());
console.log(`Total: ${games.length}, Missing description: ${missing.length}\n`);
missing.forEach(x => console.log(` - ${x.title || '(no title)'} | ${x.link}`));
