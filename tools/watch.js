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
// tools/watch.js - Auto-rebuild for development
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
    console.log('🔍 Source file watching started...');
    
    // Initial build
    await this.build('Initialization');

    // Watch source files
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
      .on('change', (filePath) => this.handleFileChange(filePath, 'modified'))
      .on('add', (filePath) => this.handleFileChange(filePath, 'added'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'deleted'))
      .on('error', (error) => console.error('Watcher error:', error));

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping file watcher...');
      watcher.close();
      process.exit(0);
    });

    console.log('✅ Watching active - Modify your source files...');
    console.log('📁 Watched directories:');
    console.log('   - src/js/**/*.js');
    console.log('   - src/styles/**/*.css');
    console.log('   - src/index.html');
    console.log('\n💡 Ctrl+C to stop');
  }

  handleFileChange(filePath, action) {
    const relativePath = path.relative(process.cwd(), filePath);
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`[${timestamp}] ${relativePath} ${action}`);

    // Add to build queue
    this.buildQueue.push({ filePath: relativePath, action, timestamp });
    this.debouncedBuild();
  }

  debouncedBuild() {
    // Debounce multiple builds
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
      `${changeCount} files modified`;

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
      console.log(`✅ Build completed in ${buildTime}ms`);
      console.log('🌐 Version updated: http://localhost:3000/dist/index.html');
      
    } catch (error) {
      console.error('❌ Build error:', error.message);
    } finally {
      this.isBuilding = false;
    }
  }

  // Continuous build mode (alternative)
  async startContinuous() {
    console.log('🔄 Continuous build mode activated...');

    this.continuous = true;
    while (this.continuous) {
      try {
        await this.build('Periodic build');
        await this.sleep(5000); // Build every 5 seconds
      } catch (error) {
        console.error('Continuous build error:', error);
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
      console.log('\n🛑 Stopping continuous mode...');
      watchBuilder.stopContinuous();
      process.exit(0);
    });
    watchBuilder.startContinuous().catch(console.error);
  } else {
    watchBuilder.start().catch(console.error);
  }
}

module.exports = WatchBuilder;
