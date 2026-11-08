"""Pack dist/ into one HTML file for publishing (run after `npm run build`).

    python3 scripts/single-file.py OUT.html

Inlines the app's own stylesheet and script from dist/assets; external
links (Google Fonts) stay as they are. Fails loudly if anything from
assets/ is left unlinked, so a broken page is never published.
"""
import glob, re, sys

out = sys.argv[1] if len(sys.argv) > 1 else 'dist/single.html'
h = open('dist/index.html').read()
css = open(glob.glob('dist/assets/*.css')[0]).read()
js = open(glob.glob('dist/assets/*.js')[0]).read().replace('</script', '<\\/script')
h = re.sub(r'<link rel="stylesheet"[^>]*href="\.?/?assets/[^"]*"[^>]*>', lambda m: '<style>' + css + '</style>', h)
h = re.sub(r'<script type="module"[^>]*src="\.?/?assets/[^"]*"[^>]*></script>', lambda m: '<script type="module">' + js + '</script>', h)
left = re.findall(r'(?:href|src)="\.?/?assets/[^"]*"', h)
if left or '<style>' not in h:
    sys.exit(f'single-file: not inlined: {left or "stylesheet"}')
open(out, 'w').write(h)
print(f'single-file: wrote {out} ({len(h)} bytes)')
