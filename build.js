const esbuild = require('esbuild');
const watch = process.argv.includes('--watch');

const entries = [
  { in: 'src/content/detector.ts',         out: 'content/detector.js' },
  { in: 'src/background/service-worker.ts', out: 'background/service-worker.js' },
  { in: 'src/popup/popup.ts',              out: 'popup/popup.js' },
];

const opts = entries.map(e => ({
  entryPoints: [e.in],
  outfile: e.out,
  bundle: true,
  target: 'chrome120',
  format: 'iife',
  minify: false,
  sourcemap: false,
}));

if (watch) {
  Promise.all(opts.map(o => esbuild.context(o).then(ctx => ctx.watch()))).then(() => {
    console.log('Watching for changes...');
  });
} else {
  Promise.all(opts.map(o => esbuild.build(o))).then(() => {
    console.log('Build complete.');
  }).catch(() => process.exit(1));
}
