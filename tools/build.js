// tools/build.js - Build système intelligent pour GenPwd Pro
const fs = require('fs');
const path = require('path');

class GenPwdBuilder {
  constructor() {
    this.sourceDir = 'src';
    this.distDir = 'dist';
    this.moduleOrder = [
      'js/config/constants.js',
      'js/utils/helpers.js',
      'js/utils/logger.js',
      'js/utils/toast.js',
      'js/utils/clipboard.js',
      'js/core/dictionaries.js',
      'js/core/casing.js',
      'js/core/generators.js',
      'js/config/settings.js',
      'js/ui/dom.js',
      'js/ui/events.js',
      'js/ui/render.js',
      'js/ui/modal.js',
      'js/app.js'
    ];
    this.cssFiles = [
      'styles/main.css',
      'styles/components.css',
      'styles/layout.css',
      'styles/modal.css'
    ];
  }

  async build() {
    console.log('🔨 GenPwd Pro - Build hybride en cours...');
    
    try {
      this.ensureDistDir();
      
      const bundleJS = await this.buildJavaScript();
      const bundleCSS = await this.buildCSS();
      const finalHTML = await this.buildHTML(bundleCSS, bundleJS);
      
      await this.copyAssets();
      
      console.log('✅ Build terminé avec succès');
      console.log(`📦 Sortie: ${this.distDir}/index.html (${Math.round(finalHTML.length / 1024)}KB)`);
      console.log('🎯 Version monolithe prête - Compatible file://');
      
    } catch (error) {
      console.error('❌ Erreur de build:', error);
      process.exit(1);
    }
  }

  ensureDistDir() {
    if (!fs.existsSync(this.distDir)) {
      fs.mkdirSync(this.distDir, { recursive: true });
    }
  }

  async buildJavaScript() {
    console.log('📦 Consolidation JavaScript...');
    
    let output = `// GenPwd Pro v2.5 - Build automatique ${new Date().toISOString()}
(function() {
"use strict";

// ============================================================================
// MODULES CONSOLIDÉS (${this.moduleOrder.length} fichiers)
// ============================================================================

// Variables globales pour remplacer les imports/exports
const GenPwdModules = {};
`;

    // Traitement de chaque module dans l'ordre
    for (const modulePath of this.moduleOrder) {
      const fullPath = path.join(this.sourceDir, modulePath);
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️  Module manquant: ${modulePath}`);
        continue;
      }
      
      const moduleContent = fs.readFileSync(fullPath, 'utf8');
      const processedContent = this.processModule(moduleContent, modulePath);
      
      output += `\n// === ${modulePath} ===\n`;
      output += processedContent;
      output += '\n';
    }

    // Initialisation automatique
    output += `
// ============================================================================
// INITIALISATION AUTOMATIQUE
// ============================================================================

function initGenPwdApp() {
  try {
    if (typeof GenPwdApp !== 'undefined') {
      window.genPwdApp = new GenPwdApp();
      window.genPwdApp.init();
    } else {
      console.error('GenPwdApp non trouvé');
    }
  } catch (error) {
    console.error('Erreur initialisation:', error);
  }
}

// Démarrage automatique
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGenPwdApp);
} else {
  initGenPwdApp();
}

})(); // Fin IIFE
`;

    // Écriture du bundle
    const bundlePath = path.join(this.distDir, 'genpwd-bundle.js');
    fs.writeFileSync(bundlePath, output);
    
    console.log(`✅ JavaScript consolidé (${Math.round(output.length / 1024)}KB)`);
    return output;
  }

  processModule(content, modulePath) {
    // Suppression des imports/exports ES6
    let processed = content
      .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ')
      .replace(/^export\s*{[^}]+}\s*;?\s*$/gm, '')
      .replace(/^export\s+(default\s+)?/gm, '');

    // Remplacements spécifiques par module
    if (modulePath.includes('constants.js')) {
      // Les constantes deviennent disponibles globalement
      processed = processed.replace(/^(const|let|var)\s+(\w+)/gm, 
        'GenPwdModules.$2 = window.$2 = $1 $2');
    }
    
    if (modulePath.includes('app.js')) {
      // La classe principale devient globale
      processed = processed.replace(/class\s+GenPwdApp/, 'window.GenPwdApp = class GenPwdApp');
    }

    if (modulePath.includes('generators.js')) {
      // Les fonctions de génération deviennent disponibles
      processed = processed.replace(/^(async\s+)?function\s+(\w+)/gm, 
        'GenPwdModules.$2 = window.$2 = $1function $2');
    }

    // Correction des références internes
    processed = processed.replace(/import\s*{\s*([^}]+)\s*}\s*from\s*['"][^'"]+['"];?/g, 
      '// Référence: $1');

    return processed;
  }

  async buildCSS() {
    console.log('🎨 Consolidation CSS...');
    
    let consolidatedCSS = '/* GenPwd Pro v2.5 - Styles consolidés */\n\n';
    
    for (const cssFile of this.cssFiles) {
      const fullPath = path.join(this.sourceDir, cssFile);
      
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        consolidatedCSS += `/* === ${cssFile} === */\n`;
        consolidatedCSS += content + '\n\n';
      } else {
        console.warn(`⚠️  CSS manquant: ${cssFile}`);
      }
    }
    
    console.log(`✅ CSS consolidé (${Math.round(consolidatedCSS.length / 1024)}KB)`);
    return consolidatedCSS;
  }

  async buildHTML(css, js) {
    console.log('🏗️  Construction HTML final...');
    
    const sourceHTML = path.join(this.sourceDir, 'index.html');
    let htmlContent = fs.readFileSync(sourceHTML, 'utf8');
    
    // Suppression des imports CSS et JS
    htmlContent = htmlContent
      .replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '')
      .replace(/<script[^>]*type="module"[^>]*>.*?<\/script>/gs, '')
      .replace(/<script[^>]*src="js\/app\.js"[^>]*><\/script>/g, '');

    // Injection CSS dans <head>
    const cssInjection = `  <style>\n${css}  </style>\n</head>`;
    htmlContent = htmlContent.replace('</head>', cssInjection);

    // Injection JS avant </body>
    const jsInjection = `  <script>\n${js}  </script>\n</body>`;
    htmlContent = htmlContent.replace('</body>', jsInjection);

    // Écriture du fichier final
    const outputPath = path.join(this.distDir, 'index.html');
    fs.writeFileSync(outputPath, htmlContent);
    
    console.log(`✅ HTML final généré (${Math.round(htmlContent.length / 1024)}KB)`);
    return htmlContent;
  }

  async copyAssets() {
    console.log('📋 Copie des assets...');
    
    // Copier dictionnaires
    const dictSource = 'dictionaries';
    const dictDest = path.join(this.distDir, 'dictionaries');
    
    if (fs.existsSync(dictSource)) {
      this.copyRecursive(dictSource, dictDest);
      console.log('✅ Dictionnaires copiés');
    }

    // Copier assets Electron si présents
    const assetsSource = 'assets';
    const assetsDest = path.join(this.distDir, 'assets');
    
    if (fs.existsSync(assetsSource)) {
      this.copyRecursive(assetsSource, assetsDest);
      console.log('✅ Assets copiés');
    }
  }

  copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// Exécution si appelé directement
if (require.main === module) {
  const builder = new GenPwdBuilder();
  builder.build().catch(console.error);
}

module.exports = GenPwdBuilder;