const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { create } = require('../js/hosting.js');

const publicPaths = [
  'index.html', '404.html', 'en', 'apoyar', 'contacto', 'guia', 'legendarios',
  'logros', 'movimientos', 'novedades', 'objetos', 'pokedex', 'privacidad',
  'shinies', 'tipos', 'assets', 'css', 'js', 'favicon.ico', 'manifest.webmanifest',
  'sw.js', 'version.json', 'LICENSE', 'LICENSE-NONCOMMERCIAL.md', 'CREDITS.md'
];

function validateConfig(source) {
  const context = { window: {} };
  vm.runInNewContext(source, context, { timeout: 1000 });
  const config = context.window.PS_FIREBASE_CONFIG;
  const hosting = create(config, { hostname: config && config.projectId + '.web.app', protocol: 'https:' });
  if (hosting.error) throw new Error(hosting.error);
  if (config.emulator) throw new Error('Do not publish an emulator configuration.');
  return config;
}

function stage(root = path.join(__dirname, '..')) {
  root = fs.realpathSync(root);
  const config = validateConfig(fs.readFileSync(path.join(root, 'js', 'hosting-config.js'), 'utf8'));
  const output = path.join(root, 'dist');
  // Only this generated, fixed child directory can be removed.
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('dist must not be a symbolic link.');
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output);
  for (const entry of publicPaths) {
    const source = path.join(root, entry);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(output, entry), {
      recursive: true, dereference: false,
      filter(file) {
        if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Public files must not be symbolic links: ' + file);
        return true;
      }
    });
  }
  console.log('Staged Firebase website for project ' + config.projectId + ' in dist.');
  return output;
}

module.exports = { stage, validateConfig };
if (require.main === module) stage();
