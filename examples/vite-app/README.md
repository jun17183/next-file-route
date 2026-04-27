# next-file-route — Vite example

Minimal Vite project that exercises the `fileRouteVite()` plugin end-to-end.

There are no React pages here on purpose — the goal is to verify that:

1. The plugin scans `app/**/{page,layout}.meta.{ts,tsx,js,jsx}`
2. It writes the manifest + `routes.d.ts` to `node_modules/next-file-route/.generated/`
3. The bundler resolves `next-file-route/.generated/manifest` via the alias
4. Search-schema imports resolve to live Zod instances (not strings)

`src/main.ts` imports the manifest, exercises one search schema, and logs.
A successful `vite build` proves the plugin pipeline works.

## Run it

```bash
npm install
npm run sync     # one-shot scan; vite plugin would also do this on dev/build
npm run build    # exercises fileRouteVite end-to-end
node dist/main.js
```

Expected output of `node dist/main.js`:

```
routes: [ '/', '/products', '/admin' ]
layouts: [ '/admin' ]
search-schema routes: [ '/products' ]
match("/products"): /products
parsed: { page: 2, sort: 'desc' }
```
