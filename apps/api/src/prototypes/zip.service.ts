import { Injectable } from '@nestjs/common';
import archiver from 'archiver';
import type { Response } from 'express';
import {
  indexHtml,
  INDEX_CSS,
  packageJson,
  POSTCSS_CONFIG,
  readme,
  TAILWIND_CONFIG,
  tsconfigJson,
  viteConfig,
} from './scaffold-templates';

@Injectable()
export class ZipService {
  streamProjectZip(
    res: Response,
    params: {
      projectName: string;
      framework: 'react' | 'vue';
      files: { path: string; content: string }[];
      dependencies: string[];
      decisionsMarkdown: string;
      understandSummary: string;
      chosenApproach: string;
      mocked: string[];
      knownIssues: string[];
      nextSteps: string[];
    },
  ) {
    const slug =
      params.projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') ||
      'prototype';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      res.status(500).end(String(err));
    });
    archive.pipe(res);

    const root = `${slug}/`;

    // AI-generated source files
    for (const f of params.files) {
      const cleanPath = f.path.replace(/^\.?\/?/, '');
      archive.append(f.content, { name: `${root}${cleanPath}` });
    }

    // Ensure an index.css with Tailwind directives exists even if BUILD didn't emit one
    if (!params.files.some((f) => f.path.replace(/^\.?\/?/, '') === 'src/index.css')) {
      archive.append(INDEX_CSS, { name: `${root}src/index.css` });
    }

    // Static scaffold
    archive.append(packageJson(params.projectName, params.framework, params.dependencies), {
      name: `${root}package.json`,
    });
    archive.append(TAILWIND_CONFIG, { name: `${root}tailwind.config.js` });
    archive.append(POSTCSS_CONFIG, { name: `${root}postcss.config.js` });
    archive.append(tsconfigJson(params.framework), { name: `${root}tsconfig.json` });
    archive.append(viteConfig(params.framework), { name: `${root}vite.config.ts` });
    archive.append(indexHtml(params.projectName, params.framework), {
      name: `${root}index.html`,
    });
    archive.append(
      readme({
        projectName: params.projectName,
        understandSummary: params.understandSummary,
        chosenApproach: params.chosenApproach,
        framework: params.framework === 'react' ? 'React' : 'Vue 3',
        mocked: params.mocked,
        knownIssues: params.knownIssues,
        nextSteps: params.nextSteps,
      }),
      { name: `${root}README.md` },
    );
    archive.append(params.decisionsMarkdown, { name: `${root}DECISIONS.md` });

    return archive.finalize();
  }
}
