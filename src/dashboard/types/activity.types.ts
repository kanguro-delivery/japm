export enum ActivityActionEnum {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    PUBLISH = 'PUBLISH',
    UNPUBLISH = 'UNPUBLISH',
    APPROVE = 'APPROVE',
    REJECT = 'REJECT',
}

export enum ActivityEntityTypeEnum {
    PROMPT = 'PROMPT',
    PROMPT_VERSION = 'PROMPT_VERSION',
    PROMPT_TRANSLATION = 'PROMPT_TRANSLATION',
    PROMPT_ASSET = 'PROMPT_ASSET',
    PROMPT_ASSET_VERSION = 'PROMPT_ASSET_VERSION',
    ASSET_TRANSLATION = 'ASSET_TRANSLATION',
    PROJECT = 'PROJECT',
    ENVIRONMENT = 'ENVIRONMENT',
    AI_MODEL = 'AI_MODEL',
    TAG = 'TAG',
    REGION = 'REGION',
    CULTURAL_DATA = 'CULTURAL_DATA',
    RAG_DOCUMENT = 'RAG_DOCUMENT',
}

export type ActivityAction = keyof typeof ActivityActionEnum;
export type ActivityEntityType = keyof typeof ActivityEntityTypeEnum; 