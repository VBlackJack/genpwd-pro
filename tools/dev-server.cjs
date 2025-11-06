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
// tools/dev-server.js - Serveur HTTP minimal pour développement modulaire
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

class DevServer {
  constructor(port = 3000, sourceDir = 'src', options = {}) {
    this.port = port;
    this.sourceDir = sourceDir;
    this.options = {
      autoOpen: options.autoOpen !== false,
      quiet: Boolean(options.quiet)
    };
    this.mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.ico': 'image/x-icon',
      '.svg': 'image/svg+xml'
    };
  }

  start() {
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    server.listen(this.port, () => {
      console.log(`[DEV] GenPwd Pro serveur sur http://localhost:${this.port}`);
      console.log(`[DEV] Mode développement modulaire ES6 activé`);
      console.log(`[DEV] Source: ./${this.sourceDir}/`);
      console.log(`[DEV] Dictionnaires: ./${this.sourceDir}/dictionaries/`);
      console.log(`[DEV] Ctrl+C pour arrêter`);
      
      // Auto-ouverture navigateur selon la plateforme
      if (this.options.autoOpen) {
        this.openBrowser();
      } else if (!this.options.quiet) {
        console.log('[DEV] Ouverture automatique désactivée');
      }
    });

    // Gestion arrêt propre
    process.on('SIGINT', () => {
      console.log('\n[DEV] Arrêt du serveur de développement');
      server.close(() => {
        process.exit(0);
      });
    });

    return server;
  }

  openBrowser() {
    const { spawn } = require('child_process');
    const url = `http://localhost:${this.port}`;
    
    try {
      if (process.platform === 'win32') {
        spawn('cmd', ['/c', 'start', url], { stdio: 'ignore' });
      } else if (process.platform === 'darwin') {
        spawn('open', [url], { stdio: 'ignore' });
      } else {
        spawn('xdg-open', [url], { stdio: 'ignore' });
      }
    } catch (error) {
      console.log(`[DEV] Ouverture navigateur manuelle : ${url}`);
    }
  }

  handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // Route par défaut
    if (pathname === '/') {
      pathname = '/index.html';
    }

    // Sécurité : empêcher l'accès aux répertoires parents
    const normalizedPath = path.posix.normalize(pathname);
    const isDictionaryRequest = normalizedPath.startsWith('/dictionaries/');
    const baseDir = isDictionaryRequest
      ? path.join(process.cwd(), this.sourceDir, 'dictionaries')
      : path.join(process.cwd(), this.sourceDir);
    const relativePath = isDictionaryRequest
      ? normalizedPath.substring('/dictionaries'.length)
      : normalizedPath;
    const candidatePath = path.resolve(baseDir, '.' + relativePath);

    const baseDirWithSep = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
    if (!candidatePath.startsWith(baseDirWithSep)) {
      console.warn(`[DEV] Tentative d'accès hors racine bloquée: ${pathname}`);
      this.send404(res, pathname);
      return;
    }

    const filePath = candidatePath;
    if (isDictionaryRequest) {
      console.log(`[DEV] Demande dictionnaire: ${filePath}`);
    }

    // Vérification existence fichier
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.log(`[DEV] Fichier non trouvé: ${filePath}`);
        this.send404(res, pathname);
        return;
      }

      // Détermination MIME type
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = this.mimeTypes[ext] || 'application/octet-stream';

      // Headers pour modules ES6 et CORS
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      // Content Security Policy for enhanced security
      // Matches the CSP defined in src/index.html
      res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self'; " +
        "img-src 'self' data:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' blob:; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'; " +
        "upgrade-insecure-requests;"
      );

      // Gestion OPTIONS pour CORS
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Streaming du fichier
      const stream = fs.createReadStream(filePath);
      res.writeHead(200);
      stream.pipe(res);

      stream.on('error', (streamErr) => {
        console.error(`[ERROR] Lecture fichier ${filePath}:`, streamErr.message);
        if (!res.headersSent) {
          this.send500(res);
        }
      });

      // Logging requests
      const timestamp = new Date().toLocaleTimeString();
      const size = this.getFileSize(filePath);
      console.log(`[${timestamp}] ${req.method} ${pathname} - ${mimeType} (${size})`);
    });
  }

  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const bytes = stats.size;
      
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
      return `${Math.round(bytes / (1024 * 1024))}MB`;
    } catch {
      return 'unknown';
    }
  }

  send404(res, pathname) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>404 - Fichier non trouvé</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                 max-width: 600px; margin: 100px auto; padding: 20px; }
          h1 { color: #e74c3c; }
          code { background: #f8f9fa; padding: 2px 8px; border-radius: 4px; }
          a { color: #3498db; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>404 - Fichier non trouvé</h1>
        <p>Le fichier <code>${pathname}</code> n'existe pas dans le répertoire source.</p>
        <p><a href="/">← Retour à l'accueil</a></p>
        <hr>
        <small>GenPwd Pro - Serveur de développement</small>
      </body>
      </html>
    `);
  }

  send500(res) {
    if (res.headersSent) return;
    
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <body>
        <h1>500 - Erreur serveur</h1>
        <p>Une erreur s'est produite lors de la lecture du fichier.</p>
        <p><a href="/">← Retour à l'accueil</a></p>
      </body>
      </html>
    `);
  }
}

// Démarrage si exécuté directement
if (require.main === module) {
  const port = process.env.PORT || 3000;
  const sourceDir = process.argv[2] || 'src';
  
  const server = new DevServer(port, sourceDir);
  server.start();
}

module.exports = DevServer;
