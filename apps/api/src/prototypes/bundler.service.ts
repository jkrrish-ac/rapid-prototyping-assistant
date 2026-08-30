import { Injectable, Logger } from '@nestjs/common';
import * as esbuild from 'esbuild';
import * as path from 'path';

const CDN_IMPORT_MAP: Record<string, string> = {
  react: 'https://esm.sh/react@18.3.1',
  'react-dom': 'https://esm.sh/react-dom@18.3.1',
  'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client',
  'react-router-dom': 'https://esm.sh/react-router-dom@6.26.2?deps=react@18.3.1,react-dom@18.3.1',
  'lucide-react': 'https://esm.sh/lucide-react@0.446.0?deps=react@18.3.1',
  'framer-motion':
    'https://esm.sh/framer-motion@11.11.9?deps=react@18.3.1,react-dom@18.3.1',
};

const TEXT_LOADERS: Record<string, esbuild.Loader> = {
  tsx: 'tsx',
  ts: 'ts',
  jsx: 'jsx',
  js: 'js',
  json: 'json',
};

/**
 * Bundles an AI-generated React prototype's virtual file set (no disk I/O)
 * into a single ESM bundle for the platform's in-workspace live preview.
 *
 * Scope note: Vue prototypes are not live-bundled here (a .vue SFC compiler
 * is a heavier dependency than this MVP pulls in) — the preview endpoint
 * returns a friendly "download to run locally" message for framework:'vue'.
 * The downloadable zip is complete and correct for both frameworks either way.
 */
@Injectable()
export class BundlerService {
  private readonly logger = new Logger(BundlerService.name);

  /**
   * Per-file syntax validation, independent of bundling. Used right after
   * BUILD/FIX generate code so a broken file (unbalanced braces, malformed
   * JSX, invalid JSON) gets caught and looped back to the AI immediately
   * instead of surfacing only later when the user opens Preview. Framework-
   * agnostic: validates any .ts/.tsx/.js/.jsx/.json file whether the
   * prototype is React or Vue (Vue's own .vue SFC files are skipped — esbuild
   * can't parse SFC syntax without a dedicated plugin this MVP doesn't pull
   * in, so those still only get caught by the full React bundle/preview).
   */
  async validateFiles(
    files: { path: string; content: string }[],
  ): Promise<{ ok: boolean; errors: { path: string; message: string }[] }> {
    const errors: { path: string; message: string }[] = [];
    for (const f of files) {
      const ext = f.path.split('.').pop()?.toLowerCase() ?? '';
      if (ext === 'json') {
        try {
          JSON.parse(f.content);
        } catch (err: any) {
          errors.push({ path: f.path, message: `Invalid JSON: ${err?.message ?? 'parse error'}` });
        }
        continue;
      }
      const loader = TEXT_LOADERS[ext];
      if (!loader) continue; // not a source file we can syntax-check (css, md, .vue SFCs, ...)
      try {
        await esbuild.transform(f.content, { loader, jsx: 'automatic' });
      } catch (err: any) {
        const detail = err?.errors?.[0];
        const message = detail
          ? `${detail.text}${detail.location ? ` (line ${detail.location.line}, col ${detail.location.column})` : ''}`
          : err?.message ?? 'Syntax error.';
        errors.push({ path: f.path, message });
      }
    }
    return { ok: errors.length === 0, errors };
  }

  async bundleReact(files: { path: string; content: string }[]): Promise<{
    ok: boolean;
    js?: string;
    error?: string;
  }> {
    const fileMap = new Map(files.map((f) => [this.normalize(f.path), f.content]));
    const entry = this.findEntry(fileMap);
    if (!entry) {
      return {
        ok: false,
        error:
          'No entry point found. BUILD output must include src/main.tsx (or src/main.jsx) rendering <App /> into #root.',
      };
    }

    try {
      const result = await esbuild.build({
        stdin: undefined,
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        target: 'es2020',
        jsx: 'automatic',
        loader: { '.css': 'empty' },
        logLevel: 'silent',
        plugins: [this.virtualFsPlugin(fileMap)],
      });
      const output = result.outputFiles?.[0]?.text ?? '';
      return { ok: true, js: output };
    } catch (err: any) {
      this.logger.warn(`Bundle failed: ${err?.message}`);
      return { ok: false, error: err?.message ?? 'Unknown bundling error.' };
    }
  }

  buildPreviewHtml(bundleJs: string, extraDependencies: string[] = []): string {
    const importMap: Record<string, string> = { ...CDN_IMPORT_MAP };
    for (const dep of extraDependencies) {
      if (!importMap[dep]) {
        importMap[dep] = `https://esm.sh/${dep}?deps=react@18.3.1,react-dom@18.3.1`;
      }
    }

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.tailwindcss.com"></script>
<script type="importmap">${JSON.stringify({ imports: importMap })}</script>
<style>html,body,#root{height:100%;margin:0;} body{font-family:ui-sans-serif,system-ui,sans-serif;}</style>
</head>
<body>
<div id="root"></div>
<script type="module">
${bundleJs}
</script>
</body>
</html>`;
  }

  buildUnsupportedPreviewHtml(reason: string): string {
    return `<!doctype html>
<html><body style="font-family:ui-sans-serif,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#334155;">
<div style="max-width:480px;text-align:center;padding:24px;">
<h1 style="font-size:1.1rem;margin-bottom:8px;">Live preview unavailable</h1>
<p style="font-size:0.9rem;line-height:1.5;">${reason}</p>
</div>
</body></html>`;
  }

  private normalize(p: string): string {
    return p.replace(/^\.\//, '').replace(/^\//, '');
  }

  private findEntry(fileMap: Map<string, string>): string | null {
    const candidates = ['src/main.tsx', 'src/main.jsx', 'src/main.ts', 'src/index.tsx'];
    for (const c of candidates) {
      if (fileMap.has(c)) return c;
    }
    return null;
  }

  private resolveVirtual(fromDir: string, importPath: string, fileMap: Map<string, string>) {
    const joined = path.posix.normalize(path.posix.join(fromDir, importPath));
    const candidates = [
      joined,
      `${joined}.tsx`,
      `${joined}.ts`,
      `${joined}.jsx`,
      `${joined}.js`,
      `${joined}/index.tsx`,
      `${joined}/index.ts`,
    ];
    return candidates.find((c) => fileMap.has(c)) ?? null;
  }

  private virtualFsPlugin(fileMap: Map<string, string>): esbuild.Plugin {
    return {
      name: 'virtual-fs',
      setup: (build) => {
        build.onResolve({ filter: /.*/ }, (args) => {
          // The entry point itself (e.g. "src/main.tsx") is a bare-looking
          // path with no leading "./" or "/" — without this check it falls
          // through to the "bare specifier" branch below and esbuild refuses
          // to bundle because "the entry point cannot be marked as external".
          if (args.kind === 'entry-point') {
            const normalized = this.normalize(args.path);
            if (fileMap.has(normalized)) return { path: normalized, namespace: 'virtual' };
            return {
              errors: [{ text: `Entry point "${args.path}" not found among the generated files.` }],
            };
          }
          if (args.path.startsWith('.') || args.path.startsWith('/')) {
            const fromDir = args.importer ? path.posix.dirname(args.importer) : 'src';
            const resolved = this.resolveVirtual(fromDir, args.path, fileMap);
            if (resolved) return { path: resolved, namespace: 'virtual' };
            return {
              errors: [{ text: `Cannot resolve "${args.path}" from "${args.importer}".` }],
            };
          }
          // Bare specifiers (react, react-router-dom, lucide-react, ...) are
          // left external and resolved client-side via the preview's import map.
          return { path: args.path, external: true };
        });

        build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
          const content = fileMap.get(args.path) ?? '';
          const ext = args.path.split('.').pop() ?? 'ts';
          const loader = TEXT_LOADERS[ext] ?? 'text';
          return {
            contents: content,
            loader,
            resolveDir: path.posix.dirname(args.path),
          };
        });
      },
    };
  }
}
