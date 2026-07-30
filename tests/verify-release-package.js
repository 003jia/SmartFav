const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(projectRoot, 'smartFav智能收藏夹');
const sourceManifest = JSON.parse(
  fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8')
);
const defaultArchive = path.join(
  projectRoot,
  'dist',
  `SmartFav-Edge-${sourceManifest.version}.zip`
);
const archivePath = path.resolve(process.argv[2] || defaultArchive);
const tempPrefix = path.join(os.tmpdir(), 'smartfav-release-');
const extractRoot = fs.mkdtempSync(tempPrefix);

function listFiles(root) {
  const result = [];
  function visit(current) {
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      if (entry.name === '.DS_Store' || entry.name === '__MACOSX') return;
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        return;
      }
      if (entry.isFile()) {
        result.push(path.relative(root, absolutePath).split(path.sep).join('/'));
      }
    });
  }
  visit(root);
  return result.sort();
}

try {
  assert.ok(fs.existsSync(archivePath), `release archive not found: ${archivePath}`);
  childProcess.execFileSync('unzip', ['-q', archivePath, '-d', extractRoot], {
    stdio: 'pipe'
  });

  const sourceFiles = listFiles(extensionRoot);
  const packagedFiles = listFiles(extractRoot);
  assert.deepEqual(
    packagedFiles,
    sourceFiles,
    'release file list differs from the current extension source'
  );

  sourceFiles.forEach((relativePath) => {
    const sourceBytes = fs.readFileSync(path.join(extensionRoot, relativePath));
    const packagedBytes = fs.readFileSync(path.join(extractRoot, relativePath));
    assert.equal(
      Buffer.compare(sourceBytes, packagedBytes),
      0,
      `release file content differs: ${relativePath}`
    );
  });

  const packagedManifest = JSON.parse(
    fs.readFileSync(path.join(extractRoot, 'manifest.json'), 'utf8')
  );
  assert.equal(packagedManifest.version, sourceManifest.version);
  assert.equal(packagedManifest.manifest_version, 3);
  assert.equal(packagedManifest.action.default_popup, 'popup.html');
  assert.match(
    packagedManifest.content_security_policy.extension_pages,
    /script-src 'self'/
  );
  assert.ok(packagedFiles.includes('constants.js'));
  assert.ok(!packagedFiles.includes('styles/options.css'));
  assert.ok(!packagedFiles.some((name) => (
    name.startsWith('.git/')
    || name.startsWith('audit/')
    || name.includes('__MACOSX')
    || name.endsWith('.DS_Store')
  )));

  console.log(
    `SmartFav ${sourceManifest.version} release package matches ${sourceFiles.length} source files.`
  );
} finally {
  if (extractRoot.startsWith(tempPrefix)) {
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }
}
