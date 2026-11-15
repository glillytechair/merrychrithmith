// Builds dist/index.html: compiles src/main.ts and inlines the JS plus the PNG as base64.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
execSync('npx tsc -p tsconfig.json', { cwd: root, stdio: 'inherit' });

const js = fs.readFileSync(path.join(root, 'build', 'main.js'), 'utf8');
if (js.includes('</script')) throw new Error('compiled JS contains </script');
const png = fs.readFileSync(path.join(root, 'art', 'merry-chrithmith.png')).toString('base64');
const tpl = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const html = tpl.replace('__IMG__', () => png).replace('__JS__', () => js);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
console.log(`dist/index.html written (${(html.length / 1024).toFixed(0)} KB)`);
