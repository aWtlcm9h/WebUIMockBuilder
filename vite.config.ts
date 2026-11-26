import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { etagOf, readText, resolveFile, writeText } from './mcp/projectFile';

/**
 * プロジェクトファイル（*.uimock.json）を読み書きする小さなAPI。
 * ビルダーがファイルと同期するために使う（MCP サーバー経由のエージェントの編集を画面に反映する）。
 * 開発サーバーは同じマシン（localhost）からしか接続できず、対象は *.uimock.json に限る。
 */
function projectFileApi(): Plugin {
  const handler: Connect.NextHandleFunction = (req: IncomingMessage, res: ServerResponse, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/project')) return next();
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    try {
      const requested = url.searchParams.get('file');
      // ファイルの指定も環境変数もなければ、ファイル連携は無効
      if (!requested && !process.env.UIMOCK_FILE) return send(200, { enabled: false });
      const path = resolveFile(requested);
      if (url.pathname === '/api/project/etag') return send(200, { enabled: true, file: path, etag: etagOf(path) });
      if (req.method === 'GET') return send(200, { enabled: true, file: path, etag: etagOf(path), text: readText(path) });
      if (req.method === 'PUT') {
        // 他サイトのページからの書き込みを防ぐ
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) return send(403, { error: 'forbidden' });
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            JSON.parse(body);
            // 保存する側が最後に読んだ版から変わっていたら、上書きせずに衝突を返す
            const base = req.headers['x-base-etag'];
            const current = etagOf(path);
            if (typeof base === 'string' && (current ?? '') !== base) return send(409, { conflict: true, etag: current });
            send(200, { enabled: true, file: path, etag: writeText(path, body) });
          } catch (e) {
            send(400, { error: (e as Error).message });
          }
        });
        return;
      }
      send(405, { error: 'method not allowed' });
    } catch (e) {
      send(400, { error: (e as Error).message });
    }
  };
  return {
    name: 'uimock-project-file-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  plugins: [react(), projectFileApi()],
  server: { port: 5180 },
});
