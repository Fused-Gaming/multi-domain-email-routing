# Multi-Domain Email Handler

A comprehensive solution for managing catch-all email routing across multiple domains with automatic tracking numbers, branded auto-responses, and loop prevention.

## Features

- 🌐 **Multi-Domain Support** - Handle 30+ domains with domain-specific configurations
- 🔢 **Tracking Numbers** - Automatic unique reference numbers for every email
- 📧 **Branded Auto-Responses** - Domain-specific templates with company branding
- 🔒 **Privacy Protection** - Your personal email is never exposed
- 🔄 **Loop Prevention** - Intelligent detection of auto-generated emails
- 📊 **Rate Limiting** - Prevent spam and abuse
- 🎯 **Rule-Based Routing** - Route emails based on content, subject, or recipient
- ☁️ **Cloudflare Workers Support** - Optional serverless deployment

## Quick Start

### Prerequisites

- Node.js 18+ 
- An email server with IMAP/SMTP access (or Cloudflare Email Routing)
- Domains with catch-all email configured

### Installation

```bash
# Clone or copy the project
cd multi-domain-email-handler

# Install dependencies
npm install

# Run interactive setup
npm run setup
```

### Configuration

1. **Copy example files:**
```bash
cp .env.example .env
cp config/domains.example.json config/domains.json
```

2. **Edit `.env`** with your email server credentials:
```env
IMAP_HOST=imap.yourmailserver.com
IMAP_PORT=993
IMAP_USER=catchall@yourdomain.com
IMAP_PASSWORD=your-password

SMTP_HOST=smtp.yourmailserver.com
SMTP_PORT=587
SMTP_USER=catchall@yourdomain.com
SMTP_PASSWORD=your-password

PERSONAL_EMAIL=your-real-email@gmail.com
```

3. **Configure domains** in `config/domains.json`:
```json
{
  "domains": {
    "example.com": {
      "enabled": true,
      "name": "Example Corp",
      "branding": {
        "companyName": "Example Corporation",
        "primaryColor": "#0066cc",
        "signature": "The Example Team"
      },
      "autoResponse": {
        "enabled": true,
        "template": "default"
      }
    }
  }
}
```

4. **Start the handler:**
```bash
npm start
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Incoming Email                               │
│                  (any@yourdomain.com)                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Email Processor                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │   Domain   │  │   Loop     │  │   Rate     │                │
│  │   Config   │  │ Prevention │  │  Limiting  │                │
│  │   Lookup   │  │            │  │            │                │
│  └────────────┘  └────────────┘  └────────────┘                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌───────────┐ ┌──────────────────┐
│  Generate       │ │  Forward  │ │  Send Branded    │
│  Tracking #     │ │  to Your  │ │  Auto-Response   │
│  TKT-ABC123     │ │  Inbox    │ │  (with tracking) │
└─────────────────┘ └───────────┘ └──────────────────┘
```

## Domain Configuration

### Basic Domain Setup

```json
{
  "example.com": {
    "enabled": true,
    "name": "Example Corp",
    "branding": {
      "companyName": "Example Corporation",
      "logo": "https://example.com/logo.png",
      "primaryColor": "#0066cc",
      "supportEmail": "support@example.com",
      "website": "https://example.com",
      "signature": "The Example Team"
    },
    "autoResponse": {
      "enabled": true,
      "subject": "Re: {{originalSubject}} [{{trackingNumber}}]",
      "template": "default",
      "businessHoursOnly": false
    }
  }
}
```

### Wildcard Domains

Match all subdomains with `*.domain.com`:

```json
{
  "*.mycompany.com": {
    "enabled": true,
    "name": "My Company (Subdomain)",
    "autoResponse": {
      "enabled": false
    }
  }
}
```

### Rules for Conditional Routing

```json
{
  "rules": [
    {
      "name": "Sales Inquiries",
      "match": {
        "toContains": ["sales", "pricing"],
        "subjectContains": ["quote", "pricing"]
      },
      "action": {
        "template": "sales",
        "priority": "high",
        "tags": ["sales", "lead"]
      }
    }
  ]
}
```

## Auto-Response Templates

### Built-in Templates

- **default** - Professional, generic response
- **sales** - Optimized for sales inquiries
- **support** - Support ticket acknowledgment
- **casual** - Friendly, informal response

### Custom Template Variables

| Variable | Description |
|----------|-------------|
| `{{trackingNumber}}` | Unique tracking reference |
| `{{originalSubject}}` | Original email subject |
| `{{senderName}}` | Extracted sender name |
| `{{senderEmail}}` | Sender email address |
| `{{companyName}}` | Your company name |
| `{{primaryColor}}` | Brand color |
| `{{signature}}` | Email signature |
| `{{website}}` | Company website |

## Loop Prevention

The system automatically detects and prevents email loops by:

1. **Header Detection** - Checks for auto-response headers:
   - `Auto-Submitted`
   - `X-Auto-Response-Suppress`
   - `Precedence: bulk/junk/list`
   - `X-Autoreply`

2. **Rate Limiting** - Limits auto-responses per sender per hour

3. **Deduplication** - Tracks processed Message-IDs

4. **Blocked Patterns** - Ignores noreply/mailer-daemon addresses

## API Endpoints

When the web server is enabled:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard UI |
| `/health` | GET | Health check |
| `/webhook/email` | POST | Generic email webhook |
| `/webhook/cloudflare` | POST | Cloudflare Email Workers format |
| `/api/track/:id` | GET | Lookup tracking number |
| `/api/stats` | GET | System statistics |
| `/api/emails` | GET | Recent emails list |

## Cloudflare Workers Deployment

For serverless deployment using Cloudflare Email Routing:

1. **Copy wrangler config:**
```bash
cp wrangler.toml.example wrangler.toml
```

2. **Set secrets:**
```bash
wrangler secret put FORWARD_TO
# Enter your personal email

wrangler secret put DOMAIN_CONFIG
# Paste your JSON configuration
```

3. **Create KV namespace:**
```bash
wrangler kv:namespace create "EMAIL_KV"
# Add the ID to wrangler.toml
```

4. **Deploy:**
```bash
wrangler deploy
```

5. **Configure Cloudflare:**
   - Go to your domain → Email → Email Routing
   - Set catch-all to "Send to Worker"
   - Select your deployed worker

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `IMAP_HOST` | Yes* | IMAP server hostname |
| `IMAP_PORT` | No | IMAP port (default: 993) |
| `IMAP_USER` | Yes* | IMAP username |
| `IMAP_PASSWORD` | Yes* | IMAP password |
| `SMTP_HOST` | Yes | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | Yes | SMTP username |
| `SMTP_PASSWORD` | Yes | SMTP password |
| `PERSONAL_EMAIL` | Yes | Your real email address |
| `DATABASE_PATH` | No | SQLite database path |
| `SERVER_PORT` | No | Web server port |
| `TRACKING_PREFIX` | No | Tracking number prefix (default: TKT) |
| `RATE_LIMIT_PER_HOUR` | No | Max emails per sender/hour (default: 10) |
| `LOG_LEVEL` | No | error/warn/info/debug |

*Required for IMAP listener mode

## Security Considerations

1. **Never commit `.env`** - It's in `.gitignore`
2. **Never commit `domains.json`** - Copy from example
3. **Use strong passwords** for email accounts
4. **Enable 2FA** where possible
5. **Use app-specific passwords** for Gmail/Microsoft

## Troubleshooting

### Emails not being received

1. Check IMAP credentials in `.env`
2. Verify catch-all is configured on your domain
3. Check logs: `LOG_LEVEL=debug npm start`

### Auto-responses not sending

1. Verify SMTP credentials
2. Check if sender is blocked or rate-limited
3. Ensure `autoResponse.enabled: true` in domain config
4. Check for loop prevention (auto-generated detection)

### Cloudflare Worker errors

1. Verify all secrets are set: `wrangler secret list`
2. Check KV namespace binding
3. View logs: `wrangler tail`

## License

MIT License - feel free to use and modify for your needs.

## Contributing

Contributions welcome! Please open an issue or PR.
