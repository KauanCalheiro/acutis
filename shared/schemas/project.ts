import {
  cloneProjectSchema,
  createProjectSchema,
  type CloneProjectData,
  type CreateProjectRequest
} from '#shared/contracts/project'

export { cloneProjectSchema, createProjectSchema }

export type CloneProject = CloneProjectData
export type CreateProject = CreateProjectRequest
export type ProjectFormTab = 'template' | 'git'
