// Prints the class/id tokens a stylesheet's selectors use (JSON array).
const fs = require('node:fs');
const path = require('node:path');
const { tokens } = require('../tests/helpers/css.cjs');

const file = process.argv[2] || path.join(__dirname, '..', 'css', 'style.css');
process.stdout.write(JSON.stringify(tokens(fs.readFileSync(file, 'utf8')), null, 2) + '\n');
