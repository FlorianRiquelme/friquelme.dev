import { featured, groups, type Project } from '../../data/projects';

export interface WorkshopProject {
  id: string;
  title: string;
  description: string;
  repo: string;
  tags: string[];
  language: string;
  postLink?: string;
  version?: string;
  install?: string;
}

export function projectIdFromRepo(repo: string): string {
  const url = new URL(repo);
  if (url.hostname !== 'github.com') throw new Error(`Unsupported project host: ${url.hostname}`);
  const id = url.pathname.split('/').filter(Boolean).at(-1);
  if (!id) throw new Error(`Project URL has no repository name: ${repo}`);
  return id;
}

function toWorkshopProject(project: Project, extra: Pick<WorkshopProject, 'version' | 'install'> = {}): WorkshopProject {
  return {
    id: projectIdFromRepo(project.repo),
    title: project.title,
    description: project.description,
    repo: project.repo,
    tags: project.tags,
    language: project.language,
    ...(project.postLink ? { postLink: project.postLink } : {}),
    ...(extra.version ? { version: extra.version } : {}),
    ...(extra.install ? { install: extra.install } : {}),
  };
}

const allProjects = [toWorkshopProject(featured, { version: featured.version, install: featured.install }), ...groups.flatMap((group) => group.projects).map((project) => toWorkshopProject(project))];

const seen = new Set<string>();
for (const project of allProjects) {
  if (seen.has(project.id)) throw new Error(`Duplicate workshop project id: ${project.id}`);
  seen.add(project.id);
}

export const workshopProjects = allProjects;
export const workshopProjectIds = allProjects.map((project) => project.id);
