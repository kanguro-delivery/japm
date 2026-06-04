/**
 * Replicate JAPM content (Projects + Prompts + Versions + Translations + Assets)
 * from production into a target japm instance (local by default).
 *
 * Usage:
 *   PROD_EMAIL=... PROD_PASSWORD=... \
 *   LOCAL_EMAIL=test@example.com LOCAL_PASSWORD=password123 \
 *   npx ts-node scripts/replicate-prod.ts
 *
 * Optional env:
 *   PROD_BASE=https://japm.kanguro.com           (default)
 *   LOCAL_BASE=http://localhost:3010              (default)
 *   ONLY_PROJECTS=default-project,kngderivations  (comma-separated; default: all)
 *   DRY_RUN=true                                  (export only, no writes)
 *   EXPORT_FILE=/tmp/japm-export.json             (where to dump the export)
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import * as fs from 'fs';

type Headers = Record<string, string>;
interface Project { id: string; name: string; description?: string | null }
interface Prompt {
    id: string;
    name: string;
    description?: string | null;
    type?: string;
    tags?: { name: string }[];
}
interface PromptVersion {
    id: string;
    promptId?: string;
    promptText: string;
    languageCode: string;
    versionTag: string;
    changeMessage?: string | null;
    aiModelId?: string | null;
    status?: string;
}
interface PromptTranslation { languageCode: string; promptText: string }
interface Region { id: string; languageCode: string; name?: string; timeZone?: string; parentRegionId?: string | null; notes?: string }
interface CulturalData { id: string; key: string; regionId: string; style?: string; notes?: string }
interface AIModel { id: string; name: string; provider?: string; apiIdentifier?: string; description?: string; temperature?: number; supportsJson?: boolean; contextWindow?: number; maxTokens?: number; apiKeyEnvVar?: string }
interface Environment { id: string; name: string; description?: string | null }
interface Tag { id: string; name: string; description?: string | null }
interface PromptAsset { id: string; key: string; enabled?: boolean }
interface PromptAssetVersion { id: string; value: string; languageCode: string; versionTag: string; changeMessage?: string | null }
interface AssetTranslation { languageCode: string; value: string }

const PROD_BASE = process.env.PROD_BASE || 'https://japm.kanguro.com';
const LOCAL_BASE = process.env.LOCAL_BASE || 'http://localhost:3010';
const DRY_RUN = process.env.DRY_RUN === 'true';
const EXPORT_FILE = process.env.EXPORT_FILE || '/tmp/japm-export.json';
const ONLY_PROJECTS = process.env.ONLY_PROJECTS?.split(',').map(s => s.trim()).filter(Boolean);

function need(name: string): string {
    const v = process.env[name];
    if (!v) { console.error(`Missing env: ${name}`); process.exit(1); }
    return v;
}

async function login(base: string, email: string, password: string): Promise<string> {
    const { data } = await axios.post(`${base}/api/auth/login`, { email, password });
    return data.access_token;
}

function client(base: string, token: string): AxiosInstance {
    return axios.create({
        baseURL: `${base}/api`,
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000,
        validateStatus: () => true,
    });
}

async function get<T>(c: AxiosInstance, path: string): Promise<T> {
    const r = await c.get(path);
    if (r.status >= 400) throw new Error(`GET ${path} → ${r.status}: ${JSON.stringify(r.data).slice(0, 300)}`);
    return r.data as T;
}

async function post<T>(c: AxiosInstance, path: string, body: any, opts: { ignoreConflict?: boolean; probeOnDuplicate?: () => Promise<boolean> } = {}): Promise<T | null> {
    const r = await c.post(path, body);
    const bodyStr = JSON.stringify(r.data ?? '');
    const looksLikeDuplicate = /already exists|duplicate|unique constraint/i.test(bodyStr);
    if (opts.ignoreConflict && (r.status === 409 || (r.status >= 400 && looksLikeDuplicate))) {
        console.log(`  ↪ already exists (${r.status}): ${path}`);
        return null;
    }
    // Some endpoints (tags, system-prompts) return opaque 500 on duplicate. If the caller can confirm
    // the entity already exists, treat the 500 as a soft success.
    if (opts.ignoreConflict && r.status >= 500 && opts.probeOnDuplicate) {
        const exists = await opts.probeOnDuplicate().catch(() => false);
        if (exists) {
            console.log(`  ↪ already exists (probe confirmed after ${r.status}): ${path}`);
            return null;
        }
    }
    if (r.status >= 400) {
        const msg = `POST ${path} → ${r.status}: ${bodyStr.slice(0, 500)}`;
        if (opts.ignoreConflict) { console.warn(`  ⚠ ${msg}`); return null; }
        throw new Error(msg);
    }
    return r.data as T;
}

// ---------- EXPORT ----------

interface ProjectExport {
    project: Project;
    regions: Region[];
    culturalData: CulturalData[];
    aiModels: AIModel[];
    environments: Environment[];
    tags: Tag[];
    prompts: Array<{
        prompt: Prompt;
        versions: Array<{
            version: PromptVersion;
            translations: PromptTranslation[];
        }>;
        assets: Array<{
            asset: PromptAsset;
            versions: Array<{
                version: PromptAssetVersion;
                translations: AssetTranslation[];
            }>;
        }>;
    }>;
}

interface FullExport {
    sourceTenantId: string;
    systemPrompts: any[];
    projects: ProjectExport[];
}

async function exportProject(c: AxiosInstance, project: Project): Promise<ProjectExport> {
    console.log(`📥 Exporting project: ${project.name} (${project.id})`);
    const pid = project.id;

    const [regions, culturalData, aiModels, environments, tags, prompts] = await Promise.all([
        get<Region[]>(c, `/projects/${pid}/regions`),
        get<CulturalData[]>(c, `/projects/${pid}/cultural-data`),
        get<AIModel[]>(c, `/projects/${pid}/aimodels`),
        get<Environment[]>(c, `/projects/${pid}/environments`),
        get<Tag[]>(c, `/projects/${pid}/tags`),
        get<Prompt[]>(c, `/projects/${pid}/prompts`),
    ]);

    console.log(`  ↳ ${regions.length} regions, ${culturalData.length} cultural, ${aiModels.length} models, ${environments.length} envs, ${tags.length} tags, ${prompts.length} prompts`);

    const exportedPrompts: ProjectExport['prompts'] = [];
    for (const p of prompts) {
        const versions = await get<PromptVersion[]>(c, `/projects/${pid}/prompts/${p.id}/versions`);
        const versionExports: ProjectExport['prompts'][number]['versions'] = [];
        for (const v of versions) {
            const translations = await get<PromptTranslation[]>(
                c, `/projects/${pid}/prompts/${p.id}/versions/${v.versionTag}/translations`,
            ).catch(() => []);
            versionExports.push({ version: v, translations });
        }
        const assets = await get<PromptAsset[]>(c, `/projects/${pid}/prompts/${p.id}/assets`).catch(() => []);
        const assetExports: ProjectExport['prompts'][number]['assets'] = [];
        for (const a of assets) {
            const aVersions = await get<PromptAssetVersion[]>(
                c, `/projects/${pid}/prompts/${p.id}/assets/${a.key}/versions`,
            ).catch(() => []);
            const aVersionExports: ProjectExport['prompts'][number]['assets'][number]['versions'] = [];
            for (const av of aVersions) {
                const aTrans = await get<AssetTranslation[]>(
                    c, `/projects/${pid}/prompts/${p.id}/assets/${a.key}/versions/${av.versionTag}/translations`,
                ).catch(() => []);
                aVersionExports.push({ version: av, translations: aTrans });
            }
            assetExports.push({ asset: a, versions: aVersionExports });
        }
        exportedPrompts.push({ prompt: p, versions: versionExports, assets: assetExports });
        console.log(`    • ${p.name} (${p.id}): ${versions.length} versions, ${assets.length} assets`);
    }
    return { project, regions, culturalData, aiModels, environments, tags, prompts: exportedPrompts };
}

async function exportAll(c: AxiosInstance, profile: { tenantId: string }): Promise<FullExport> {
    const projects = await get<Project[]>(c, '/projects');
    const filtered = ONLY_PROJECTS ? projects.filter(p => ONLY_PROJECTS!.includes(p.id) || ONLY_PROJECTS!.includes(p.name)) : projects;
    console.log(`Found ${projects.length} projects in source; exporting ${filtered.length}`);

    const projectExports: ProjectExport[] = [];
    for (const p of filtered) projectExports.push(await exportProject(c, p));

    // SystemPrompts are global
    let systemPrompts: any[] = [];
    try { systemPrompts = await get<any[]>(c, '/system-prompts'); }
    catch (e) { console.warn(`  ⚠ Could not export system prompts: ${(e as Error).message}`); }

    return { sourceTenantId: profile.tenantId, systemPrompts, projects: projectExports };
}

// ---------- IMPORT ----------

async function importExport(c: AxiosInstance, data: FullExport, localTenantId: string) {
    console.log(`\n📤 Importing into local japm (tenant ${localTenantId})\n`);

    // 1. System prompts (global, admin-only)
    for (const sp of data.systemPrompts) {
        await post(c, '/system-prompts', {
            name: sp.name,
            description: sp.description,
            promptText: sp.promptText,
            category: sp.category,
        }, {
            ignoreConflict: true,
            probeOnDuplicate: async () => {
                const r = await c.get(`/system-prompts/${encodeURIComponent(sp.name)}`);
                return r.status === 200;
            },
        });
        console.log(`  · system-prompt: ${sp.name}`);
    }

    for (const pe of data.projects) {
        await importProject(c, pe, localTenantId);
    }
}

async function importProject(c: AxiosInstance, pe: ProjectExport, localTenantId: string) {
    const src = pe.project;
    console.log(`\n🏗  Project: ${src.name} (src id=${src.id})`);

    // Check if project already exists in target. We match on name (since id is auto-cuid).
    const existing = await get<Project[]>(c, '/projects');
    let target = existing.find(p => p.name === src.name);
    if (!target) {
        target = await post<Project>(c, '/projects', { name: src.name, description: src.description }) as Project;
        console.log(`  ✓ created project (target id=${target.id})`);
    } else {
        console.log(`  ↪ project exists (target id=${target.id})`);
    }
    const tid = target.id;

    // 2. Regions (record old→new mapping; CulturalData refers by region id)
    const regionIdMap = new Map<string, string>(); // sourceRegionId → targetRegionId
    for (const r of pe.regions) {
        const targetRegions = await get<Region[]>(c, `/projects/${tid}/regions`);
        let tr = targetRegions.find(x => x.languageCode === r.languageCode);
        if (!tr) {
            tr = await post<Region>(c, `/projects/${tid}/regions`, {
                languageCode: r.languageCode,
                name: r.name,
                timeZone: r.timeZone,
                notes: r.notes,
                // parentRegionId is referenced by languageCode in the API
                parentRegionId: r.parentRegionId ? pe.regions.find(x => x.id === r.parentRegionId)?.languageCode : undefined,
            }, { ignoreConflict: true }) as Region;
        }
        if (tr) regionIdMap.set(r.id, tr.id);
        console.log(`  · region ${r.languageCode}`);
    }

    // 3. Cultural data (the API's "regionId" field is actually the languageCode, not the cuid)
    for (const cd of pe.culturalData) {
        const srcRegion = pe.regions.find(x => x.id === cd.regionId);
        const languageCode = srcRegion?.languageCode;
        if (!languageCode) { console.warn(`    ⚠ cultural-data ${cd.key} skipped — no region match for ${cd.regionId}`); continue; }
        await post(c, `/projects/${tid}/cultural-data`, {
            key: cd.key, regionId: languageCode, style: cd.style, notes: cd.notes,
        }, { ignoreConflict: true });
        console.log(`  · cultural-data ${cd.key}`);
    }

    // 4. AI Models — create DTO only accepts {name, provider, description, apiIdentifier}.
    //    Extra prod fields (temperature, maxTokens, etc.) are lost — not exposed via REST on this API version.
    for (const m of pe.aiModels) {
        await post(c, `/projects/${tid}/aimodels`, {
            name: m.name, provider: m.provider, description: m.description,
            apiIdentifier: m.apiIdentifier,
        }, { ignoreConflict: true });
        console.log(`  · model ${m.name}${m.temperature !== undefined ? ' (extras lost: temperature/maxTokens/etc)' : ''}`);
    }

    // 5. Environments
    for (const e of pe.environments) {
        await post(c, `/projects/${tid}/environments`, {
            name: e.name, description: e.description,
        }, { ignoreConflict: true });
        console.log(`  · env ${e.name}`);
    }

    // 6. Tags
    for (const t of pe.tags) {
        await post(c, `/projects/${tid}/tags`, {
            name: t.name, description: t.description,
        }, {
            ignoreConflict: true,
            probeOnDuplicate: async () => {
                const r = await c.get(`/projects/${tid}/tags/by-name/${encodeURIComponent(t.name)}`);
                return r.status === 200;
            },
        });
        console.log(`  · tag ${t.name}`);
    }

    // 7. Prompts (each creates a 1.0.0 version)
    for (const pp of pe.prompts) {
        await importPrompt(c, tid, pp, localTenantId);
    }
}

async function importPrompt(c: AxiosInstance, tid: string, pp: ProjectExport['prompts'][number], localTenantId: string) {
    const src = pp.prompt;
    console.log(`  📝 Prompt: ${src.name} (src id=${src.id})`);

    // Sort versions so the first one we create matches the "earliest" version tag
    const sorted = [...pp.versions].sort((a, b) => compareSemver(a.version.versionTag, b.version.versionTag));
    if (sorted.length === 0) {
        console.warn(`    ⚠ prompt ${src.name} has no versions in source — skipping`);
        return;
    }

    const first = sorted[0];
    const tags = src.tags?.map(t => typeof t === 'string' ? t : t.name) ?? [];

    // Create prompt with first version
    const targetPrompts = await get<Prompt[]>(c, `/projects/${tid}/prompts`);
    let target = targetPrompts.find(p => p.name === src.name || p.id === src.id);
    if (!target) {
        target = await post<Prompt>(c, `/projects/${tid}/prompts`, {
            name: src.name,
            description: src.description,
            type: src.type ?? 'USER',
            promptText: first.version.promptText,
            languageCode: first.version.languageCode,
            tags,
            initialTranslations: first.translations?.map(t => ({
                languageCode: t.languageCode, promptText: t.promptText,
            })),
        }) as Prompt;
        console.log(`    ✓ created prompt + v${first.version.versionTag} (target id=${target.id})`);
    } else {
        console.log(`    ↪ prompt already exists (target id=${target.id}); will only add missing versions`);
    }
    const pid = target.id;

    // The first version was created with versionTag derived from prompt POST (defaults to 1.0.0).
    // If the actual first.version.versionTag is not 1.0.0, we have a mismatch.
    if (first.version.versionTag !== '1.0.0') {
        console.warn(`    ⚠ source first version is '${first.version.versionTag}' but prompt create makes a '1.0.0'. Skipping that source version; you may want to delete the '1.0.0' afterwards.`);
    }

    // Create remaining versions (skip the first one we used at creation).
    // NOTE: dev's PromptVersionService.create() passes the DTO directly to Prisma, so `initialTranslations`
    // would trigger a PrismaClientValidationError ("Unknown argument"). Post translations separately.
    for (let i = 1; i < sorted.length; i++) {
        const v = sorted[i];
        await post(c, `/projects/${tid}/prompts/${pid}/versions`, {
            promptText: v.version.promptText,
            versionTag: v.version.versionTag,
            languageCode: v.version.languageCode,
            changeMessage: v.version.changeMessage ?? undefined,
        }, { ignoreConflict: true });
        for (const t of v.translations ?? []) {
            await post(c, `/projects/${tid}/prompts/${pid}/versions/${v.version.versionTag}/translations`, {
                languageCode: t.languageCode, promptText: t.promptText,
            }, { ignoreConflict: true });
        }
        console.log(`    · v${v.version.versionTag}${(v.translations ?? []).length ? ` (+${v.translations!.length} translations)` : ''}`);
    }

    // Assets
    for (const ae of pp.assets) {
        const assetVersionsSorted = [...ae.versions].sort((a, b) => compareSemver(a.version.versionTag, b.version.versionTag));
        if (assetVersionsSorted.length === 0) continue;
        const firstV = assetVersionsSorted[0];

        await post(c, `/projects/${tid}/prompts/${pid}/assets`, {
            key: ae.asset.key,
            name: ae.asset.key, // assets have no separate name in schema; reuse key
            initialValue: firstV.version.value,
            initialChangeMessage: firstV.version.changeMessage ?? undefined,
            tenantId: localTenantId,
            initialTranslations: firstV.translations?.map(t => ({
                languageCode: t.languageCode, value: t.value,
            })),
        }, { ignoreConflict: true });
        console.log(`    🎨 asset ${ae.asset.key} + v${firstV.version.versionTag}`);

        for (let i = 1; i < assetVersionsSorted.length; i++) {
            const av = assetVersionsSorted[i];
            await post(c, `/projects/${tid}/prompts/${pid}/assets/${ae.asset.key}/versions`, {
                value: av.version.value,
                versionTag: av.version.versionTag,
                languageCode: av.version.languageCode,
                changeMessage: av.version.changeMessage ?? undefined,
            }, { ignoreConflict: true });
            for (const at of av.translations ?? []) {
                await post(c, `/projects/${tid}/prompts/${pid}/assets/${ae.asset.key}/versions/${av.version.versionTag}/translations`, {
                    languageCode: at.languageCode, value: at.value,
                }, { ignoreConflict: true });
            }
        }
    }
}

// Simple semver compare: lex by numeric components, ignore pre-release for sort stability.
function compareSemver(a: string, b: string): number {
    const pa = a.split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);
    const pb = b.split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d;
    }
    return a.localeCompare(b);
}

// ---------- MAIN ----------

async function main() {
    const prodEmail = need('PROD_EMAIL');
    const prodPassword = need('PROD_PASSWORD');
    const localEmail = process.env.LOCAL_EMAIL || 'test@example.com';
    const localPassword = process.env.LOCAL_PASSWORD || 'password123';

    console.log(`Logging in to PROD (${PROD_BASE})…`);
    const prodToken = await login(PROD_BASE, prodEmail, prodPassword);
    const prodClient = client(PROD_BASE, prodToken);
    const prodProfile = await get<{ tenantId: string; id: string; email: string }>(prodClient, '/auth/profile');
    console.log(`  ↳ prod tenantId=${prodProfile.tenantId}`);

    console.log(`\nExporting…`);
    const exportData = await exportAll(prodClient, prodProfile);

    fs.writeFileSync(EXPORT_FILE, JSON.stringify(exportData, null, 2));
    console.log(`\n💾 Wrote export → ${EXPORT_FILE} (${(fs.statSync(EXPORT_FILE).size / 1024).toFixed(1)} KB)`);

    if (DRY_RUN) {
        console.log('\nDRY_RUN=true — skipping import.');
        return;
    }

    console.log(`\nLogging in to LOCAL (${LOCAL_BASE})…`);
    const localToken = await login(LOCAL_BASE, localEmail, localPassword);
    const localClient = client(LOCAL_BASE, localToken);
    const localProfile = await get<{ tenantId: string }>(localClient, '/auth/profile');
    console.log(`  ↳ local tenantId=${localProfile.tenantId}`);

    await importExport(localClient, exportData, localProfile.tenantId);

    console.log(`\n✅ Done.`);
}

main().catch(e => {
    if (e instanceof AxiosError) {
        console.error(`AxiosError: ${e.message}\nResponse: ${JSON.stringify(e.response?.data).slice(0, 1000)}`);
    } else {
        console.error(e);
    }
    process.exit(1);
});
