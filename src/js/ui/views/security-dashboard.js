/**
 * @fileoverview Security Dashboard View
 * Visualizes vault health and security metrics
 */

import hibpService from '../../services/hibp-service.js';
import { escapeHtml } from '../../utils/helpers.js';

export class SecurityDashboard {
    #container;
    #entries = [];
    #breachResults = new Map();
    #isAnalyzing = false;

    constructor(container) {
        this.#container = container;
    }

    /**
     * Render the dashboard
     * @param {Array} entries - Vault entries
     */
    async render(entries) {
        this.#entries = entries.filter(e => e.type === 'login' && e.data?.password);

        this.#container.innerHTML = `
      <div class="security-dashboard">
        <div class="dashboard-header">
          <h2>Vault Health</h2>
          <div class="dashboard-actions">
             <button class="vault-btn vault-btn-primary" id="btn-analyze-breaches">
               <span class="icon">🔍</span> Check for breaches (HIBP)
             </button>
          </div>
        </div>

        <div class="dashboard-grid">
          <!-- Overall Score -->
          <div class="dashboard-card score-card" id="card-score">
            <div class="score-ring-container">
               <svg class="score-ring" viewBox="0 0 100 100">
                 <circle class="score-ring-bg" cx="50" cy="50" r="45"></circle>
                 <circle class="score-ring-progress" cx="50" cy="50" r="45" stroke-dasharray="283" stroke-dashoffset="0"></circle>
                 <text x="50" y="55" text-anchor="middle" class="score-text">--</text>
               </svg>
               <div class="score-label">Overall Score</div>
            </div>
            <div class="score-grade" id="score-grade">--</div>
          </div>

          <!-- Quick Stats -->
          <div class="dashboard-card stats-card">
            <div class="stat-item">
              <span class="stat-value" id="count-weak">0</span>
              <span class="stat-label">Weak passwords</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="count-reused">0</span>
              <span class="stat-label">Reused</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="count-old">0</span>
              <span class="stat-label">Old (> 1 year)</span>
            </div>
            <div class="stat-item danger">
              <span class="stat-value" id="count-breached">0</span>
              <span class="stat-label">Compromised</span>
            </div>
          </div>
        </div>

        <!-- Issue Lists -->
        <div class="dashboard-issues">
           <div class="issue-section" id="section-breached" hidden>
             <h3>🚨 Compromised passwords</h3>
             <div class="issue-list" id="list-breached"></div>
           </div>

           <div class="issue-section">
             <h3>⚠️ Reused passwords</h3>
             <div class="issue-list" id="list-reused"></div>
           </div>

           <div class="issue-section">
             <h3>⚠️ Weak passwords</h3>
             <div class="issue-list" id="list-weak"></div>
           </div>
        </div>
      </div>
    `;

        this.#attachEvents();
        this.#calculateMetrics();
    }

    #calculateMetrics() {
        let weakCount = 0;
        let reusedCount = 0;
        let oldCount = 0;

        const passwordCounts = new Map();
        const weakList = [];
        const reusedList = [];

        // Analyze entries
        for (const entry of this.#entries) {
            const pwd = entry.data.password;

            // Reused check
            passwordCounts.set(pwd, (passwordCounts.get(pwd) || 0) + 1);

            // Weak check (simple heuristic for now, could use zxcvbn)
            if (pwd.length < 8 || /^[a-zA-Z]+$/.test(pwd) || /^[0-9]+$/.test(pwd)) {
                weakCount++;
                weakList.push(entry);
            }

            // Age check (approximate based on modifiedAt)
            const modified = new Date(entry.modifiedAt || entry.createdAt);
            const yearAgo = new Date();
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            if (modified < yearAgo) {
                oldCount++;
            }
        }

        // Process reused
        for (const [pwd, count] of passwordCounts) {
            if (count > 1) {
                reusedCount += count;
                // Find entries using this pwd
                const usingEntries = this.#entries.filter(e => e.data.password === pwd);
                reusedList.push({ password: pwd, count, entries: usingEntries });
            }
        }

        // Update UI Stats
        document.getElementById('count-weak').textContent = weakCount;
        document.getElementById('count-reused').textContent = reusedCount;
        document.getElementById('count-old').textContent = oldCount;

        // Render Lists
        this.#renderWeakList(weakList);
        this.#renderReusedList(reusedList);

        // Calculate Score
        // Base 100
        // -5 per weak
        // -10 per reused set
        // -20 per breached (if known)
        let score = 100;
        score -= (weakCount * 5);
        score -= (reusedList.length * 10);
        if (score < 0) score = 0;

        this.#updateScoreUI(score);
    }

    #updateScoreUI(score) {
        const ring = document.querySelector('.score-ring-progress');
        const text = document.querySelector('.score-text');
        const gradeEl = document.getElementById('score-grade');

        // Ring circumference = 2 * PI * 45 ≈ 283
        const offset = 283 - (283 * score) / 100;

        // Color
        let color = '#ef4444'; // Red
        let grade = 'F';
        if (score >= 90) { color = '#34d399'; grade = 'A'; } // Green
        else if (score >= 80) { color = '#10b981'; grade = 'B'; }
        else if (score >= 60) { color = '#fbbf24'; grade = 'C'; }
        else if (score >= 40) { color = '#f59e0b'; grade = 'D'; }

        if (ring) {
            ring.style.strokeDashoffset = offset;
            ring.style.stroke = color;
        }
        if (text) text.textContent = score;
        if (gradeEl) {
            gradeEl.textContent = grade;
            gradeEl.style.color = color;
        }
    }

    #renderWeakList(entries) {
        const container = document.getElementById('list-weak');
        if (!container) return;

        if (entries.length === 0) {
            container.innerHTML = '<div class="empty-issue">No weak passwords detected. Great job!</div>';
            return;
        }

        container.innerHTML = entries.map(entry => `
      <div class="issue-item">
        <div class="issue-icon">🔓</div>
        <div class="issue-info">
          <div class="issue-title">${escapeHtml(entry.title)}</div>
          <div class="issue-desc">${escapeHtml(entry.data.username || 'No username')}</div>
        </div>
        <button class="vault-btn vault-btn-sm vault-btn-outline" data-action="edit" data-id="${entry.id}">Fix</button>
      </div>
    `).join('');
    }

    #renderReusedList(groups) {
        const container = document.getElementById('list-reused');
        if (!container) return;

        if (groups.length === 0) {
            container.innerHTML = '<div class="empty-issue">No reused passwords. Excellent!</div>';
            return;
        }

        container.innerHTML = groups.map(group => `
      <div class="issue-group">
        <div class="issue-group-header">
           <strong>${group.count} accounts use the same password</strong>
        </div>
        ${group.entries.map(entry => `
          <div class="issue-item">
            <div class="issue-icon">♻️</div>
            <div class="issue-info">
              <div class="issue-title">${escapeHtml(entry.title)}</div>
              <div class="issue-desc">${escapeHtml(entry.data.username || '')}</div>
            </div>
             <button class="vault-btn vault-btn-sm vault-btn-outline" data-action="edit" data-id="${entry.id}">Change</button>
          </div>
        `).join('')}
      </div>
    `).join('');
    }

    async #analyzeBreaches() {
        if (this.#isAnalyzing) return;
        this.#isAnalyzing = true;

        const btn = document.getElementById('btn-analyze-breaches');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="vault-spinner-small"></span> Analyzing...';

        let breachedCount = 0;
        const breachedList = [];

        // Analyze in batches of 5 to avoid rate limits
        // HIBP Service handles k-anonymity securely
        for (const entry of this.#entries) {
            const result = await hibpService.checkPassword(entry.data.password);
            if (result.isPwned) {
                breachedCount++;
                breachedList.push({ entry, count: result.count });
            }
        }

        // Update UI
        this.#renderBreachedList(breachedList);
        document.getElementById('count-breached').textContent = breachedCount;

        // Update Score (heavy penalty for breaches)
        const currentScore = parseInt(document.querySelector('.score-text').textContent || '0', 10);
        let newScore = currentScore - (breachedCount * 20);
        if (newScore < 0) newScore = 0;
        this.#updateScoreUI(newScore);

        btn.innerHTML = '✅ Analysis complete';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            this.#isAnalyzing = false;
        }, 3000);
    }

    #renderBreachedList(items) {
        const section = document.getElementById('section-breached');
        const container = document.getElementById('list-breached');

        if (items.length > 0) {
            section.hidden = false;
            container.innerHTML = items.map(item => `
        <div class="issue-item danger">
          <div class="issue-icon">🚨</div>
          <div class="issue-info">
            <div class="issue-title">${escapeHtml(item.entry.title)}</div>
            <div class="issue-desc">Found in ${item.count.toLocaleString()} data breaches</div>
          </div>
          <button class="vault-btn vault-btn-sm vault-btn-danger" data-action="edit" data-id="${item.entry.id}">Change now!</button>
        </div>
      `).join('');
        } else {
            // Only show if we ran analysis
            // section.hidden = true; 
        }
    }

    #attachEvents() {
        document.getElementById('btn-analyze-breaches')?.addEventListener('click', () => this.#analyzeBreaches());

        // Delegation for edit buttons
        this.#container.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="edit"]');
            if (btn) {
                const id = btn.dataset.id;
                // Trigger generic event that VaultUI listens to
                this.#container.dispatchEvent(new CustomEvent('edit-entry', { detail: { id }, bubbles: true }));
            }
        });
    }
}
