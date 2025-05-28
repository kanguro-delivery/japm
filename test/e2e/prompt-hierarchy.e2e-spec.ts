import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import * as bcrypt from 'bcrypt';
import { Role } from '../../src/auth/enums/role.enum';

describe('Prompt Hierarchy E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUser: any;
  let testTenant: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Crear tenant primero
    testTenant = await prisma.tenant.upsert({
      where: { id: 'test-tenant-id-2' },
      update: {},
      create: {
        id: 'test-tenant-id-2',
        name: 'Test Tenant 2',
      },
    });

    // Crear usuario de prueba
    const SALT_ROUNDS = 10;
    const hashedPassword = await bcrypt.hash('password123', SALT_ROUNDS);
    testUser = await prisma.user.upsert({
      where: { email: 'test2@example.com' },
      update: {
        password: hashedPassword,
        tenantId: testTenant.id,
        role: Role.TENANT_ADMIN,
      },
      create: {
        email: 'test2@example.com',
        name: 'Test User 2',
        password: hashedPassword,
        tenantId: testTenant.id,
        role: Role.TENANT_ADMIN,
      },
    });

    // Obtener token de autenticación
    const loginResponse = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test2@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.access_token;
  });

  describe('Prompt Creation and Resolution', () => {
    it('should create a complete prompt hierarchy and resolve it correctly', async () => {
      // 1. Crear proyecto
      const projectResponse = await supertest(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project Hierarchy E2E',
          description: 'Project for E2E hierarchy testing',
        });

      expect(projectResponse.status).toBe(201);
      const testProject = projectResponse.body;

      // 2. Crear prompts para la jerarquía
      const promptMain = await supertest(app.getHttpServer())
        .post(`/projects/${testProject.id}/prompts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'main-hierarchy-prompt',
          promptText: 'Main text {{prompt:ref1-hierarchy-prompt}}',
          type: 'SYSTEM',
        });
      expect(promptMain.status).toBe(201);

      const promptRef1 = await supertest(app.getHttpServer())
        .post(`/projects/${testProject.id}/prompts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'ref1-hierarchy-prompt',
          promptText: 'Ref1 text {{prompt:ref2-hierarchy-prompt}}',
          type: 'SYSTEM',
        });
      expect(promptRef1.status).toBe(201);

      const promptRef2 = await supertest(app.getHttpServer())
        .post(`/projects/${testProject.id}/prompts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'ref2-hierarchy-prompt',
          promptText: 'Ref2 text, final.',
          type: 'SYSTEM',
        });
      expect(promptRef2.status).toBe(201);

      // Esperar un momento para asegurar que las operaciones de escritura se completen si hay alguna asincronía no manejada explícitamente
      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. Probar resolución del prompt usando serve-prompt endpoint
      const resolvedPrompt = await supertest(app.getHttpServer())
        .post(
          `/serve-prompt/execute/${testProject.id}/${promptMain.body.id}/latest/base`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: {},
        })
        .expect(201);

      expect(resolvedPrompt.body).toHaveProperty('processedPrompt');
      expect(resolvedPrompt.body.processedPrompt).toBe('Main text Ref1 text Ref2 text, final.');
      expect(resolvedPrompt.body).toHaveProperty('metadata');
    });

    it('should handle circular references correctly', async () => {
      // 1. Crear proyecto
      const projectResponse = await supertest(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project Circular E2E',
          description: 'Project for E2E circular reference testing',
        });

      expect(projectResponse.status).toBe(201);
      const testProject = projectResponse.body;

      // 2. Crear prompt1 que referencia a prompt2
      const prompt1Res = await supertest(app.getHttpServer())
        .post(`/projects/${testProject.id}/prompts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'circ-prompt1',
          description: 'Prompt 1 for testing circular references',
          promptText: 'This is prompt 1 with {{prompt:circ-prompt2}}',
          type: 'SYSTEM',
        });
      expect(prompt1Res.status).toBe(201);
      const prompt1 = prompt1Res;

      // 3. Crear prompt2 que referencia a prompt1
      const prompt2Res = await supertest(app.getHttpServer())
        .post(`/projects/${testProject.id}/prompts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'circ-prompt2',
          description: 'Prompt 2 for testing circular references',
          promptText: 'This is prompt 2 with {{prompt:circ-prompt1}}',
          type: 'SYSTEM',
        });
      expect(prompt2Res.status).toBe(201);

      // Esperar un momento opcional
      await new Promise(resolve => setTimeout(resolve, 100));

      // 4. Intentar resolver prompt1
      const resolveResponse = await supertest(app.getHttpServer())
        .post(
          `/serve-prompt/execute/${testProject.id}/${prompt1.body.id}/latest/base`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: {},
        });

      expect(resolveResponse.status).toBe(400);
      expect(resolveResponse.body.message).toMatch(/Circular reference detected for prompt/);
    });
  });

  afterAll(async () => {
    try {
      // Limpiar datos específicos de este test usando limpieza global
      await prisma.assetTranslation.deleteMany();
      await prisma.promptAssetVersion.deleteMany();
      await prisma.promptAsset.deleteMany();
      await prisma.promptTranslation.deleteMany();
      await prisma.promptVersion.deleteMany();
      await prisma.promptExecutionLog.deleteMany();
      await prisma.prompt.deleteMany();
      await prisma.tag.deleteMany();
      await prisma.culturalData.deleteMany();
      await prisma.ragDocumentMetadata.deleteMany();
      await prisma.environment.deleteMany();
      await prisma.aIModel.deleteMany();
      await prisma.region.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
      await prisma.asset.deleteMany();
      await prisma.tenant.deleteMany();
      console.log('Limpieza de datos específicos completada en afterAll');
    } catch (err) {
      console.error('Error durante la limpieza en afterAll:', err);
    }
    await app.close();
    console.log('App cerrada en afterAll');
  });
});
