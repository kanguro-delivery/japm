import { PrismaClient, MarketplacePublishStatus, Role, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createSpanishRegionAndCulturalData, createUSRegionAndCulturalData } from './helpers';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// Helper to convert to slug (simplified, use a library for more robustness)
const toSlug = (str: string) => {
    return str
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric characters except hyphens
        .replace(/--+/g, '-') // Replace multiple hyphens with one
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

async function deleteTableDataIfExists(model: any, modelName: string) {
    try {
        // Check if model has a count method, which implies it's a Prisma model proxy
        if (typeof model.count !== 'function') {
            console.warn(`Skipping deletion for ${modelName} as it does not appear to be a valid Prisma model.`);
            return;
        }
        // Attempt to count records. If the table doesn't exist, Prisma throws an error (e.g., P2021).
        await model.count();
        console.log(`Table ${modelName} exists. Deleting all records...`);
        await model.deleteMany({});
        console.log(`All records deleted from ${modelName}.`);
    } catch (error: any) {
        // Prisma error P2021: "The table ... does not exist in the current database."
        // Prisma error P2025: "An operation failed because it depends on one or more records that were required but not found..." (can happen if trying to delete from related table that's empty due to other deletions)
        if (error.code === 'P2021' || error.code === 'P2025') {
            console.warn(`Table ${modelName} does not exist or is empty. Skipping deletion.`);
        } else {
            console.error(`Error during deletion for table ${modelName}:`, error);
            throw error; // Re-throw unexpected errors
        }
    }
}

async function main() {
    console.log(`Start base seeding (User, AI Models, Environments, Regions)...`);

    // --- Optional Cleanup ---
    console.log('Attempting to delete existing data (if tables/data exist)...');

    // Order of deletion matters due to foreign key constraints if not using onDelete: Cascade extensively.
    // Start with tables that are often targets of foreign keys or have fewer dependencies.
    await deleteTableDataIfExists(prisma.promptExecutionLog, 'PromptExecutionLog');
    await deleteTableDataIfExists(prisma.assetTranslation, 'AssetTranslation');
    await deleteTableDataIfExists(prisma.promptTranslation, 'PromptTranslation');
    // PromptVersion and PromptAssetVersion might have relations to Environment, AIModel, User
    // Deleting them before dependent records are cleaned from User, AIModel etc., can be an issue if not cascaded.
    // However, if they point *to* User/AIModel and those are deleted later, it's usually fine.
    // The original order was: PromptVersion, PromptAssetVersion, then Tag, Prompt, etc.
    await deleteTableDataIfExists(prisma.promptVersion, 'PromptVersion');
    await deleteTableDataIfExists(prisma.promptAssetVersion, 'PromptAssetVersion');

    // Tags are related to Prompts
    await deleteTableDataIfExists(prisma.tag, 'Tag');
    // Prompts are related to Project, Tenant
    await deleteTableDataIfExists(prisma.prompt, 'Prompt');

    // CulturalData is related to Region and Project
    await deleteTableDataIfExists(prisma.culturalData, 'CulturalData');
    // RagDocumentMetadata is related to Region and Project
    await deleteTableDataIfExists(prisma.ragDocumentMetadata, 'RagDocumentMetadata');
    // Regions are related to Project
    await deleteTableDataIfExists(prisma.region, 'Region');

    // Environments are related to Project and hold relations from PromptVersion/AssetVersion
    await deleteTableDataIfExists(prisma.environment, 'Environment');
    // PromptAsset is related to Prompt
    await deleteTableDataIfExists(prisma.promptAsset, 'PromptAsset');
    // AIModel is related to Project and PromptVersion
    await deleteTableDataIfExists(prisma.aIModel, 'AIModel'); // Note: Prisma client often uses camelCase like 'aiModel'
    // Check generated client if 'aIModel' is correct. Assuming it is based on schema.

    // Project is related to User (owner) and Tenant
    await deleteTableDataIfExists(prisma.project, 'Project');
    // User is related to Tenant
    await deleteTableDataIfExists(prisma.user, 'User');
    // Tenant is top-level for many things
    await deleteTableDataIfExists(prisma.tenant, 'Tenant'); // Added Tenant deletion

    console.log('Existing data deletion process completed.');


    // --- BASE DATA --- //

    // 1. Crear Tenant por defecto
    let defaultTenant = await prisma.tenant.findFirst({ where: { name: 'Default Tenant' } });
    if (!defaultTenant) {
        defaultTenant = await prisma.tenant.create({
            data: {
                name: 'Default Tenant',
                marketplaceRequiresApproval: true,
            }
        });
        console.log(`Created default tenant: ${defaultTenant.id}`);
    } else {
        console.log(`Found existing default tenant: ${defaultTenant.id}`);
    }

    // 2. Create Test Users
    console.log('Upserting test users...');
    const hashedPassword = await bcrypt.hash('password123', SALT_ROUNDS);

    // Admin user
    const testUser = await prisma.user.upsert({
        where: { email: 'test@example.com' },
        update: { name: 'Test User', password: hashedPassword, role: 'admin' },
        create: {
            email: 'test@example.com',
            name: 'Test User',
            password: hashedPassword,
            tenant: { connect: { id: defaultTenant.id } },
            role: 'admin'
        },
    });
    console.log(`Upserted admin user: ${testUser.name} (ID: ${testUser.id}, Tenant: ${testUser.tenantId})`);

    // Prompt Consumer user
    const promptConsumerUser = await prisma.user.upsert({
        where: { email: 'prompt-consumer@example.com' },
        update: { name: 'Prompt Consumer', password: hashedPassword, role: 'prompt_consumer' as Role },
        create: {
            email: 'prompt-consumer@example.com',
            name: 'Prompt Consumer',
            password: hashedPassword,
            tenant: { connect: { id: defaultTenant.id } },
            role: 'prompt_consumer' as Role
        },
    });
    console.log(`Upserted prompt consumer user: ${promptConsumerUser.name} (ID: ${promptConsumerUser.id}, Tenant: ${promptConsumerUser.tenantId})`);

    // Tenant Admin user
    const tenantAdminUser = await prisma.user.upsert({
        where: { email: 'tenant_admin@example.com' },
        update: { name: 'Tenant Admin', password: hashedPassword, role: 'tenant_admin' as Role },
        create: {
            email: 'tenant_admin@example.com',
            name: 'Tenant Admin',
            password: hashedPassword,
            tenant: { connect: { id: defaultTenant.id } },
            role: 'tenant_admin' as Role
        },
    });
    console.log(`Upserted tenant admin user: ${tenantAdminUser.name} (ID: ${tenantAdminUser.id}, Tenant: ${tenantAdminUser.tenantId})`);

    // Verificar que los usuarios existen después de crearlos
    const verifyUser = await prisma.user.findUnique({ where: { email: 'test@example.com' } });
    if (verifyUser) {
        console.log(`Verified admin user exists: ${verifyUser.name} (ID: ${verifyUser.id}, Tenant: ${verifyUser.tenantId})`);
    } else {
        console.error('Admin user was not created successfully!');
    }

    const verifyConsumer = await prisma.user.findUnique({ where: { email: 'prompt-consumer@example.com' } });
    if (verifyConsumer) {
        console.log(`Verified prompt consumer exists: ${verifyConsumer.name} (ID: ${verifyConsumer.id}, Tenant: ${verifyConsumer.tenantId})`);
    } else {
        console.error('Prompt consumer user was not created successfully!');
    }

    const verifyTenantAdmin = await prisma.user.findUnique({ where: { email: 'tenant_admin@example.com' } });
    if (verifyTenantAdmin) {
        console.log(`Verified tenant admin exists: ${verifyTenantAdmin.name} (ID: ${verifyTenantAdmin.id}, Tenant: ${verifyTenantAdmin.tenantId})`);
    } else {
        console.error('Tenant admin user was not created successfully!');
    }

    // 3. Create Default Project
    const defaultProject = await prisma.project.upsert({
        where: { id: 'default-project' },
        update: { name: 'Default Project', description: 'Project for base/shared entities.', owner: { connect: { id: testUser.id } } },
        create: {
            id: 'default-project',
            name: 'Default Project',
            description: 'Project for base/shared entities.',
            owner: { connect: { id: testUser.id } },
            tenant: { connect: { id: defaultTenant.id } },
        },
    });
    console.log(`Upserted default project: ${defaultProject.name}`);

    // Crear región es-ES y datos culturales para el proyecto por defecto
    await createSpanishRegionAndCulturalData(defaultProject.id);
    // Crear región en-US y datos culturales para el proyecto por defecto
    await createUSRegionAndCulturalData(defaultProject.id);

    // 3. Create Generic Tags for Default Project
    console.log('Upserting Generic Tags...');
    const genericTags = [
        { name: 'Core', description: 'Core functionality or widely used.' },
        { name: 'Experimental', description: 'Features under development or testing.' },
        { name: 'Deprecated', description: 'Features planned for removal.' },
        { name: 'UI/Frontend', description: 'Related to User Interface.' },
        { name: 'Backend', description: 'Related to backend logic or services.' },
        { name: 'Marketing', description: 'Related to marketing campaigns or content.' },
        { name: 'Internal', description: 'For internal tools or processes.' },
    ];

    for (const tagData of genericTags) {
        await prisma.tag.upsert({
            where: { projectId_name: { name: tagData.name, projectId: defaultProject.id } },
            update: { description: tagData.description }, // Update description if tag exists
            create: {
                name: tagData.name,
                description: tagData.description,
                projectId: defaultProject.id, // Associate with default project
            },
        });
        console.log(`Upserted Tag: ${tagData.name}`);
    }

    // 4. Create Specific AI Models for the Default Project
    console.log(`Upserting specific AI Models for project: ${defaultProject.id}...`);
    const projectAiModels = [
        {
            id: 'gpt-4o', // Keep ID globally unique for simplicity, but scoped by project logic
            name: 'GPT-4o',
            provider: 'OpenAI',
            apiIdentifier: 'gpt-4o',
            description: 'Fast, intelligent, flexible GPT model',
            temperature: 0.7,
            apiKeyEnvVar: 'OPENAI_API_KEY', // Example env var name
            supportsJson: true,
            contextWindow: 128000,
            maxTokens: 4096
        },
        {
            id: 'gpt-4o-mini',
            name: 'GPT-4o mini',
            provider: 'OpenAI',
            apiIdentifier: 'gpt-4o-mini',
            description: 'Fast, affordable small model for focused tasks',
            temperature: 0.7,
            apiKeyEnvVar: 'OPENAI_API_KEY',
            supportsJson: true,
            contextWindow: 128000, // Check actual value if needed
            maxTokens: 4096 // Check actual value if needed
        }
    ];

    for (const modelData of projectAiModels) {
        await prisma.aIModel.upsert({
            where: {
                // Use the project-specific unique constraint
                projectId_name: { projectId: defaultProject.id, name: modelData.name }
            },
            update: {
                // Update all fields except projectId and name
                provider: modelData.provider,
                description: modelData.description,
                apiIdentifier: modelData.apiIdentifier,
                maxTokens: modelData.maxTokens,
                supportsJson: modelData.supportsJson,
                contextWindow: modelData.contextWindow,
                temperature: modelData.temperature,
                apiKeyEnvVar: modelData.apiKeyEnvVar,
                // id: modelData.id, // ID is auto-generated by cuid() on create, cannot be updated like this
            },
            create: {
                // Let cuid() generate the ID on create
                name: modelData.name,
                provider: modelData.provider,
                description: modelData.description,
                apiIdentifier: modelData.apiIdentifier,
                maxTokens: modelData.maxTokens,
                supportsJson: modelData.supportsJson,
                contextWindow: modelData.contextWindow,
                temperature: modelData.temperature,
                apiKeyEnvVar: modelData.apiKeyEnvVar,
                projectId: defaultProject.id, // Connect to the project
            },
        });
        console.log(`Upserted AI Model: ${modelData.name} for project ${defaultProject.id}`);
    }

    // 5. Create Environments (Associated with Default Project)
    console.log('Upserting Environments...');
    const environments = [
        { name: 'development', description: 'For active development and testing' },
        { name: 'staging', description: 'Staging environment for pre-production testing.' },
        { name: 'production', description: 'Live production environment.' },
        { name: 'testing', description: 'Automated testing environment.' },
    ];
    for (const envData of environments) {
        // Use the composite key directly in where for upsert
        await prisma.environment.upsert({
            where: { projectId_name: { name: envData.name, projectId: defaultProject.id } },
            update: { description: envData.description },
            create: {
                name: envData.name,
                description: envData.description,
                projectId: defaultProject.id // Connect using projectId directly in create
            }
        });
        console.log(`Upserted Environment: ${envData.name}`);
    }

    // 6. Create US Region and CulturalData (Associated with Default Project)
    console.log('Upserting Region US...');
    const regionUS = await prisma.region.upsert({
        where: {
            projectId_languageCode: {
                projectId: defaultProject.id,
                languageCode: 'en-US'
            }
        },
        update: {
            name: 'United States',
            timeZone: 'America/New_York'
        },
        create: {
            languageCode: 'en-US',
            name: 'United States',
            timeZone: 'America/New_York',
            project: { connect: { id: defaultProject.id } }
        }
    });
    console.log(`Upserted Region: ${regionUS.name} (ID: ${regionUS.id})`);

    console.log('Upserting CulturalData US...');
    await prisma.culturalData.upsert({
        where: {
            projectId_key: {
                projectId: defaultProject.id,
                key: 'standard-american-english'
            }
        },
        update: {
            style: 'Standard American English, generally informal.',
            region: { connect: { id: regionUS.id } }
        },
        create: {
            key: 'standard-american-english',
            style: 'Standard American English, generally informal.',
            project: { connect: { id: defaultProject.id } },
            region: { connect: { id: regionUS.id } }
        }
    });
    console.log(`Upserted CulturalData for US (Key: standard-american-english)`);

    // console.log('Upserted CulturalData for US (ID: standard-business)'); // Esta línea parecía un log huérfano

    // 8. Upsert Specific System Prompts (Global)
    console.log('Upserting specific System Prompts...');
    await prisma.systemPrompt.upsert({
        where: { name: 'prompt-improver' },
        update: {
            description: 'Improves a given prompt based on best practices.',
            promptText: "${file('resources/system-prompts/prompt-improver.md')}", // Asegúrate que esta ruta sea correcta
            category: 'Prompt Engineering',
            // projectId: defaultProject.id, // System prompts are global, not project-specific for now
        },
        create: {
            name: 'prompt-improver',
            description: 'Improves a given prompt based on best practices.',
            promptText: "${file('resources/system-prompts/prompt-improver.md')}",
            category: 'Prompt Engineering',
            // tenantId: defaultTenant.id, // System prompts are global for now
            // createdById: testUser.id,
        },
    });
    console.log('Upserted System Prompt: prompt-improver');

    await prisma.systemPrompt.upsert({
        where: { name: 'prompt-translator' },
        update: {
            description: 'Traduce texto a un idioma objetivo manteniendo el tono y estilo original.',
            promptText: "${file('resources/system-prompts/prompt-translator.md')}",
            category: 'Translation',
        },
        create: {
            name: 'prompt-translator',
            description: 'Traduce texto a un idioma objetivo manteniendo el tono y estilo original.',
            promptText: "${file('resources/system-prompts/prompt-translator.md')}",
            category: 'Translation',
        },
    });

    // Añadir nuevo System Prompt: prompt-generator
    await prisma.systemPrompt.upsert({
        where: { name: 'prompt-generator' },
        update: {
            description: 'Generates content or structures based on user input and project context.',
            promptText: "${file('resources/system-prompts/prompt-generator.md')}",
            category: 'Content Generation',
            // createdById: testUser.id, // Opcional: si quieres asociarlo a un usuario
            // updatedById: testUser.id  // Opcional
        },
        create: {
            name: 'prompt-generator',
            description: 'Generates content or structures based on user input and project context.',
            promptText: "${file('resources/system-prompts/prompt-generator.md')}",
            category: 'Content Generation',
            // createdById: testUser.id, // Opcional
            // tenantId: defaultTenant.id // Si los system prompts son tenant-specific (parece que no por "Global")
        },
    });
    console.log('Upserted System Prompt: prompt-generator');

    // --- Default Project Assets ---
    console.log('Upserting Default Project Assets...');

    // Crear un Prompt "General" para los Default Assets si no existe
    const generalAssetsPromptSlug = 'general-default-assets';
    const generalAssetsPrompt = await prisma.prompt.upsert({
        where: {
            prompt_id_project_unique: {
                id: generalAssetsPromptSlug,
                projectId: defaultProject.id,
            },
        },
        update: { name: 'General Default Assets Prompt' }, // Actualizar nombre por si cambia
        create: {
            id: generalAssetsPromptSlug,
            name: 'General Default Assets Prompt',
            description: 'A general prompt to house default project assets.',
            projectId: defaultProject.id,
            tenantId: defaultTenant.id,
            type: 'USER'
        },
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });