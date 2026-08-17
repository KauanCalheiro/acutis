import * as z from 'zod';
export declare const createProjectSchema: z.ZodObject<{
    name: z.ZodString;
}, z.core.$strip>;
export type CreateProjectRequest = z.output<typeof createProjectSchema>;
export declare const cloneProjectSchema: z.ZodObject<{
    url: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    branch: z.ZodOptional<z.ZodString>;
    auth: z.ZodDefault<z.ZodEnum<{
        public: "public";
        token: "token";
        ssh_key: "ssh_key";
    }>>;
    token: z.ZodOptional<z.ZodString>;
    ssh_key: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CloneProjectRequest = z.input<typeof cloneProjectSchema>;
export type CloneProjectData = z.output<typeof cloneProjectSchema>;
export declare const projectSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    path: z.ZodString;
    repository: z.ZodNullable<z.ZodString>;
    provider: z.ZodNullable<z.ZodEnum<{
        github: "github";
        gitlab: "gitlab";
    }>>;
    created_at: z.ZodString;
}, z.core.$strip>;
export type Project = z.output<typeof projectSchema>;
export declare const projectDetailSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    path: z.ZodString;
    repository: z.ZodNullable<z.ZodString>;
    provider: z.ZodNullable<z.ZodEnum<{
        github: "github";
        gitlab: "gitlab";
    }>>;
    created_at: z.ZodString;
    branch: z.ZodNullable<z.ZodString>;
    updated_at: z.ZodString;
    scenarios: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        spec: z.ZodString;
        feature: z.ZodNullable<z.ZodString>;
        tags: z.ZodArray<z.ZodString>;
        domain: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    auth_status: z.ZodEnum<{
        skipped: "skipped";
        unset: "unset";
        configured: "configured";
        failing: "failing";
    }>;
    base_url: z.ZodNullable<z.ZodString>;
    storage_state: z.ZodString;
    requires_url: z.ZodBoolean;
    vscode_url: z.ZodString;
    has_report: z.ZodBoolean;
}, z.core.$strip>;
export type ProjectDetail = z.output<typeof projectDetailSchema>;
export declare const paginationMetaSchema: z.ZodObject<{
    current_page: z.ZodNumber;
    per_page: z.ZodNumber;
    total: z.ZodNumber;
}, z.core.$strip>;
export declare const projectsResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        slug: z.ZodString;
        path: z.ZodString;
        repository: z.ZodNullable<z.ZodString>;
        provider: z.ZodNullable<z.ZodEnum<{
            github: "github";
            gitlab: "gitlab";
        }>>;
        created_at: z.ZodString;
    }, z.core.$strip>>;
    meta: z.ZodObject<{
        current_page: z.ZodNumber;
        per_page: z.ZodNumber;
        total: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ProjectsResponse = z.output<typeof projectsResponseSchema>;
export declare const updateProjectSchema: z.ZodObject<{
    name: z.ZodString;
}, z.core.$strip>;
export type UpdateProjectRequest = z.input<typeof updateProjectSchema>;
export declare const projectSettingsSchema: z.ZodObject<{
    baseUrl: z.ZodString;
}, z.core.$strip>;
export type ProjectSettingsRequest = z.input<typeof projectSettingsSchema>;
export declare const projectBaseUrlResponseSchema: z.ZodObject<{
    base_url: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type ProjectBaseUrlResponse = z.output<typeof projectBaseUrlResponseSchema>;
export type ProjectListQuery = {
    page?: string | number;
    per_page?: string | number;
    search?: string;
};
