/*
 * Copyright 2026 Julien Bombled
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

// Synchronous theme detection before first paint (anti-FOUC)
// Must run BEFORE CSS loads to set [data-theme] on <html>
(function() {
  try {
    var mode = localStorage.getItem('genpwd-theme-mode');
    var theme = localStorage.getItem('genpwd-theme');
    if (mode === 'manual' && theme) {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      var mq = window.matchMedia;
      if (mq && mq('(prefers-contrast: high)').matches) {
        document.documentElement.setAttribute('data-theme', 'high-contrast');
      } else if (mq && mq('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
