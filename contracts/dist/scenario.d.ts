import * as z from 'zod';
export declare const scenarioSchema: z.ZodObject<{
    title: z.ZodString;
    spec: z.ZodString;
    feature: z.ZodNullable<z.ZodString>;
    tags: z.ZodArray<z.ZodString>;
    domain: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type Scenario = z.output<typeof scenarioSchema>;
export declare const scenarioRunStepSchema: z.ZodObject<{
    title: z.ZodString;
    status: z.ZodEnum<{
        success: "success";
        waiting: "waiting";
        running: "running";
        failed: "failed";
    }>;
    duration_ms: z.ZodNumber;
    error: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type ScenarioRunStep = z.output<typeof scenarioRunStepSchema>;
export declare const scenarioRunSchema: z.ZodObject<{
    started_at: z.ZodString;
    duration_ms: z.ZodNumber;
    passed: z.ZodBoolean;
    branch: z.ZodNullable<z.ZodString>;
    author: z.ZodNullable<z.ZodString>;
    steps: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        status: z.ZodEnum<{
            success: "success";
            waiting: "waiting";
            running: "running";
            failed: "failed";
        }>;
        duration_ms: z.ZodNumber;
        error: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    playwright: z.ZodString;
    video_path: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type ScenarioRun = z.output<typeof scenarioRunSchema>;
export declare const scenarioDetailSchema: z.ZodObject<{
    title: z.ZodString;
    spec: z.ZodString;
    feature: z.ZodNullable<z.ZodString>;
    tags: z.ZodArray<z.ZodString>;
    domain: z.ZodNullable<z.ZodString>;
    playwright: z.ZodString;
    gherkin: z.ZodNullable<z.ZodString>;
    events: z.ZodArray<z.ZodObject<{
        event: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        html: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        innerText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        value: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sensitive: z.ZodOptional<z.ZodBoolean>;
        selectors: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            dataTestId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            placeholder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            cssStable: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$loose>>>;
        sessionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        timestamp: z.ZodOptional<z.ZodNumber>;
        recordingStartedAt: z.ZodOptional<z.ZodNumber>;
        storageState: z.ZodOptional<z.ZodNullable<z.ZodLazy<z.ZodObject<{
            cookies: z.ZodArray<z.ZodUnknown>;
            origins: z.ZodArray<z.ZodUnknown>;
        }, z.core.$strip>>>>;
        inputType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>;
    updated_at: z.ZodString;
    is_auth: z.ZodBoolean;
    runs: z.ZodArray<z.ZodObject<{
        started_at: z.ZodString;
        duration_ms: z.ZodNumber;
        passed: z.ZodBoolean;
        branch: z.ZodNullable<z.ZodString>;
        author: z.ZodNullable<z.ZodString>;
        steps: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            status: z.ZodEnum<{
                success: "success";
                waiting: "waiting";
                running: "running";
                failed: "failed";
            }>;
            duration_ms: z.ZodNumber;
            error: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        playwright: z.ZodString;
        video_path: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ScenarioDetail = z.output<typeof scenarioDetailSchema>;
export declare const updateScenarioRequestSchema: z.ZodObject<{
    title: z.ZodString;
    path: z.ZodString;
    domain: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    gherkin: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    playwright: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type UpdateScenarioRequest = z.input<typeof updateScenarioRequestSchema>;
export declare const scenarioFixRequestSchema: z.ZodObject<{
    step: z.ZodString;
    error: z.ZodString;
}, z.core.$strip>;
export type ScenarioFixRequest = z.input<typeof scenarioFixRequestSchema>;
export type ScenarioFixBffRequest = ScenarioFixRequest & {
    scenarioId: string;
};
export type ScenarioSuggestionsRequest = {
    scenarioId: string;
};
export declare const fixedSpecSchema: z.ZodObject<{
    playwright: z.ZodString;
    summary: z.ZodString;
}, z.core.$strip>;
export type FixedSpec = z.output<typeof fixedSpecSchema>;
export declare const selectorSuggestionSchema: z.ZodObject<{
    event: z.ZodString;
    currentSelector: z.ZodString;
    suggestedTestId: z.ZodString;
    reason: z.ZodString;
}, z.core.$strip>;
export type SelectorSuggestion = z.output<typeof selectorSuggestionSchema>;
export declare const runProjectRequestSchema: z.ZodObject<{
    spec: z.ZodOptional<z.ZodString>;
    grep: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type RunProjectRequest = z.input<typeof runProjectRequestSchema>;
export declare const runProjectResponseSchema: z.ZodObject<{
    passed: z.ZodBoolean;
    output: z.ZodString;
}, z.core.$strip>;
export type RunProjectResponse = z.output<typeof runProjectResponseSchema>;
export type RunTimelineStep = {
    title: string;
    status: 'waiting' | 'running' | 'success' | 'failed';
    error?: string | null;
    testId?: string;
    order?: number;
};
export type RunTest = {
    id: string;
    title: string;
    status: RunTimelineStep['status'];
    error: string | null;
    steps: RunTimelineStep[];
};
export type RunStreamEvent = {
    event: 'run:started' | 'step' | 'test' | 'run:finished';
    id?: string;
    testId?: string;
    title: string;
    status: 'pending' | 'success' | 'failed' | 'skipped';
    steps?: string[];
    error?: string | null;
    videoPath?: string | null;
    passed: boolean;
    output?: string;
};
