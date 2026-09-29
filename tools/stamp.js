// Sürüm damgası: index.html'deki CSS ve JS adreslerine dosya içeriğinden türetilen ?v=… ekler.
//
// Neden: GitHub Pages her dosyayı 10 dakika önbelleğe alınabilir işaretler. Oyun güncellendiğinde
// tarayıcı bazı modülleri eski, bazılarını yeni sürümden yükleyebilir ve oyun hiç açılmaz. Damga,
// her dosyanın yalnızca içeriği değiştiğinde yeni bir adresle indirilmesini sağlar. JS modülleri
// birbirini tarayıcının "import map" özelliğiyle damgalı adreslerden içe aktarır.
//
// Kullanım: her yayından önce  npm run stamp  (npm test damganın güncel olduğunu denetler)
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const START = '<!-- sürüm-damgası:başla -->';
const END = '<!-- sürüm-damgası:bitir -->';

async function listFiles(dir, ext) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(path, ext);
      return entry.name.endsWith(ext) ? [path] : [];
    }),
  );
  return nested.flat().sort();
}

async function fingerprint(path) {
  return createHash('sha1').update(await readFile(path)).digest('hex').slice(0, 10);
}

const toUrl = (path) => relative(ROOT, path).split(sep).join('/');

/** index.html'in damgalanmış hâlini üretir (dosyaya yazmaz). */
export async function stampedIndex(root = ROOT) {
  const html = await readFile(join(root, 'index.html'), 'utf8');
  const scripts = await listFiles(join(root, 'js'), '.js');
  const imports = {};
  for (const path of scripts) imports[`./${toUrl(path)}`] = `./${toUrl(path)}?v=${await fingerprint(path)}`;
  const css = `css/style.css?v=${await fingerprint(join(root, 'css', 'style.css'))}`;
  const main = imports['./js/main.js'].slice(2);

  const block = [
    START,
    `    <link rel="stylesheet" href="${css}" />`,
    `    <script type="importmap">`,
    JSON.stringify({ imports }, null, 2)
      .split('\n')
      .map((line) => `      ${line}`)
      .join('\n'),
    `    </script>`,
    `    <script type="module" src="${main}"></script>`,
    `    ${END}`,
  ].join('\n');

  const from = html.indexOf(START);
  const to = html.indexOf(END);
  if (from < 0 || to < 0) throw new Error(`index.html içinde ${START} ... ${END} işaretleri bulunamadı`);
  return html.slice(0, from) + block + html.slice(to + END.length);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = await stampedIndex();
  await writeFile(join(ROOT, 'index.html'), html);
  console.log('index.html damgalandı.');
}
