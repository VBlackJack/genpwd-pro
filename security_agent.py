"""
----------------------------------------------------------------------------
 GenPwd Pro - Automated Security Audit Agent ("The Hacker")
----------------------------------------------------------------------------
 Copyright 2025 Julien Bombled

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
----------------------------------------------------------------------------

 DESCRIPTION:
 This agent performs a static analysis (SAST) on the GenPwd Pro codebase.
 It simulates the reconnaissance phase of an experienced hacker by looking 
 for common misconfigurations in Electron and Android environments.

 TARGETS:
 1. Android Manifest configurations (Exported activities, Backup, Debuggable).
 2. Electron Security (NodeIntegration, ContextIsolation, RemoteModule).
 3. Cryptography usage (Weak RNGs, Hardcoded keys).
 4. Dependency vulnerabilities (Basic check).

 USAGE:
 python3 security_agent.py
----------------------------------------------------------------------------
"""

import os
import re
import sys
import json
from pathlib import Path

class BColors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

class SecurityIssue:
    def __init__(self, severity, category, file_path, line_num, message):
        self.severity = severity  # HIGH, MEDIUM, LOW
        self.category = category
        self.file_path = file_path
        self.line_num = line_num
        self.message = message

class GenPwdAuditor:
    def __init__(self, root_path):
        self.root_path = Path(root_path)
        self.issues = []
        self.scanned_files = 0

    def log(self, message, color=BColors.OKBLUE):
        print(f"{color}{message}{BColors.ENDC}")

    def add_issue(self, severity, category, file_path, line_num, message):
        self.issues.append(SecurityIssue(severity, category, file_path, line_num, message))
        color = BColors.FAIL if severity == "HIGH" else (BColors.WARNING if severity == "MEDIUM" else BColors.OKCYAN)
        print(f"  [{color}{severity}{BColors.ENDC}] {category}: {message}")
        print(f"    -> File: {file_path}:{line_num}")

    def run_audit(self):
        self.log(f"\n[*] Starting Security Audit on: {self.root_path.absolute()}")
        self.log(f"[*] Target: GenPwd Pro (Electron + Android)\n")

        # 1. Audit Android Security
        self.audit_android_manifest()
        self.audit_android_code()

        # 2. Audit Electron Security
        self.audit_electron_main()
        self.audit_js_source()

        # 3. Generic Secrets Scan
        self.scan_for_secrets()

        self.print_report()

    def audit_android_manifest(self):
        self.log("[*] Auditing Android Manifest...")
        manifest_path = self.root_path / "android/app/src/main/AndroidManifest.xml"
        
        if not manifest_path.exists():
            self.log(f"[!] Manifest not found at {manifest_path}", BColors.WARNING)
            return

        with open(manifest_path, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')

        # Check: android:allowBackup
        if 'android:allowBackup="true"' in content:
            self.add_issue("HIGH", "Android Security", "AndroidManifest.xml", 0, 
                           "Backup is enabled (android:allowBackup='true'). Vault data could be extracted via ADB.")
        
        # Check: android:debuggable
        if 'android:debuggable="true"' in content:
            self.add_issue("CRITICAL", "Android Security", "AndroidManifest.xml", 0, 
                           "App is debuggable. Attackers can hook into the process easily.")

        # Check: Exported Activities without permissions
        # Simple regex to find exported activities
        exported_regex = re.compile(r'<activity[^>]*android:exported="true"[^>]*>')

        # List of known safe exported components (with proper intent filters or permissions)
        safe_exported = [
            "MainActivity",           # Main launcher activity
            "OAuthCallbackActivity",  # OAuth callback with deep link intent filter
            "OtpImportActivity",      # OTP import with otpauth:// intent filter
            "PasswordWidget",         # Widget with custom permission WIDGET_INTERNAL
            "GenPwdAutofillService",  # Autofill service with BIND_AUTOFILL_SERVICE permission
        ]

        # Track if we're inside a comment block
        in_comment = False
        for i, line in enumerate(lines):
            # Track XML comment blocks
            if '<!--' in line:
                in_comment = True
            if '-->' in line:
                in_comment = False
                continue  # Skip the closing comment line too

            # Skip lines inside comments
            if in_comment:
                continue

            if 'android:exported="true"' in line:
                # Check if this is a known safe exported component
                # Look in current line and previous lines (component name may be on different line)
                context = line + (lines[i-1] if i > 0 else "") + (lines[i-2] if i > 1 else "")
                is_safe = any(safe_name in context for safe_name in safe_exported)
                if not is_safe:
                    self.add_issue("MEDIUM", "Android Security", "AndroidManifest.xml", i+1,
                                   "Component is exported. Ensure it is protected by permissions or Intent filters are safe.")

    def audit_android_code(self):
        self.log("[*] Auditing Android Source Code (Kotlin)...")
        # Recursive scan for Kotlin files
        for kt_file in self.root_path.rglob("*.kt"):
            self.scanned_files += 1
            with open(kt_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    # Check: Logging Sensitive Info
                    # Skip SafeLog/SecureLogger calls - they are already protected by BuildConfig.DEBUG
                    if ("Log.d(" in line or "Log.e(" in line or "Log.i(" in line or "Log.w(" in line):
                        # Exclude SafeLog and SecureLogger which are production-safe wrappers
                        if "SafeLog." not in line and "SecureLogger." not in line:
                            if "password" in line.lower() or "token" in line.lower() or "key" in line.lower():
                                self.add_issue("MEDIUM", "Data Leakage", kt_file.name, i+1,
                                               "Potential logging of sensitive data (password/token).")
                    
                    # Check: Weak Random
                    if "java.util.Random" in line:
                        self.add_issue("LOW", "Cryptography", kt_file.name, i+1, 
                                       "Usage of insecure RNG (java.util.Random). Use SecureRandom instead.")

    def audit_electron_main(self):
        self.log("[*] Auditing Electron Configuration...")
        main_files = ["electron-main.cjs", "main.js", "src/electron-main.js"]
        found = False
        
        for main_file in main_files:
            path = self.root_path / main_file
            if path.exists():
                found = True
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Check: Node Integration
                if "nodeIntegration: true" in content:
                    self.add_issue("CRITICAL", "Electron Security", main_file, 0, 
                                   "nodeIntegration is enabled. RCE risk if XSS occurs.")
                
                # Check: Context Isolation
                if "contextIsolation: false" in content:
                    self.add_issue("HIGH", "Electron Security", main_file, 0, 
                                   "contextIsolation is disabled. Preload scripts can be manipulated.")
                
                # Check: Remote Module
                if "enableRemoteModule: true" in content:
                    self.add_issue("HIGH", "Electron Security", main_file, 0, 
                                   "Remote module enabled. This is deprecated and insecure.")
        
        if not found:
            self.log("[!] Electron main entry point not found.", BColors.WARNING)

    def audit_js_source(self):
        self.log("[*] Auditing JavaScript Sources...")
        for js_file in self.root_path.rglob("*.js"):
            if "node_modules" in str(js_file): continue
            self.scanned_files += 1
            
            with open(js_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    # Check: Dangerous functions
                    if "eval(" in line:
                        self.add_issue("HIGH", "Code Execution", js_file.name, i+1, 
                                       "Usage of eval() detected. High risk of XSS -> RCE.")
                    
                    # Check: Weak Random in JS
                    if "Math.random()" in line and "crypto" not in str(js_file):
                        # Filter out test files or UI effects, focus on logic
                        if "generator" in str(js_file) or "vault" in str(js_file):
                            self.add_issue("MEDIUM", "Cryptography", js_file.name, i+1, 
                                           "Math.random() used in security context. Use window.crypto.getRandomValues().")

    def scan_for_secrets(self):
        self.log("[*] Scanning for Hardcoded Secrets...")
        # Regex for common keys (Google API, AWS, Generic)
        secret_patterns = {
            "Google API Key": r"AIza[0-9A-Za-z-_]{35}",
            "Generic Token": r"(?i)(api_key|access_token|secret_key)\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}['\"]"
        }

        extensions = {".js", ".kt", ".xml", ".json", ".gradle", ".properties"}
        
        for file_path in self.root_path.rglob("*"):
            if file_path.is_file() and file_path.suffix in extensions:
                if "node_modules" in str(file_path) or ".git" in str(file_path): continue
                
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        for name, pattern in secret_patterns.items():
                            if re.search(pattern, content):
                                self.add_issue("HIGH", "Hardcoded Secret", file_path.name, 0, 
                                               f"Possible {name} found.")
                except Exception:
                    pass

    def print_report(self):
        print(f"\n{BColors.HEADER}=================================================={BColors.ENDC}")
        print(f"{BColors.HEADER}   GENPWD PRO - SECURITY AUDIT REPORT   {BColors.ENDC}")
        print(f"{BColors.HEADER}=================================================={BColors.ENDC}")
        
        high_sev = len([x for x in self.issues if x.severity in ["HIGH", "CRITICAL"]])
        med_sev = len([x for x in self.issues if x.severity == "MEDIUM"])
        
        print(f"Files Scanned: {self.scanned_files}")
        print(f"Total Issues : {len(self.issues)}")
        print(f"Critical/High: {high_sev}")
        print(f"Medium       : {med_sev}")
        
        if high_sev == 0 and med_sev == 0:
            print(f"\n{BColors.OKGREEN}[+] No obvious vulnerabilities found. Good job!{BColors.ENDC}")
            print(f"{BColors.OKBLUE}[*] Remember: This tool only checks for static patterns.{BColors.ENDC}")
        else:
            print(f"\n{BColors.FAIL}[!] Vulnerabilities detected! Please review the logs above.{BColors.ENDC}")

if __name__ == "__main__":
    # Assuming script is run from project root
    auditor = GenPwdAuditor(".")
    auditor.run_audit()