# Rol Prompt Consumer - JAPM

## Descripción General

El rol `prompt_consumer` es un rol especializado y altamente restrictivo diseñado para permitir el consumo externo de prompts sin acceso a ninguna otra funcionalidad del sistema JAPM.

## Propósito

Este rol fue creado para resolver el caso de uso específico donde se necesita:
- Permitir que sistemas externos consuman prompts de manera segura
- Evitar exposición de funcionalidades administrativas o de gestión
- Proporcionar acceso solo a los endpoints de ejecución de prompts
- Mantener auditoría de quién consume los prompts

## Funcionalidades Permitidas

Los usuarios con rol `prompt_consumer` **SOLAMENTE** pueden acceder a:

### Endpoints de Serve Prompt
- `POST /serve-prompt/execute/:projectId/:promptName/:versionTag/base`
- `POST /serve-prompt/execute/:projectId/:promptName/:versionTag/lang/:languageCode`

### Ejemplos de Uso

```http
# Ejecutar prompt en idioma base
POST /serve-prompt/execute/my-project/welcome-prompt/latest/base
Authorization: Bearer {token_prompt_consumer}
Content-Type: application/json

{
  "variables": {
    "customerName": "Juan Pérez",
    "productName": "Widget Pro"
  }
}
```

```http
# Ejecutar prompt en español
POST /serve-prompt/execute/my-project/welcome-prompt/v1.2.0/lang/es-ES
Authorization: Bearer {token_prompt_consumer}
Content-Type: application/json

{
  "variables": {
    "customerName": "María García",
    "productName": "Widget Pro"
  }
}
```

## Funcionalidades Prohibidas

Los usuarios con rol `prompt_consumer` **NO** pueden acceder a:

### Endpoints Administrativos (Requieren roles admin/tenant_admin)
- ✗ **Gestión de Usuarios** (`/users/*`) - Crear, listar, editar, eliminar usuarios
- ✗ **Gestión de Tenants** (`/tenants/*`) - Administración de tenants (solo admin)
- ✗ **Gestión de Proyectos** (`/projects/*`) - Crear, editar, eliminar proyectos
- ✗ **Administración de Prompts** (`/projects/*/prompts/*`) - CRUD de prompts
- ✗ **Gestión de Versiones** (`/projects/*/prompts/*/versions/*`) - Versionado
- ✗ **Administración de Assets** (`/projects/*/assets/*`) - Gestión de assets
- ✗ **Configuración de AI Models** (`/projects/*/aimodels/*`) - Modelos de AI
- ✗ **Gestión de Environments** (`/projects/*/environments/*`) - Configuraciones
- ✗ **Administración de Tags** (`/projects/*/tags/*`) - Sistema de etiquetas
- ✗ **Funcionalidades de Marketplace** (`/marketplace/*`) - Publicación y gestión
- ✗ **Sistema de Backup** (`/projects/*/prompts/*/backup`) - Backups de prompts
- ✗ **Cultural Data** (`/projects/*/cultural-data/*`) - Datos culturales
- ✗ **RAG Documents** (`/projects/*/rag-documents/*`) - Documentos RAG

### Principio de Seguridad
**ACCESO EXCLUSIVO**: Solo endpoints `/serve-prompt/*` están disponibles para este rol.

## Configuración

### Usuario de Ejemplo
Se incluye un usuario de ejemplo en el seed:

```
Email: prompt-consumer@example.com
Password: password123
Role: prompt_consumer
```

### Autenticación
Los usuarios con este rol deben autenticarse normalmente usando JWT:

```http
POST /auth/login
Content-Type: application/json

{
  "email": "prompt-consumer@example.com",
  "password": "password123"
}
```

El token JWT devuelto debe usarse en el header `Authorization: Bearer {token}` para todas las requests.

## Seguridad

### Guards Implementados
- `JwtAuthGuard`: Verifica autenticación JWT válida
- `PromptConsumerGuard`: En `/serve-prompt/` - Verifica que el usuario tenga rol `prompt_consumer`
- `RolesGuard`: En otros endpoints - Verifica roles administrativos requeridos
- `ProjectGuard`: Verifica acceso al proyecto específico cuando aplica

### Auditoría
Todas las llamadas de usuarios `prompt_consumer` son auditadas con:
- Usuario que realizó la llamada
- Proyecto y prompt accedido
- Variables proporcionadas
- Timestamp de ejecución
- Resultado de la operación

### Limitaciones Adicionales
1. **Solo Lectura**: No pueden modificar ningún dato
2. **Acceso Específico**: Solo a endpoints de ejecución
3. **Sin Navegación**: No pueden explorar o listar recursos
4. **Sin Metadatos**: Acceso limitado a información estructural

## Casos de Uso

### 1. Integración de Sistemas Externos
```javascript
// Sistema externo consumiendo prompts
const response = await fetch('/serve-prompt/execute/ecommerce/product-description/latest/base', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${promptConsumerToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    variables: {
      productName: 'Smartphone X',
      features: ['5G', 'Triple Camera', '256GB'],
      price: '$699'
    }
  })
});
```

### 2. API Gateway Integration
```yaml
# Kong/NGINX configuración
upstream japm_prompts {
  server japm.internal:3000;
}

location /external-prompts/ {
  proxy_pass http://japm_prompts/serve-prompt/;
  proxy_set_header Authorization "Bearer ${PROMPT_CONSUMER_TOKEN}";
}
```

### 3. Microservicio Especializado
```python
# Microservicio Python
import requests

class PromptConsumer:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def execute_prompt(self, project_id, prompt_name, version, variables, language=None):
        endpoint = f"execute/{project_id}/{prompt_name}/{version}"
        if language:
            endpoint += f"/lang/{language}"
        else:
            endpoint += "/base"
            
        response = requests.post(
            f"{self.base_url}/serve-prompt/{endpoint}",
            headers=self.headers,
            json={"variables": variables}
        )
        return response.json()
```

## Implementación Técnica

### Enum Role
```typescript
export enum Role {
  ADMIN = 'admin',
  TENANT_ADMIN = 'tenant_admin', 
  USER = 'user',
  PROMPT_CONSUMER = 'prompt_consumer', // ← Nuevo rol
}
```

### Schema Prisma
```prisma
enum Role {
  user
  admin
  tenant_admin
  prompt_consumer  // ← Nuevo rol
}
```

### Guard Específico
```typescript
@Injectable()
export class PromptConsumerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return user.role === Role.PROMPT_CONSUMER;
  }
}
```

### Aplicación en Controller
```typescript
@Controller('serve-prompt')
@UseGuards(JwtAuthGuard, PromptConsumerGuard) // ← Guards aplicados
export class ServePromptController {
  // Solo métodos de ejecución de prompts
}
```

## Monitoreo y Métricas

### Logs de Acceso
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "user": "prompt-consumer@example.com",
  "role": "prompt_consumer",
  "operation": "execute_prompt",
  "project": "ecommerce",
  "prompt": "product-description",
  "version": "v1.2.0",
  "language": "es-ES",
  "success": true,
  "duration_ms": 150
}
```

### Métricas Recomendadas
- Número de ejecuciones por usuario `prompt_consumer`
- Prompts más utilizados por consumidores externos
- Latencia promedio de ejecución
- Errores y fallos de autenticación
- Uso por proyecto y tenant

## Consideraciones de Producción

### Rotación de Tokens
- Implementar rotación periódica de tokens JWT
- Considerar tokens de larga duración para sistemas automatizados
- Configurar expiración apropiada según el caso de uso

### Rate Limiting
- Aplicar rate limiting específico para usuarios `prompt_consumer`
- Monitorear uso abusivo
- Implementar throttling por IP/usuario

### Escalabilidad
- Cachear prompts frecuentemente ejecutados
- Implementar CDN para respuestas estáticas
- Considerar réplicas de solo lectura para consumidores

## Futuras Mejoras

### Posibles Extensiones
1. **API Keys**: Alternativa a JWT para integraciones simples
2. **Scopes**: Limitar acceso a proyectos específicos
3. **Webhook Callbacks**: Notificaciones de ejecución
4. **Métricas de Uso**: Dashboard para administradores
5. **Rate Limiting Configurable**: Por tenant/proyecto

### Mantener Restricciones
El diseño debe mantener siempre:
- ✅ Acceso mínimo necesario
- ✅ Solo endpoints de ejecución
- ✅ Sin capacidades de modificación
- ✅ Auditoría completa
- ✅ Aislamiento de otros roles 