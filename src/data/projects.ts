export type Language = 'Swift' | 'TypeScript' | 'Shell';

export interface Project {
  title: string;
  repo: string;
  description: string;
  tags: string[];
  language: Language;
  postLink?: string;
}

export interface FeaturedProject extends Project {
  version: string;
  install: string;
}

export interface ProjectGroup {
  caption: string;
  projects: Project[];
}

const repo = (name: string) => `https://github.com/FlorianRiquelme/${name}`;

export const featured: FeaturedProject = {
  title: 'screengrab',
  repo: repo('screengrab'),
  description:
    'screenshot to ai agent in three keystrokes. a macos menu bar app: capture, copy the path, paste it into claude code or codex. markup, blur, scrolling capture, text recognition and screen recording, all on your mac.',
  tags: ['swift', 'macos'],
  language: 'Swift',
  postLink: '/blog/screengrab-1-0/',
  version: 'v1.0.0',
  install: 'brew install --cask FlorianRiquelme/tap/screengrab',
};

export const groups: ProjectGroup[] = [
  {
    caption: 'running agents',
    projects: [
      {
        title: 'nachtschicht',
        repo: repo('nachtschicht'),
        description:
          'autonomous task queue for claude code with a trust protocol. each task runs in its own git worktree, gets verified against its blast radius, and ends in a morning brief you can merge from.',
        tags: ['claude code', 'autonomy', 'trust protocol'],
        language: 'TypeScript',
      },
      {
        title: 'cmux-workspace-tools',
        repo: repo('cmux-workspace-tools'),
        description:
          'supervising ~10 parallel claude code sessions in cmux: ws lays out a workspace, stage lets a session put its output on screen, fleet colours the sidebar by who needs attention.',
        tags: ['cmux', 'claude code', 'shell'],
        language: 'Shell',
      },
      {
        title: 'claudefuel',
        repo: repo('claudefuel'),
        description:
          'a fuel gauge for claude code. three-line status bar showing context, session and weekly limits, and reset times. installs by reading a markdown file.',
        tags: ['claude code', 'statusline', 'promptfile'],
        language: 'Shell',
        postLink: '/blog/designing-for-the-operator/',
      },
    ],
  },
  {
    caption: 'guardrails',
    projects: [
      {
        title: 'ddev-claude',
        repo: repo('ddev-claude'),
        description:
          'ddev addon that runs claude code in a sandboxed container behind a default-deny firewall, so autonomous mode cannot exfiltrate code to hosts you did not whitelist.',
        tags: ['ddev', 'docker', 'claude'],
        language: 'Shell',
      },
      {
        title: 'openrouter-zdr',
        repo: repo('openrouter-zdr'),
        description:
          'openrouter client that only routes to zero-data-retention endpoints. the zdr flag is pinned on every request and cannot be turned off. zero runtime dependencies, on npm.',
        tags: ['openrouter', 'privacy', 'npm'],
        language: 'TypeScript',
      },
      {
        title: 'jev-kit',
        repo: repo('jev-kit'),
        description:
          "typed client and benchmark harness for typesafe ai's jev decision model. run your real questions against labeled data and read accuracy, calibration and cost before a threshold ships.",
        tags: ['evals', 'typescript', 'npm'],
        language: 'TypeScript',
      },
    ],
  },
];

export const projects: Project[] = [featured, ...groups.flatMap((group) => group.projects)];
