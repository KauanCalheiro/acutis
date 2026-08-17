import {
  cloneProjectSchema,
  createProjectSchema,
  type CloneProjectData,
  type CreateProjectRequest
} from '@acutis/contracts/project'

export { cloneProjectSchema, createProjectSchema }

export type CloneProject = CloneProjectData
export type CreateProject = CreateProjectRequest
export type ProjectFormTab = 'template' | 'git'
