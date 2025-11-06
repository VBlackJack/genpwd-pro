/*
 * Copyright 2025 Julien Bombled
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// tools/watch.js - Auto-rebuild pour développement
const chokidar = require('chokidar');
const GenPwdBuilder = require('./build');
const path = require('path');

class WatchBuilder {
  constructor() {
    this.builder = new GenPwdBuilder();
    this.isBuilding = false;
    this.buildQueue = [];
    this.continuous = false;
  }

  async start() {
    console.log('🔍 Surveillance des fichiers sources démarrée...');
    
    // Build initial
    await this.build('Initialisation');

    // Surveilller les fichiers sources
    const watcher = chokidar.watch([
      'src/**/*.js',
      'src/**/*.css',
      'src/**/*.html'
    ], {
      ignored: /node_modules/,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    watcher
      .on('change', (filePath) => this.handleFileChange(filePath, 'modifié'))
      .on('add', (filePath) => this.handleFileChange(filePath, 'ajouté'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'supprimé'))
      .on('error', (error) => console.error('Erreur watcher:', error));

    // Gestion arrêt propre
    process.on('SIGINT', () => {
      console.log('\n🛑 Arrêt de la surveillance...');
      watcher.close();
      process.exit(0);
    });

    console.log('✅ Surveillance active - Modifiez vos fichiers sources...');
    console.log('📁 Dossiers surveillés:');
    console.log('   - src/js/**/*.js');
    console.log('   - src/styles/**/*.css');
    console.log('   - src/index.html');
    console.log('\n💡 Ctrl+C pour arrêter');
  }

  handleFileChange(filePath, action) {
    const relativePath = path.relative(process.cwd(), filePath);
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`[${timestamp}] ${relativePath} ${action}`);

    // Ajouter à la queue de build
    this.buildQueue.push({ filePath: relativePath, action, timestamp });
    this.debouncedBuild();
  }

  debouncedBuild() {
    // Debounce les builds multiples
    if (this.buildTimer) {
      clearTimeout(this.buildTimer);
    }

    this.buildTimer = setTimeout(() => {
      this.processBuildQueue();
    }, 500);
  }

  async processBuildQueue() {
    if (this.isBuilding || this.buildQueue.length === 0) {
      return;
    }

    const changes = this.buildQueue.splice(0);
    const changeCount = changes.length;
    const reason = changeCount === 1 ? 
      `${changes[0].filePath} ${changes[0].action}` :
      `${changeCount} fichiers modifiés`;

    await this.build(reason);
  }

  async build(reason) {
    if (this.isBuilding) return;

    this.isBuilding = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🔨 Rebuild: ${reason}`);
      await this.builder.build();
      
      const buildTime = Date.now() - startTime;
      console.log(`✅ Build terminé en ${buildTime}ms`);
      console.log('🌐 Version mise à jour: http://localhost:3000/dist/index.html');
      
    } catch (error) {
      console.error('❌ Erreur de build:', error.message);
    } finally {
      this.isBuilding = false;
    }
  }

  // Mode build continu (alternative)
  async startContinuous() {
    console.log('🔄 Mode build continu activé...');

    this.continuous = true;
    while (this.continuous) {
      try {
        await this.build('Build périodique');
        await this.sleep(5000); // Build toutes les 5 secondes
      } catch (error) {
        console.error('Erreur build continu:', error);
        await this.sleep(10000);
      }
    }
  }

  stopContinuous() {
    this.continuous = false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const watchBuilder = new WatchBuilder();

  if (args.includes('--continuous')) {
    process.on('SIGINT', () => {
      console.log('\n🛑 Arrêt du mode continu...');
      watchBuilder.stopContinuous();
      process.exit(0);
    });
    watchBuilder.startContinuous().catch(console.error);
  } else {
    watchBuilder.start().catch(console.error);
  }
}

module.exports = WatchBuilder;
