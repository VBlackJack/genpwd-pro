#!/usr/bin/env node

/**
 * Script de génération des icônes PWA pour GenPwd Pro.
 * - Crée un SVG de base stylisé "GP".
 * - Utilise Puppeteer pour rasteriser le SVG en PNG aux tailles standard PWA.
 * - Enregistre les icônes dans le dossier cible (par défaut src/assets/icons).
 */

const fs = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'icons');
const BASE_SVG_NAME = 'genpwd-pro-base.svg';

const BASE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="gpGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <filter id="shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="20" flood-color="#0f172a" flood-opacity="0.45" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="#0f172a" />
  <rect x="52" y="52" width="408" height="408" rx="96" fill="url(#gpGradient)" filter="url(#shadow)" />
  <text x="50%" y="54%" text-anchor="middle" font-family="'Segoe UI', 'Inter', sans-serif" font-size="220" font-weight="700" fill="#f8fafc" letter-spacing="-12">
    GP
  </text>
</svg>`;

function buildSizedSvg(size) {
  return BASE_SVG.replace('<svg', `<svg width="${size}" height="${size}"`);
}

async function ensureDirectory(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
}

async function writeBaseSvg(targetDir) {
  const svgPath = path.join(targetDir, BASE_SVG_NAME);
  await fs.writeFile(svgPath, BASE_SVG, 'utf8');
  return svgPath;
}

async function renderSvgToPng({ page, size, targetDir }) {
  const svgMarkup = buildSizedSvg(size);
  const html = `<!DOCTYPE html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <style>
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        svg {
          display: block;
        }
      </style>
    </head>
    <body>
      ${svgMarkup}
    </body>
  </html>`;

  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.waitForTimeout(50);
  const buffer = await page.screenshot({ type: 'png' });
  const filePath = path.join(targetDir, `icon-${size}x${size}.png`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function generateIcons({ outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  const absoluteOutput = path.resolve(outputDir);
  await ensureDirectory(absoluteOutput);
  const baseSvgPath = await writeBaseSvg(absoluteOutput);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const generatedFiles = [];

  try {
    for (const size of ICON_SIZES) {
      const filePath = await renderSvgToPng({ page, size, targetDir: absoluteOutput });
      generatedFiles.push({ size, filePath });
      console.log(`✅ Icône ${size}x${size} générée : ${path.relative(process.cwd(), filePath)}`);
    }
  } finally {
    await page.close();
    await browser.close();
  }

  console.log(`🎨 SVG de base enregistré : ${path.relative(process.cwd(), baseSvgPath)}`);

  return {
    outputDir: absoluteOutput,
    baseSvgPath,
    generatedFiles,
  };
}

if (require.main === module) {
  generateIcons()
    .then((result) => {
      console.log(`\n✨ ${result.generatedFiles.length} icônes générées dans ${result.outputDir}`);
    })
    .catch((error) => {
      console.error('❌ Échec de la génération des icônes PWA:', error);
      process.exitCode = 1;
    });
}

module.exports = {
  generateIcons,
  ICON_SIZES,
  BASE_SVG,
};
