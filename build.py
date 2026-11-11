from pathlib import Path
import zipfile
import base64
root = Path(__file__).parent
page = (root / 'index.html').read_text()
styles = (root / 'style.css').read_text()
for name in ['morning', 'noon', 'dusk', 'night']:
    relative = f'assets/time-{name}.webp'
    encoded = base64.b64encode((root / relative).read_bytes()).decode('ascii')
    styles = styles.replace(relative, f'data:image/webp;base64,{encoded}')
page = page.replace('<link rel="stylesheet" href="style.css">', '<style>' + styles + '</style>')
for name in ['time-core.js', 'freight-core.js', 'core.js', 'app.js', 'archive-core.js', 'archive-ui.js', 'compare-core.js', 'compare-ui.js', 'gateway-core.js', 'gateway.js']:
    page = page.replace(f'<script src="{name}"></script>', '<script>' + (root / name).read_text() + '</script>')
(root / '跨境日常辅助测算.html').write_text(page)
with zipfile.ZipFile(root / '跨境日常辅助测算_整合版.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['跨境日常辅助测算.html','使用说明.md','index.html','style.css','time-core.js','freight-core.js','core.js','app.js','archive-core.js','archive-ui.js','compare-core.js','compare-ui.js','gateway-core.js','gateway.js','gateway-core.test.cjs','compare-core.test.cjs','archive-core.test.cjs','core.test.cjs','freight-core.test.cjs','time-core.test.cjs','build.py']:
        archive.write(root / name, name)

    for name in ['morning', 'noon', 'dusk', 'night']:
        archive.write(root / f'assets/time-{name}.webp', f'assets/time-{name}.webp')
