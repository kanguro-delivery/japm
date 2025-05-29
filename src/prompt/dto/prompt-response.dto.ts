import { Prompt, PromptType } from '@prisma/client';

export class PromptResponseDto {
    id: string;
    name: string;
    description?: string;
    type: PromptType;
    projectId: string;
    tenantId: string;
    ownerUserId: string;
    createdAt: Date;
    updatedAt: Date;

    constructor(prompt: Prompt) {
        this.id = prompt.id;
        this.name = prompt.name;
        this.description = prompt.description || undefined;
        this.type = prompt.type;
        this.projectId = prompt.projectId;
        this.tenantId = prompt.tenantId;
        this.ownerUserId = prompt.ownerUserId;
        this.createdAt = prompt.createdAt;
        this.updatedAt = prompt.updatedAt;
    }
} 