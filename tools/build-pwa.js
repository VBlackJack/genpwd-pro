#!/usr/bin/env node

/**
 * Script de build PWA pour GenPwd Pro.
 * - Génére les icônes (via generate-icons.js).
 * - Copie les fichiers nécessaires dans dist/pwa.
 * - Vérifie la présence des fichiers critiques.
 * - Produit un rapport de build.
 */

const fs = require('fs/promises');
const path = require('path');
const { generateIcons, ICON_SIZES } = require('./generate-icons');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist', 'pwa');
const REPORT_FILE = path.join(DIST_DIR, 'build-report.json');

const REQUIRED_FILES = [
  'index.html',
  'manifest.json',
  'service-worker.js',
  'pwa-installer.js',
  path.join('styles', 'pwa-styles.css'),
];

const REQUIRED_DIRS = [
  'js',
  'styles',
  'dictionaries',
  path.join('assets', 'icons'),
];

async function resetDistDir() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });
}

async function copyEntry(source, destination, copiedFiles) {
  const stats = await fs.stat(source);
  if (stats.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    const entries = await fs.readdir(source);
    for (const entry of entries) {
      await copyEntry(path.join(source, entry), path.join(destination, entry), copiedFiles);
    }
  } else {
    await fs.copyFile(source, destination);
    copiedFiles.push(path.relative(ROOT_DIR, destination));
  }
}

async function copySources() {
  const copiedFiles = [];
  await copyEntry(SRC_DIR, DIST_DIR, copiedFiles);
  return copiedFiles;
}

async function validateDist() {
  const missing = [];

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(DIST_DIR, file);
    try {
      await fs.access(filePath);
    } catch (error) {
      missing.push(path.relative(ROOT_DIR, filePath));
    }
  }

  for (const dir of REQUIRED_DIRS) {
    const dirPath = path.join(DIST_DIR, dir);
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        missing.push(path.relative(ROOT_DIR, dirPath));
      }
    } catch (error) {
      missing.push(path.relative(ROOT_DIR, dirPath));
    }
  }

  for (const size of ICON_SIZES) {
    const iconPath = path.join(DIST_DIR, 'assets', 'icons', `icon-${size}x${size}.png`);
    try {
      await fs.access(iconPath);
    } catch (error) {
      missing.push(path.relative(ROOT_DIR, iconPath));
    }
  }

  return missing;
}

async function createReport({ copiedFiles, iconResult, missing }) {
  const report = {
    generatedAt: new Date().toISOString(),
    distDir: path.relative(ROOT_DIR, DIST_DIR),
    totalFiles: copiedFiles.length,
    icons: iconResult.generatedFiles.map((entry) => ({
      size: entry.size,
      file: path.relative(ROOT_DIR, entry.filePath),
    })),
    baseSvg: path.relative(ROOT_DIR, iconResult.baseSvgPath),
    missing,
    status: missing.length === 0 ? 'success' : 'incomplete',
  };

  await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  console.log(`📄 Rapport de build disponible : ${path.relative(ROOT_DIR, REPORT_FILE)}`);
  if (missing.length > 0) {
    console.warn('⚠️ Des fichiers sont manquants :');
    missing.forEach((file) => console.warn(`  - ${file}`));
  } else {
    console.log('✅ Tous les fichiers requis sont présents.');
  }
}

async function buildPwa() {
  console.log('🚀 Démarrage du build PWA GenPwd Pro...');
  const iconResult = await generateIcons();
  await resetDistDir();
  const copiedFiles = await copySources();
  const missing = await validateDist();
  await createReport({ copiedFiles, iconResult, missing });
  console.log('✨ Build PWA terminé.');
  return { copiedFiles, iconResult, missing };
}

if (require.main === module) {
  buildPwa().catch((error) => {
    console.error('❌ Échec du build PWA :', error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildPwa,
};
