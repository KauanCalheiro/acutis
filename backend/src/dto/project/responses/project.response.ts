export type {
    Project as ProjectResponse,
    ProjectDetail as ProjectShowResponse,
    ProjectsResponse
} from '@acutis/contracts/project'

export interface PaginatedResponse<T> {
    data: T[]
    meta: {
        current_page: number
        per_page: number
        total: number
    }
}
