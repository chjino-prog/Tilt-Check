import { defineConfig, type Plugin } from 'vite';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

/**
 * 빌드 후 dist/sw.js 에 '미리 저장할 파일 목록'과 버전을 써 넣는다.
 * → 첫 접속 뒤에는 비행기 모드에서도 앱이 열린다.
 */
function precacheList(): Plugin {
  let outDir = 'dist';
  return {
    name: 'tiltcheck-precache',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).replace(/\\/g, '/'));
        }
      };
      walk(outDir);
      const list = files.filter((f) => f !== 'sw.js').map((f) => './' + f);
      list.unshift('./');
      const swPath = join(outDir, 'sw.js');
      const stamp = `${pkg.version}-${Date.now().toString(36)}`;
      const sw = readFileSync(swPath, 'utf-8')
        .replace("'__VERSION__'", JSON.stringify(stamp))
        .replace('[/*__ASSETS__*/]', JSON.stringify(list, null, 2));
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  // GitHub Actions 에서는 BASE_PATH=/<저장소명>/ 을 넘긴다. 그 밖에는 상대 경로.
  base: process.env.BASE_PATH || './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  plugins: [precacheList()],
  build: {
    target: 'es2020',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
