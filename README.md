# Mansion

Mansion is a highly secured end-to-end encrypted messaging application built with a microservices architecture.

## Key Features

- **End-to-End Encryption (E2EE)** - Messages are encrypted on the sender's device and decrypted only on the recipient's device
- **No Message Storage** - All messages are stored locally on devices (SQLite), never on servers
- **Anonymous User Tags** - Users identified by modifiable tags (format: `AAAAAAA#BBB`)
- **Minimal Data Collection** - Only email and password required for registration
- **Optional 2FA** - TOTP-based two-factor authentication
- **Real-time Messaging** - WebSocket-based instant message delivery

## Architecture

Mansion uses a microservices architecture with the following services:

- **API Gateway** (Port 3000) - Routes requests and provides OpenAPI documentation
- **Auth Service** (Port 3001) - Handles authentication, JWT tokens, and 2FA
- **User Service** (Port 3002) - Manages user profiles, tags, and contacts
- **Message Service** (Port 3003) - WebSocket server for real-time message routing
- **Notification Service** (Port 3004) - Handles push notifications

### Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Message Queue**: RabbitMQ
- **Real-time**: Socket.IO (WebSocket)
- **Frontend**: Flutter (mobile app) - To be implemented
- **Monorepo**: npm workspaces with shared `@mansion/common` package

### Shared Package

Le projet utilise un package partagé `@mansion/common` qui contient :
- Configurations (Database, Redis, RabbitMQ)
- Middlewares (Auth, Validation, Error handling)
- Utilitaires (JWT, Logger)
- Types TypeScript partagés
- Classe de base `ServiceBase` pour créer rapidement des microservices

Voir [WORKSPACE_SETUP.md](docs/WORKSPACE_SETUP.md) pour plus de détails.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)

### Quick Start (Développement Local - Recommandé)

1. Clone the repository:
```bash
git clone https://github.com/na2sime/Mansion.git
cd Mansion
```

2. Setup complet (installe dépendances + build @mansion/common):
```bash
npm run setup
```

3. Démarrer l'infrastructure (PostgreSQL, Redis, RabbitMQ):
```bash
npm run infra
```

4. Démarrer tous les services:
```bash
npm run dev
```

Les services seront disponibles :
- API Gateway: http://localhost:3000
- API Docs: http://localhost:3000/api-docs
- Auth Service: http://localhost:3001
- User Service: http://localhost:3002
- Message Service: http://localhost:3003
- Notification Service: http://localhost:3004

### Quick Start with Docker

```bash
docker-compose up
```

Cela démarre PostgreSQL, Redis, RabbitMQ et tous les microservices dans Docker.

### Local Development

To develop a specific service locally:

1. Start infrastructure services:
```bash
docker-compose up postgres redis rabbitmq
```

2. Navigate to the service directory:
```bash
cd services/auth  # or any other service
```

3. Install dependencies:
```bash
npm install
```

4. Copy environment variables:
```bash
cp .env.example .env
```

5. Run the service in development mode:
```bash
npm run dev
```

## Service Endpoints

- **API Gateway**: http://localhost:3000
  - API Docs: http://localhost:3000/api-docs
- **Auth Service**: http://localhost:3001
- **User Service**: http://localhost:3002
- **Message Service**: http://localhost:3003 (WebSocket)
- **Notification Service**: http://localhost:3004
- **RabbitMQ Management**: http://localhost:15672 (user: mansion, password: mansion_dev_password)

## User Tag System

Users are identified by unique tags following the format: `AAAAAAA#BBB`

- 8 alphanumeric characters before `#`
- Maximum 3 alphanumeric characters after `#`
- Tags are case-insensitive and normalized to uppercase
- Users can modify their tags
- Tags must be unique across the platform

## API Usage Example

### 1. Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'
```

### 3. Create User Profile

```bash
curl -X POST http://localhost:3000/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"publicKey": "<your_public_key>"}'
```

### 4. Connect to WebSocket

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3003', {
  auth: { token: '<your_jwt_token>' }
});

socket.on('connect', () => {
  console.log('Connected to message service');
});

socket.on('message:receive', (message) => {
  console.log('Received message:', message);
});
```

## Security Considerations

- All JWT secrets should be changed in production
- Use strong passwords for database and RabbitMQ
- Enable TLS/HTTPS for all services in production
- Implement rate limiting on the API Gateway
- Regularly rotate JWT secrets
- Implement proper CORS policies

## Development

### Building Services

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build auth-service
```

### Running Tests

```bash
cd services/<service-name>
npm test
```

### Linting

```bash
cd services/<service-name>
npm run lint
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC

## Author

ABDIOU Nassime

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/na2sime/Mansion/issues) page.
