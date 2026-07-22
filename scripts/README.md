# Development Scripts

This directory contains scripts to improve the developer experience for the Gov-IE MessagingIE Services project.

## 📁 Directory Structure

```
scripts/
├── dev/                     # Development environment scripts
│   ├── setup.mjs           # Complete development setup
│   ├── health-check.mjs    # Health check all services
│   ├── pipeline-local.mjs  # Local pipeline runner
│   └── azure-pipeline-local.mjs # Azure pipeline parity runner
├── db/                      # Database management scripts
│   └── reset.mjs           # Database reset (optionally seeds via API app)
├── init-env.mjs             # .env init/update/sync utility
├── utils/                   # Utility scripts
└── README.md               # This file
```

## 🚀 Quick Start

### 1. Initial Setup (New Developer)

```bash
# Complete development environment setup
pnpm dev:setup

# This will:
# - Validate prerequisites (Node.js, pnpm, Docker, Git)
# - Initialize environment files
# - Install dependencies
# - Set up database
# - Validate setup
```

### 2. Health Check

```bash
# Check health of all services
pnpm dev:health

# This will check:
# - Database connectivity
# - API health endpoints
# - Frontend accessibility
# - MailDev status
# - Port availability
```

### 3. Database Management

```bash
# Reset database (with confirmation)
pnpm db:reset

# Reset database with test data
pnpm db:reset:seed

# Seed database with test data only (runs API app's seeder)
pnpm db:seed
```

## 📋 Available Scripts

### Environment Management Scripts

#### `env:init`
Initialize environment files from `.env.sample` files.

**Features:**
- ✅ Creates `.env` files from `.env.sample` templates
- ✅ Skips existing `.env` files (safe for existing setups)
- ✅ Processes all apps in the monorepo
- ✅ Preserves existing values when updating

**Usage:**
```bash
# Initialize missing .env files
pnpm env:init

# Update existing .env files (add missing keys, remove obsolete ones)
pnpm env:update

# Sync .env files with .env.sample (alias for update)
pnpm env:sync

# Preview changes without modifying files
pnpm env:dry-run
```

**What it does:**
1. **Adds missing keys** from `.env.sample` to `.env`
2. **Removes obsolete keys** that are no longer in `.env.sample`
3. **Preserves existing values** in `.env` files
4. **Handles comments and structure** properly
5. **Supports dry-run mode** for safe previewing

**Example:**
```bash
# If .env.sample has new keys FEATURE_FLAGS_URL and FEATURE_FLAGS_TOKEN
# but .env doesn't have them, they will be added with sample values

# If .env has OBSOLETE_KEY but .env.sample doesn't have it,
# OBSOLETE_KEY will be removed from .env
```

### Azure Pipeline Local Scripts

#### `pipeline:local`
Run Azure Pipeline steps locally.

**Features:**
- ✅ Security scans (lint, test)
- ✅ Build dependencies
- ✅ Unit tests (per service)
- ✅ Build services
- ✅ Docker builds
- ✅ Configurable execution (skip tests, skip Docker, continue on errors)

**Usage:**
```bash
# Run full pipeline
pnpm pipeline:local

# Skip tests and Docker builds
pnpm pipeline:local --skip-tests --skip-docker

# Continue on errors
pnpm pipeline:local --continue

# Skip specific steps
pnpm pipeline:local --skip-tests --skip-docker --continue
```

#### `azure:local`
Advanced Azure Pipeline local runner with multiple options.

**Features:**
- ✅ Pipeline analysis and documentation
- ✅ Azure Pipelines Agent setup guidance
- ✅ GitHub Actions workflow generation
- ✅ Manual pipeline step execution

**Usage:**
```bash
# Analyze pipeline structure
pnpm azure:local --analyze

# Setup Azure Pipelines Agent (guidance)
pnpm azure:local --setup-agent

# Create GitHub Actions workflow
pnpm azure:local --github

# Run pipeline steps manually
pnpm azure:local --manual
```

### Development Environment Scripts

#### `dev:setup`
Complete development environment setup for new developers.

**Features:**
- ✅ Validates prerequisites (Node.js 22+, pnpm, Docker, Git)
- ✅ Initializes environment files
- ✅ Installs dependencies
- ✅ **Smart PostgreSQL detection** - uses existing instances or starts Docker containers
- ✅ Sets up database (create, migrate, sync)
- ✅ Validates setup
- ✅ Provides next steps

**Usage:**
```bash
pnpm dev:setup
```

**PostgreSQL Detection Logic:**
1. Checks if PostgreSQL is already running on the configured port
2. If running → uses existing instance
3. If not running → starts Docker containers
4. Handles port conflicts gracefully

#### `dev:health`
Comprehensive health check of all development services.

**Features:**
- ✅ Database connectivity check (with host/port info)
- ✅ API health endpoint check
- ✅ Frontend accessibility check (handles 307 redirects)
- ✅ MailDev status check
- ✅ Port availability check
- ✅ Detailed status report

**Usage:**
```bash
pnpm dev:health
```

#### `dev:reset`
Reset the entire development environment.

**Features:**
- ✅ Cleans build artifacts
- ✅ Re-runs complete setup
- ✅ Useful for troubleshooting

**Usage:**
```bash
pnpm dev:reset
```

### Database Management Scripts

#### `db:reset`
Safely reset the database with confirmation.

**Features:**
- ✅ Confirms destructive operation
- ✅ Drops existing database
- ✅ Creates new database
- ✅ Runs all migrations
- ✅ Syncs event summaries
- ✅ Optional seeding

**Usage:**
```bash
# Interactive confirmation
pnpm db:reset

# Force reset (no confirmation)
pnpm db:reset --force

# Reset with test data
pnpm db:reset --seed
```

#### `db:seed`
Seed database with realistic test data.

**Features:**
- ✅ Creates test providers (email & SMS)
- ✅ Creates test message templates
- ✅ **Note**: Users are created via Logto callbacks and are not seeded
- ✅ **Note**: Messages require valid user IDs and are not seeded
- ✅ Provides seeding summary

**Usage:**
```bash
pnpm db:seed
```

#### `db:reset:seed`
Combines database reset with seeding.

**Usage:**
```bash
pnpm db:reset:seed
```

### Utility Scripts



## 🔧 Service Ports

| Service | Default Port | Environment Variable | Description |
|---------|-------------|---------------------|-------------|
| Frontend | 3002 | `FRONTEND_PORT` | Next.js development server |
| API | 8002 | `API_PORT` | Fastify API server |
| Database | 5432 | `POSTGRES_PORT` | PostgreSQL database (uses existing if available) |
| MailDev | 1080 | `MAILDEV_PORT` | Email testing interface |

## 🎯 Test Data

When using `db:seed` or `db:reset:seed`, the following test data is created:

### Providers
- Test Email Provider (configurable via `MAILDEV_HOST` and `MAILDEV_PORT`)
- Test SMS Provider (configurable via `SMS_API_KEY` and `SMS_ENDPOINT`)

### Templates
- Welcome Message (email)
- Notification Message (email)
- SMS Notification (SMS)

### Notes
- **Users**: Not seeded - created via Logto callbacks during authentication
- **Messages**: Not seeded - require valid user IDs from authentication
- **Events**: Not seeded - require valid message IDs

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Start database services
pnpm db:up

# Check database health
pnpm dev:health
```

#### Port Already in Use
```bash
# Check what's using the port
lsof -i :3002  # Frontend
lsof -i :8002  # API
lsof -i :5432  # Database

# Kill process if needed
kill -9 <PID>
```

#### Environment Files Missing
```bash
# Initialize environment files
pnpm env:init

# Or run complete setup
pnpm dev:setup
```

### Reset Everything
```bash
# Complete reset
pnpm dev:reset

# Or manual reset
pnpm clean
rm -rf node_modules
pnpm install
pnpm db:reset
pnpm dev:setup
```

## 🔧 Environment Variables

The scripts use environment variables from your `.env` files with sensible defaults:

### Database Configuration
Read from `apps/messaging-api/.env` and root `.env`:
- `POSTGRES_HOST` - Database host (default: localhost)
- `POSTGRES_PORT` - Database port (default: 5432)
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password (default: postgres)
- `POSTGRES_DB_NAME` - Database name (default: messaging)

### Service Ports
- `API_PORT` - API service port (default: 8002)
- `FRONTEND_PORT` - Frontend service port (default: 3002)
- `MAILDEV_PORT` - MailDev service port (default: 1080)

### Provider Configuration
- `MAILDEV_HOST` - MailDev host (default: localhost)
- `SMS_API_KEY` - SMS provider API key (default: test-api-key)
- `SMS_ENDPOINT` - SMS provider endpoint (default: https://api.test-sms.com)

## 📝 Script Development

### Adding New Scripts

1. Create the script in the appropriate directory
2. Add to package.json scripts using `node scripts/path/to/script.mjs`
3. Update this README

### Script Guidelines

- Use ES modules (`import/export`)
- Include proper error handling
- Add logging with timestamps
- Use descriptive variable names
- Include JSDoc comments
- Handle cleanup in finally blocks
- **Use environment variables** for configuration
- **Provide sensible defaults** for all environment variables

### Example Script Structure

```javascript
import { execSync } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

/**
 * Script Description
 * 
 * What this script does and why
 */

class ScriptName {
  constructor() {
    this.rootDir = join(__dirname, '..', '..');
  }

  log(message, type = 'info') {
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type];
    
    console.log(`${prefix} [${new Date().toISOString()}] ${message}`);
  }

  async run() {
    try {
      // Script logic here
      this.log('Script completed successfully', 'success');
    } catch (error) {
      this.log(`Script failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run the script
const script = new ScriptName();
script.run().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
```

## 🤝 Contributing

When adding new scripts:

1. Follow the existing patterns
2. Add comprehensive error handling
3. Include helpful logging
4. Update this README
5. Test thoroughly
6. Consider backward compatibility

## 📚 Related Documentation

- [Project README](../README.md)
- [API Documentation](../apps/messaging-api/README.md)
- [Frontend Documentation](../apps/messaging-next/README.md)
- [Database Migrations](../apps/messaging-api/src/migrations/)
