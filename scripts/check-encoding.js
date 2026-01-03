import fs from 'fs';
import path from 'path';

const DEFAULT_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.html',
  '.css',
  '.scss',
  '.txt',
  '.sql',
  '.yml',
  '.yaml',
]);

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'dist', 'temp', 'assets']);

const PATTERNS = [
  {
    name: 'utf8-mojibake',
    re: /[\u00c2\u00c3\u00e2\u00f0-\u00f4][\u0080-\u00bf]{1,3}/u,
  },
  { name: 'cp1252-control', re: /[\u0080-\u009f]/u },
  {
    name: 'cp1252-symbol',
    re: /[\u00a0\u00a1\u00a2\u00a3\u00a4\u00a6\u00a7\u00a8\u00ab\u00ac\u00ad\u00ae\u00af\u00b0\u00b1\u00b4\u00b5\u00b6\u00b7\u00b8\u00bb\u00bf\u00c6\u00d0\u00d7\u00d8\u00de\u00f0\u00f7\u00f8\u00fe]/u,
  },
  {
    name: 'cp850-pair',
    re: /\u00c7[\u0153\u00f5\u00e6\u00ad\u00b8\u00a6\u00f0\u00fc]/u,
  },
];

function shouldSkipDir(dirName) {
  return EXCLUDE_DIRS.has(dirName);
}

function shouldIncludeFile(filePath) {
  return DEFAULT_EXTS.has(path.extname(filePath).toLowerCase());
}

function walk(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) {
        continue;
      }
      walk(fullPath, results);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!shouldIncludeFile(fullPath)) {
      continue;
    }
    results.push(fullPath);
  }
}

function scanFile(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  const hits = [];
  for (const pattern of PATTERNS) {
    if (pattern.re.test(text)) {
      hits.push(pattern.name);
    }
  }
  return hits.length ? hits : null;
}

function main() {
  const root = process.cwd();
  const files = [];
  walk(root, files);

  const findings = [];
  for (const filePath of files) {
    const hits = scanFile(filePath);
    if (hits) {
      findings.push({ filePath, hits });
    }
  }

  if (findings.length) {
    for (const finding of findings) {
      const rel = path.relative(root, finding.filePath);
      console.log(`${rel} :: ${finding.hits.join(',')}`);
    }
    console.log(`encoding_check_failed=${findings.length}`);
    process.exit(1);
  }

  console.log('encoding_check_ok=1');
}

main();
