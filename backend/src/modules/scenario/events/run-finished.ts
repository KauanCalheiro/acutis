import type { RunEventRecord } from '../scenario.service.js'

export class RunFinished {
    constructor(
        readonly projectPath: string,
        readonly spec: string | undefined,
        readonly events: RunEventRecord[],
        readonly startedAt: Date
    ) {}
}
