export class AuthConfigured {
    constructor(
        readonly project: string,
        readonly source: 'recording' | 'editor'
    ) {}
}
