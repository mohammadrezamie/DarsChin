const fs = require('fs');
const path = require('path');

const typesPath = path.join(process.cwd(), 'src/types/index.ts');
let content = fs.readFileSync(typesPath, 'utf-8');

const userInterface = `export interface User {
  id: string;
  mobile: string;
  name: string;
  password?: string;
  recoveryKey?: string;
  roles: UserRole[];
  permissions?: string[];
  createdBy?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  createdAt: string;
}

export interface OtpChallenge {
  id: string;
  mobile: string;
  purpose: 'login' | 'registration' | 'password_recovery' | 'admin_auth';
  hashedOtp: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  consumedAt?: number;
  provider?: string;
  providerMessageId?: string;
}

export interface CaptchaChallenge {
  id: string;
  value: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  consumedAt?: number;
}`;

content = content.replace(/export interface User \{[\s\S]*?createdAt: string;\n\}/, userInterface);

fs.writeFileSync(typesPath, content, 'utf-8');
console.log('Fixed User interface in types');
