# Gov-IE MessagingIE Services

A comprehensive messaging platform for government services, built with modern web technologies and following best practices for security, scalability, and developer experience.

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- pnpm
- Docker (optional, for local development)
- Git

### Development Setup

1. **Clone the repository**

2. **Complete development setup**
   ```bash
   pnpm dev:setup
   ```
   This will:
   - Validate prerequisites
   - Initialize environment files
   - Install dependencies
   - Set up database (detects existing PostgreSQL or starts Docker containers)
   - Run migrations and sync event summaries

3. **Check service health**
   ```bash
   pnpm dev:health
   ```

4. **Start development servers**
   ```bash
   pnpm dev
   ```

## 📁 Project Structure

```
govie-services-messaging/
├── apps/
│   ├── messaging/           # Next.js frontend application
│   └── messaging-api/       # Fastify API server
├── packages/                # Shared packages
└── scripts/                 # Developer experience scripts
```

## 🛠️ Development Scripts

For comprehensive information about all available scripts, see **[Scripts Documentation](./scripts/README.md)**.

Key scripts include:
- `pnpm dev:setup` - Complete development environment setup
- `pnpm dev:health` - Health check all services
- `pnpm env:update` - Sync environment files with templates
- `pnpm pipeline:local` - Run Azure Pipeline steps locally
- `pnpm db:reset` - Database management
- `pnpm db:seed` - Database seeding

## 🔧 Services

| Service | Default Port | Description |
|---------|-------------|-------------|
| Frontend | 3002 | Next.js development server |
| API | 8002 | Fastify API server |
| Database | 5432 | PostgreSQL database (via Docker Compose env) |
| MailDev | 1080 | Email testing interface |

Default ports are shown above. Database and MailDev ports are configurable via environment variables; app ports are set in their respective dev/start commands.

## 📚 Documentation

- **[Scripts Documentation](./scripts/README.md)** - Developer experience scripts and utilities
- **[API Documentation](./apps/messaging-api/README.md)** - Backend API documentation
- **[Frontend Documentation](./apps/messaging/README.md)** - Frontend application documentation

## 🔧 Environment Configuration

The project uses environment variables for configuration. For detailed information about all environment variables and their defaults, see **[Scripts Documentation](./scripts/README.md)**.

Environment files are automatically initialized during setup.

## 🚨 Troubleshooting

For comprehensive troubleshooting information, see **[Scripts Documentation](./scripts/README.md)**.

Common solutions:
- `pnpm dev:health` - Check service health
- `pnpm db:reset` - Reset database
- `pnpm dev:reset` - Complete environment reset

## 🤝 Contributing

1. Follow the existing code patterns
2. Use the provided development scripts
3. Ensure all tests pass
4. Update documentation as needed

## 📄 License

[MIT](./LICENSE)
