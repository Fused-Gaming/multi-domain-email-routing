#!/usr/bin/env node

/**
 * Setup Script
 * 
 * Helps initialize the multi-domain email handler configuration
 */

import { readFile, writeFile, copyFile, access, mkdir } from 'fs/promises';
import { constants } from 'fs';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => {
  rl.question(prompt, resolve);
});

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n🚀 Multi-Domain Email Handler Setup\n');
  console.log('This script will help you configure your email handler.\n');
  
  // Check if .env already exists
  const envPath = join(ROOT_DIR, '.env');
  const envExamplePath = join(ROOT_DIR, '.env.example');
  
  if (await fileExists(envPath)) {
    const overwrite = await question('.env already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Keeping existing .env file.');
    } else {
      await createEnvFile(envPath, envExamplePath);
    }
  } else {
    await createEnvFile(envPath, envExamplePath);
  }
  
  // Check if domains.json exists
  const domainsPath = join(ROOT_DIR, 'config', 'domains.json');
  const domainsExamplePath = join(ROOT_DIR, 'config', 'domains.example.json');
  
  if (await fileExists(domainsPath)) {
    const overwrite = await question('\nconfig/domains.json already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Keeping existing domains.json file.');
    } else {
      await createDomainsConfig(domainsPath, domainsExamplePath);
    }
  } else {
    await createDomainsConfig(domainsPath, domainsExamplePath);
  }
  
  // Create data directory
  const dataDir = join(ROOT_DIR, 'data');
  try {
    await mkdir(dataDir, { recursive: true });
    console.log('\n✅ Created data directory');
  } catch (e) {
    // Directory might already exist
  }
  
  // Ask about Cloudflare Workers
  console.log('\n--- Cloudflare Workers Setup (Optional) ---\n');
  const useCloudflare = await question('Will you be using Cloudflare Email Routing? (y/N): ');
  
  if (useCloudflare.toLowerCase() === 'y') {
    const wranglerPath = join(ROOT_DIR, 'wrangler.toml');
    const wranglerExamplePath = join(ROOT_DIR, 'wrangler.toml.example');
    
    if (!(await fileExists(wranglerPath))) {
      await copyFile(wranglerExamplePath, wranglerPath);
      console.log('✅ Created wrangler.toml from template');
    }
    
    console.log('\nTo complete Cloudflare setup:');
    console.log('1. Edit wrangler.toml with your account ID');
    console.log('2. Set secrets: wrangler secret put FORWARD_TO');
    console.log('3. Create KV namespace: wrangler kv:namespace create "EMAIL_KV"');
    console.log('4. Deploy: wrangler deploy');
  }
  
  console.log('\n✨ Setup complete!\n');
  console.log('Next steps:');
  console.log('1. Edit .env with your IMAP/SMTP credentials');
  console.log('2. Configure your domains in config/domains.json');
  console.log('3. Run: npm install');
  console.log('4. Start the handler: npm start');
  console.log('');
  
  rl.close();
}

async function createEnvFile(envPath, examplePath) {
  console.log('\n--- Email Server Configuration ---\n');
  
  const imapHost = await question('IMAP Host (e.g., imap.gmail.com): ');
  const imapPort = await question('IMAP Port (default: 993): ') || '993';
  const imapUser = await question('IMAP Username (email): ');
  const imapPass = await question('IMAP Password: ');
  
  const smtpHost = await question('\nSMTP Host (e.g., smtp.gmail.com): ');
  const smtpPort = await question('SMTP Port (default: 587): ') || '587';
  const smtpUser = await question('SMTP Username (email): ') || imapUser;
  const smtpPass = await question('SMTP Password: ') || imapPass;
  
  const personalEmail = await question('\nPersonal Email (forwarding destination): ');
  
  const serverPort = await question('\nWeb Server Port (default: 3000, leave empty to disable): ');
  
  let content = await readFile(examplePath, 'utf-8');
  
  content = content
    .replace('IMAP_HOST=imap.example.com', `IMAP_HOST=${imapHost}`)
    .replace('IMAP_PORT=993', `IMAP_PORT=${imapPort}`)
    .replace('IMAP_USER=your-catchall-account@example.com', `IMAP_USER=${imapUser}`)
    .replace('IMAP_PASSWORD=your-secure-password', `IMAP_PASSWORD=${imapPass}`)
    .replace('SMTP_HOST=smtp.example.com', `SMTP_HOST=${smtpHost}`)
    .replace('SMTP_PORT=587', `SMTP_PORT=${smtpPort}`)
    .replace('SMTP_USER=your-smtp-account@example.com', `SMTP_USER=${smtpUser}`)
    .replace('SMTP_PASSWORD=your-smtp-password', `SMTP_PASSWORD=${smtpPass}`)
    .replace('PERSONAL_EMAIL=your-real-email@gmail.com', `PERSONAL_EMAIL=${personalEmail}`)
    .replace('SERVER_PORT=3000', serverPort ? `SERVER_PORT=${serverPort}` : '#SERVER_PORT=3000');
  
  await writeFile(envPath, content);
  console.log('\n✅ Created .env file');
}

async function createDomainsConfig(domainsPath, examplePath) {
  console.log('\n--- Domain Configuration ---\n');
  
  const domains = [];
  let addMore = true;
  
  while (addMore) {
    const domain = await question('Enter a domain (e.g., example.com): ');
    if (domain) {
      const name = await question(`Company name for ${domain}: `);
      const primaryColor = await question('Primary color (e.g., #0066cc): ') || '#0066cc';
      const autoResponse = await question('Enable auto-responses? (Y/n): ');
      
      domains.push({
        domain,
        name,
        primaryColor,
        autoResponseEnabled: autoResponse.toLowerCase() !== 'n'
      });
    }
    
    const more = await question('\nAdd another domain? (y/N): ');
    addMore = more.toLowerCase() === 'y';
  }
  
  // Load example and modify
  const example = JSON.parse(await readFile(examplePath, 'utf-8'));
  
  // Clear example domains and add user's domains
  example.domains = {};
  
  for (const d of domains) {
    example.domains[d.domain] = {
      enabled: true,
      name: d.name,
      branding: {
        companyName: d.name,
        primaryColor: d.primaryColor,
        signature: `The ${d.name} Team`
      },
      autoResponse: {
        enabled: d.autoResponseEnabled,
        subject: 'Re: {{originalSubject}} [{{trackingNumber}}]',
        template: 'default'
      },
      forwardTo: null,
      rules: []
    };
  }
  
  await writeFile(domainsPath, JSON.stringify(example, null, 2));
  console.log('\n✅ Created config/domains.json');
}

main().catch(console.error);
