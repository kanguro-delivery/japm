# JAPM API follow-ups

Small, low-priority server-side fixes discovered while writing `scripts/replicate-prod.ts` (the prod→local replication script). None are blocking; all could be fixed in single-digit-line diffs.

## 1. `CreateAiModelDto` is missing useful fields

**Where**: `src/ai-model/dto/create-ai-model.dto.ts`

`CreateAiModelDto` only declares `name`, `provider`, `description`, `apiIdentifier`. The Prisma `AIModel` entity carries `temperature`, `maxTokens`, `supportsJson`, `contextWindow`, `apiKeyEnvVar` — all settable via seed scripts but not via the REST API. The `UpdateAiModelDto` (extends `OmitType(CreateAiModelDto, [...])`) also rejects them, so there's no patch path either.

Effect: replicating an AIModel from prod via API loses everything except the four allowed fields.

Fix: add the missing fields to `CreateAiModelDto` with `@IsOptional()` validators.

## 2. OpenAPI docs lie about `cultural-data.regionId`

**Where**: `src/cultural-data/dto/create-cultural-data.dto.ts` + service

The Swagger description for `regionId` says "ID (CUID) of the Region this data applies to". The runtime validator is `minLength: 5, maxLength: 5`. The service code (`cultural-data.service.ts:19`) destructures it as `regionId: regionLanguageCode` — so the field is actually the Region's **languageCode**, not its cuid.

Fix: rename the DTO field to `regionLanguageCode` (and provide migration alias on the controller for back-compat), OR keep the name and update the @ApiProperty description.

## 3. Tag and SystemPrompt create return 500 on duplicate

**Where**: `src/tag/tag.service.ts`, `src/system-prompt/system-prompt.service.ts` (probably)

When creating a tag/system-prompt with a name that already exists, the API returns 500 with body `{"statusCode":500,"message":"Internal server error"}` — no helpful information. Looks like Prisma's `P2002` unique-constraint error isn't being caught.

`replicate-prod.ts` works around this by issuing a GET probe after a 500 to confirm existence. Cleaner fix:

```ts
try {
  return await this.prisma.tag.create({ data: dto });
} catch (e) {
  if (e.code === 'P2002') throw new ConflictException('Tag already exists');
  throw e;
}
```

Same pattern would clean up the system-prompts service.

## 4. Empty project DELETE returns 500

Deleting a project with no prompts/children returns 500 instead of 204. Found while cleaning up after smoke tests. Low priority — most projects in real use have content, so the path is rarely hit.

Fix: same pattern as #3 (catch the Prisma error in the service).

## 5. `GET /api/projects` leaks bcrypt password hashes (P2 security)

**Where**: `src/project/project.service.ts` (or its serializer) — the list response embeds the project `owner` relation, which includes `owner.password` (the bcrypt hash from `User.password`).

Effect: any authenticated user can read every project owner's password hash by listing projects. Bcrypt is computationally expensive to brute-force, but exposing hashes still violates least-privilege and could let an attacker run offline cracking against weaker passwords.

Fix options:
- Add `@Exclude()` on `User.password` in a class-transformer DTO and run the controller through `ClassSerializerInterceptor`.
- Or: explicitly `select` the user fields you want in the Prisma include, e.g. `owner: { select: { id: true, name: true, email: true } }`.
- Or: shape via a `ProjectListResult` DTO with a `fromEntity` mapper that drops sensitive fields.

Likely best path is the explicit `select` since it's narrow, prevents accidental leaks if more fields are added to `User`, and doesn't require interceptor wiring.

## 6. `PromptVersion.isActive` defaults to `null` instead of a boolean

When creating a PromptVersion via the API, the resulting record has `isActive: null` rather than `false` or `true`. Three-valued logic on a boolean is a code-smell — every downstream consumer needs `!!v.isActive` or `v.isActive === true`.

Fix: set `@default(false)` (or `@default(true)`) on `PromptVersion.isActive` in `prisma/schema.prisma` and add a migration. Pick the default based on intent — if "active in environment" is the meaning, `false` is the safer default (you must explicitly activate). Audit any code paths that currently treat null specially before changing it.

## 7. `PromptVersionService.create()` passes the whole DTO to Prisma

**Where**: `src/prompt-version/prompt-version.service.ts:44` (approximate)

The service calls `this.prisma.promptVersion.create({ data: dto })` where `dto` is the `CreatePromptVersionDto` straight from the controller. That DTO declares an `initialTranslations` field (intended to batch-insert per-language translations alongside the version). But `initialTranslations` is NOT a column on `PromptVersion`, so passing the raw DTO triggers `PrismaClientValidationError: Unknown argument 'initialTranslations'`. The service should:

```ts
const { initialTranslations, ...versionData } = dto;
const version = await this.prisma.promptVersion.create({ data: versionData });
if (initialTranslations?.length) {
  await this.prisma.promptTranslation.createMany({
    data: initialTranslations.map(t => ({ versionId: version.id, ...t })),
  });
}
```

The create-prompt path (which also accepts `initialTranslations`) does this correctly; only the additional-version POST is broken.

**Workaround**: `scripts/replicate-prod.ts` no longer sends `initialTranslations` on additional-version POSTs; it posts each translation separately via `POST /versions/{tag}/translations`. Slower but works.

## 8. `serve-prompt/execute/.../lang/{code}` silently falls back when code is wrong-length

**Where**: `src/serve-prompt/serve-prompt.service.ts` (the `resolveTranslation` path)

The endpoint accepts any `{code}` value in the path — 2-char (`es`), 5-char (`es-ES`), garbage (`foo`) — and always returns 201 with `processedPrompt`. But it only finds the translation row if the code matches exactly on `languageCode`. Translations are always stored with 5-char codes (`POST /translations` enforces that regex), so a 2-char path segment can never match. The endpoint then sets `metadata.languageUsed = "base_language_fallback"` and returns the source-language text.

Caller has no way to know they got the source-language fallback unless they parse `metadata.languageUsed`. n8n's derivations workflows currently pass 2-char codes (`es`, `de`, `en`, `pt`) verbatim and would silently fall back if `kngderivations` ever gets translations.

Fix options (pick one):
- Reject non-5-char codes with 400 from the serve-prompt endpoint (breaking change, but consistent with the write side).
- Normalize 2-char codes with a fixed lookup table (`es → es-ES`, `de → de-DE`, etc.).
- Return a more prominent `fallback: true` flag at the top level instead of buried in metadata.

Option 3 is least disruptive.

Discovered while testing translation roundtrip for the n8n integration on 2026-05-28.

## Notes

- Items 1-4 discovered by `scripts/replicate-prod.ts` on 2026-05-28.
- Items 5-6 flagged by japmux-expert during visual verification.
- Item 7 hit during the dev-branch re-import after the DB recreate for x-api-key support.
- Item 8 surfaced by n8n-expert's question about 2-char vs 5-char language codes.
- The replication script (`scripts/replicate-prod.ts`) is the canonical reproducer for #3 and #7 — its `post()` helper with `ignoreConflict` + `probeOnDuplicate` shows exactly which endpoints currently mis-handle errors.
