# @mansion/common

Package partagé pour tous les microservices Mansion contenant des utilitaires, configurations et middlewares communs.

## Installation

Dans un service :

```bash
npm install ../../packages/common
```

Ou via workspaces (recommandé - voir ci-dessous).

## Contenu

### Configuration

#### DatabaseConnection
Gestion des connexions PostgreSQL avec pool de connexions.

```typescript
import { DatabaseConnection } from '@mansion/common';

const db = new DatabaseConnection({
  host: 'localhost',
  port: 5432,
  database: 'my_db',
  user: 'user',
  password: 'password'
});

await db.testConnection();
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

#### RedisConnection
Gestion des connexions Redis avec méthodes helper.

```typescript
import { RedisConnection } from '@mansion/common';

const redis = new RedisConnection({ host: 'localhost', port: 6379 });
await redis.connect();

await redis.set('key', 'value', 3600); // TTL 1h
const value = await redis.get('key');
```

#### RabbitMQConnection
Gestion des connexions RabbitMQ pour messaging.

```typescript
import { RabbitMQConnection } from '@mansion/common';

const rabbitmq = new RabbitMQConnection({ url: 'amqp://localhost' });
await rabbitmq.connect();

await rabbitmq.assertQueue('my_queue');
await rabbitmq.publishToQueue('my_queue', { data: 'message' });
```

### Utilitaires

#### JWTService
Service de gestion des tokens JWT.

```typescript
import { JWTService } from '@mansion/common';

const jwtService = new JWTService({
  secret: 'your_secret',
  expiresIn: '15m'
});

const token = jwtService.generateAccessToken({ userId: '123', email: 'user@example.com' });
const payload = jwtService.verifyAccessToken(token);
```

#### Logger
Logger structuré pour tous les services.

```typescript
import { Logger, LogLevel } from '@mansion/common';

const logger = new Logger({ serviceName: 'auth-service', level: LogLevel.INFO });

logger.info('User logged in', { userId: '123' });
logger.error('Failed to connect', { error: err.message });
```

### Middleware

#### AuthMiddleware
Middleware d'authentification JWT.

```typescript
import { AuthMiddleware, JWTService } from '@mansion/common';

const jwtService = new JWTService();
const authMiddleware = new AuthMiddleware(jwtService);

router.get('/protected', authMiddleware.authenticate, (req, res) => {
  const userId = req.user?.userId;
  res.json({ userId });
});
```

#### Validation
Middlewares de validation avec Joi.

```typescript
import { validateRequest } from '@mansion/common';
import Joi from 'joi';

const schema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

router.post('/register', validateRequest(schema), handler);
```

#### Error Handler
Gestionnaire d'erreurs global.

```typescript
import { errorHandler, AppError } from '@mansion/common';

// Dans vos routes
throw new AppError('User not found', 404);

// À la fin de votre app
app.use(errorHandler(logger));
```

### ServiceBase

Classe de base pour créer rapidement un microservice.

```typescript
import { ServiceBase, ServiceConfig } from '@mansion/common';

class AuthService extends ServiceBase {
  constructor() {
    super({
      serviceName: 'auth-service',
      port: 3001,
      useDatabase: true,
      useRedis: true,
      useRabbitMQ: false
    });
  }

  protected setupRoutes(): void {
    this.app.use('/api/auth', authRoutes);
  }

  protected async onReady(): Promise<void> {
    this.logger.info('Auth service is ready!');
  }
}

const service = new AuthService();
service.start();
```

## Types

Tous les types partagés sont disponibles :

```typescript
import type {
  User,
  UserProfile,
  EncryptedMessage,
  Contact,
  ApiResponse
} from '@mansion/common';
```

## Développement

### Build

```bash
cd packages/common
npm run build
```

### Watch mode

```bash
npm run dev
```

## Utilisation avec npm workspaces

Pour utiliser ce package avec npm workspaces, ajoutez dans le `package.json` racine :

```json
{
  "workspaces": [
    "packages/*",
    "services/*"
  ]
}
```

Puis dans chaque service :

```json
{
  "dependencies": {
    "@mansion/common": "workspace:*"
  }
}
```
