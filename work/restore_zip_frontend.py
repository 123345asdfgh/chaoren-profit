from pathlib import Path
import re

p = Path('apps/web/public/legacy/index.html')
s = p.read_text()
s = s.replace('<link rel="stylesheet" href="cream-theme.css">', '<link rel="stylesheet" href="cream-theme.css"><link rel="stylesheet" href="profit-overrides.css">', 1)
s = s.replace('<div class="dashboard-utilities"><button id="gateway-replay"', '<div class="dashboard-utilities"><button id="open-settings" class="text-btn" type="button" aria-haspopup="dialog" aria-controls="settings-dialog">统一配置 ⚙</button><button id="gateway-replay"', 1)
s = s.replace('<input id="fx" type="number" min="0.000001" max="1000000000" step="any" value="6.8" aria-label="结算汇率，1美元对应人民币">', '<input id="fx-display" type="text" value="6.8" readonly aria-label="当前结算汇率；请在统一配置中修改">', 1).replace('<label for="fx" title="1美元对应人民币（RMB/💲）">', '<label for="fx-display" title="1美元对应人民币（RMB/💲）">', 1)
dialog = '<dialog id="settings-dialog" class="settings-dialog" aria-labelledby="settings-title"><div class="settings-dialog-head"><h2 id="settings-title">统一配置</h2><button id="close-settings" type="button" aria-label="关闭统一配置">关闭 ✕</button></div><form id="settings-form"><h3>基础业务参数</h3><div id="setting-fields" class="settings-grid"></div><h3>六项费用</h3><div id="fee-fields" class="settings-grid"></div><p class="small">版权费按产品成本，其余五项按真实营业收入。</p><h3>物流计费参数</h3><div id="freight-fields" class="settings-grid"></div><details class="advanced-settings"><summary>物流渠道价表与计费模式</summary><div id="channel-fields"></div></details><details class="advanced-settings"><summary>包装尺寸及重量系数</summary><div id="pack-fields"></div></details><details class="advanced-settings"><summary>商品属性与物流渠道</summary><div id="route-fields"></div></details><p id="settings-message" class="small" role="status" aria-live="polite"></p><div class="settings-actions"><button id="reset-settings" type="button">恢复全部默认值</button><button class="primary" type="submit">保存配置</button></div></form></dialog>'
s, n = re.subn(r'<details id="settings" class="settings">.*?</details>', dialog, s, count=1, flags=re.S)
assert n == 1
s = s.replace('<script src="archive-core.js"></script><script src="archive-ui.js"></script>', '<script src="archive-db.js"></script>', 1)
s = s.replace('<script src="app.js"></script>', '<script src="app.js"></script><script src="settings.js"></script>', 1)
s = s.replace('存档仅保存在当前浏览器、当前链接中，不上传服务器；下次请使用相同浏览器和链接打开。清除浏览器数据、隐私模式或更换设备可能导致存档不可用。', '存档保存在数据库；登录后可在其他设备查看。', 1)
p.write_text(s)
