# Deployment Management System - JAPM

## Introduction

The JAPM Deployment Management system provides granular control and effective governance for managing prompts in corporate environments. It allows deploying specific versions of prompts, assets, and AI models in different environments with complete approval and audit.

## Key Features

### ✅ **Governance Control**
- **Approval Required**: Deployments require approval before execution
- **4-eyes principle**: No one can approve their own deployment
- **Differentiated Roles**: Only admins and tenant_admins can create/approve deployments
- **Complete Audit**: All changes are recorded

### ✅ **State Management**
- **PENDING**: Deployment created, waiting for approval
- **APPROVED**: Deployment approved, ready to execute
- **DEPLOYING**: Deployment in execution
- **DEPLOYED**: Deployment completed successfully
- **FAILED**: Deployment failed during execution
- **ROLLED_BACK**: Deployment rolled back to previous version
- **CANCELLED**: Deployment cancelled

### ✅ **Supported Entity Types**
- **PROMPT_VERSION**: Prompt versions
- **PROMPT_ASSET_VERSION**: Asset versions
- **AI_MODEL**: AI models

### ✅ **Automatic Rollback**
- Ability to roll back to previous deployments
- Complete rollback history
- Audit of rolled back changes

## System Architecture

### Data Models

```prisma
model Deployment {
  id          String   @id @default(cuid())
  name        String   // "deploy-2024-01-15", "hotfix-security-001"
  description String?
  status      DeploymentStatus @default(PENDING)
  
  environment   Environment @relation(fields: [environmentId], references: [id])
  environmentId String
  
  // Control of governance
  requestedBy   User   @relation("DeploymentRequester", fields: [requestedById], references: [id])
  requestedById String
  approvedBy    User?  @relation("DeploymentApprover", fields: [approvedById], references: [id])
  approvedById  String?
  approvedAt    DateTime?
  
  // Timestamps
  requestedAt DateTime @default(now())
  deployedAt  DateTime?
  rolledBackAt DateTime?
  
  // Items of the deployment
  deploymentItems DeploymentItem[]
  
  // Rollback
  rollbackToDeploymentId String?
  rollbackToDeployment   Deployment? @relation("DeploymentRollback", fields: [rollbackToDeploymentId], references: [id])
  rollbackFromDeployment Deployment[] @relation("DeploymentRollback")
  
  // Execution related logs
  promptExecutionLogs PromptExecutionLog[]
  
  project   Project @relation(fields: [projectId], references: [id])
  projectId String
}

model DeploymentItem {
  id          String   @id @default(cuid())
  deployment  Deployment @relation(fields: [deploymentId], references: [id], onDelete: Cascade)
  deploymentId String
  
  // What is being deployed
  entityType  DeploymentEntityType
  entityId    String
  versionTag  String
  
  // Item status
  status      DeploymentItemStatus @default(PENDING)
  deployedAt  DateTime?
  errorMessage String?
  
  // Metadata
  changeMessage String?
  riskLevel    RiskLevel @default(LOW)
  
  // References to specific entities
  promptVersion      PromptVersion?      @relation(fields: [promptVersionId], references: [id])
  promptVersionId    String?
  promptAssetVersion PromptAssetVersion? @relation(fields: [promptAssetVersionId], references: [id])
  promptAssetVersionId String?
  aiModel            AIModel?            @relation(fields: [aiModelId], references: [id])
  aiModelId          String?
}
```

## API Endpoints

### Create Deployment
```bash
POST /api/projects/{projectId}/deployments
```

**Body:**
```json
{
  "name": "deploy-feature-multilang-2024-01-15",
  "description": "Deployment of the new multilanguage support functionality",
  "environmentId": "clx1234567890abcdef",
  "items": [
    {
      "entityType": "PROMPT_VERSION",
      "entityId": "clx1234567890abcdef",
      "versionTag": "1.2.0",
      "changeMessage": "Improvement in input validation",
      "riskLevel": "LOW"
    },
    {
      "entityType": "PROMPT_ASSET_VERSION",
      "entityId": "clx1234567890abcdef",
      "versionTag": "2.1.0",
      "changeMessage": "New response templates",
      "riskLevel": "MEDIUM"
    }
  ]
}
```

### List Deployments
```bash
GET /api/projects/{projectId}/deployments?environmentId={envId}&status={status}
```

### Get Deployment by ID
```bash
GET /api/projects/{projectId}/deployments/{deploymentId}
```

### Approve Deployment
```bash
PUT /api/projects/{projectId}/deployments/{deploymentId}/approve
```

### Execute Deployment
```bash
POST /api/projects/{projectId}/deployments/{deploymentId}/deploy
```

### Rollback Deployment
```bash
POST /api/projects/{projectId}/deployments/{deploymentId}/rollback
```

**Body:**
```json
{
  "rollbackToDeploymentId": "clx1234567890abcdef"
}
```

## Workflow

### 1. Create Deployment
1. **Developer** creates new prompt/asset version
2. **Admin/Tenant Admin** creates deployment with specific items
3. System validates that all items exist and are valid
4. Deployment created with status `PENDING`

### 2. Approval
1. **Other Admin/Tenant Admin** (not the same who created) approves the deployment
2. System verifies that the user is not approving their own deployment
3. Deployment changes to status `APPROVED`

### 3. Execution
1. **Admin/Tenant Admin** executes the deployment
2. System starts transaction for each item:
   - Activates prompt versions in the environment
   - Activates asset versions in the environment
   - Registers AI model usage
3. Deployment changes to status `DEPLOYED`

### 4. Rollback (Optional)
1. **Admin/Tenant Admin** can roll back to previous deployment
2. System reverts to the deployment specified configuration
3. Deployment changes to status `ROLLED_BACK`

## Governance and Security

### Approval Rules
- **Development**: No approval required (can be configured)
- **Staging**: Lead technical approval
- **Production**: Approval by two people (4-eyes principle)

### Automated Validations
- Verify that all dependencies are included
- Validate that translations are complete
- Verify version compatibility
- Automatic risk analysis

### Audit
- All changes are recorded with timestamp
- Automatic rollback in case of failure
- Critical changes notifications
- Compliance reports

## Usage Examples

### Example 1: Deployment of New Functionality
```bash
# 1. Create deployment
curl -X POST "http://localhost:3001/api/projects/my-project/deployments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "deploy-chatbot-v2",
    "description": "New version of the chatbot with NLP improvements",
    "environmentId": "prod-env-123",
    "items": [
      {
        "entityType": "PROMPT_VERSION",
        "entityId": "chatbot-main-prompt-v2",
        "versionTag": "2.0.0",
        "changeMessage": "Improvements in natural language processing",
        "riskLevel": "MEDIUM"
      }
    ]
  }'

# 2. Approve deployment
curl -X PUT "http://localhost:3001/api/projects/my-project/deployments/deploy-123/approve" \
  -H "Authorization: Bearer $TOKEN"

# 3. Execute deployment
curl -X POST "http://localhost:3001/api/projects/my-project/deployments/deploy-123/deploy" \
  -H "Authorization: Bearer $TOKEN"
```

### Example 2: Security Hotfix
```bash
# 1. Create security hotfix deployment
curl -X POST "http://localhost:3001/api/projects/my-project/deployments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hotfix-security-2024-01-15",
    "description": "Critical security patch",
    "environmentId": "prod-env-123",
    "items": [
      {
        "entityType": "PROMPT_VERSION",
        "entityId": "security-guard-prompt",
        "versionTag": "1.1.1",
        "changeMessage": "Injection vulnerability correction",
        "riskLevel": "CRITICAL"
      }
    ]
  }'
```

### Example 3: Rollback due to Problems
```bash
# Rollback to previous version
curl -X POST "http://localhost:3001/api/projects/my-project/deployments/deploy-123/rollback" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rollbackToDeploymentId": "deploy-122"
  }'
```

## Monitoreo y Reportes

### Estado de Entornos
```bash
# Ver deployments activos en un entorno
GET /api/projects/{projectId}/deployments?environmentId={envId}&status=DEPLOYED
```

### Historial de Deployments
```bash
# Ver historial completo de deployments
GET /api/projects/{projectId}/deployments?status=DEPLOYED
```

### Auditoría de Cambios
Todos los cambios se registran automáticamente con:
- Usuario que realizó la acción
- Timestamp exacto
- Detalles del cambio
- Nivel de riesgo
- Estado anterior y posterior

## Configuración Avanzada

### Reglas de Aprobación por Entorno
```typescript
// En el servicio se pueden configurar reglas específicas
const approvalRules = {
  'development': { requiresApproval: false },
  'staging': { requiresApproval: true, approvers: ['lead'] },
  'production': { requiresApproval: true, approvers: ['admin', 'tech-lead'] }
};
```

### Validaciones Personalizadas
```typescript
// Se pueden agregar validaciones específicas
async validateDeploymentItems(items: any[]): Promise<void> {
  for (const item of items) {
    // Validaciones específicas por tipo de entidad
    await this.validateItem(item);
    
    // Validaciones de compliance
    await this.validateCompliance(item);
    
    // Validaciones de seguridad
    await this.validateSecurity(item);
  }
}
```

## Beneficios del Sistema

### 🎯 **Control Corporativo**
- Gobernanza efectiva de cambios
- Aprobación requerida para deployments críticos
- Auditoría completa de todos los cambios

### 🔒 **Seguridad**
- 4-eyes principle para aprobaciones
- Rollback automático en caso de problemas
- Validaciones de seguridad integradas

### 📊 **Trazabilidad**
- Historial completo de deployments
- Estado actual de cada entorno
- Reportes de compliance automáticos

### ⚡ **Eficiencia**
- Deployment automatizado
- Validaciones automáticas
- Rollback rápido en caso de problemas

## Próximas Mejoras

### v1.1.0 (Planeado)
- **Deployment Templates**: Plantillas predefinidas para deployments comunes
- **Automated Testing**: Tests automáticos antes del deployment
- **Notification System**: Notificaciones por email/Slack de cambios críticos
- **Dashboard**: Interfaz web para gestión visual de deployments

### v1.2.0 (Futuro)
- **Blue-Green Deployments**: Deployments sin tiempo de inactividad
- **Canary Deployments**: Deployments graduales
- **Integration with CI/CD**: Integración con pipelines de CI/CD
- **Advanced Analytics**: Métricas y análisis de deployments 