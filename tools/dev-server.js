// tools/dev-server.js - Serveur HTTP minimal pour développement modulaire (VERSION CORRIGÉE)
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

class DevServer {
  constructor(port = 3000, sourceDir = 'src') {
    this.port = port;
    this.sourceDir = sourceDir;
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
      console.log(`[DEV] Dictionnaires: ./dictionaries/`);
      console.log(`[DEV] Ctrl+C pour arrêter`);
      
      // Auto-ouverture navigateur selon la plateforme
      this.openBrowser();
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
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    
    // CORRECTION CRITIQUE : Gestion correcte des chemins de fichiers
    let filePath;
    if (safePath.startsWith('/dictionaries/')) {
      // Dictionnaires à la racine du projet
      filePath = path.join(process.cwd(), safePath.substring(1));
      console.log(`[DEV] Demande dictionnaire: ${filePath}`);
    } else {
      // Autres fichiers dans src/
      filePath = path.join(process.cwd(), this.sourceDir, safePath);
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