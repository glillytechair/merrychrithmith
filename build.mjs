// Builds dist/index.html: compiles src/main.ts and inlines the JS plus the PNG as base64.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
execSync('npx tsc -p tsconfig.json', { cwd: root, stdio: 'inherit' });

const js = fs.readFileSync(path.join(root, 'build', 'main.js'), 'utf8');
if (js.includes('</script')) throw new Error('compiled JS contains </script');
const png = fs.readFileSync(path.join(root, 'art', 'merry-chrithmith.png')).toString('base64');
const photo = fs.readFileSync(path.join(root, 'art', 'endscene.jpg')).toString('base64');   // the perfect-day photo, a resized copy of endscene.png
const tpl = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const html = tpl.replace('__IMG__', () => png).replace('__PHOTO__', () => photo).replace('__JS__', () => js);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
// The photo music travels beside the page rather than inside it: it is only fetched once the photo is unlocked.
const clip = path.join(root, 'art', 'photo-music.aac');
if (fs.existsSync(clip)) fs.copyFileSync(clip, path.join(root, 'dist', 'photo-music.aac'));
else console.warn('art/photo-music.aac is missing: the photo will have no music until it exists');
console.log(`dist/index.html written (${(html.length / 1024).toFixed(0)} KB)`);
