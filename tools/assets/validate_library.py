"""Validate delivered files and content coverage without touching the game code."""
from pathlib import Path
import hashlib
import json
import wave
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/pottery-v1'
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
economy=json.loads((ROOT/'src/content/economy.json').read_text(encoding='utf-8'))
assets=manifest['assets']
errors=[]
def require(condition,message):
    if not condition:errors.append(message)

ids={a['id'] for a in assets}
require(len(ids)==len(assets),'Duplicate asset IDs')
for site in economy['sites']:
    for key in ('sceneId','stoneAssetId'):require(site[key] in ids,'Missing '+site[key])
for kind,rows,prefix in [('work',economy['works'],'work_'),('relic',economy['relics']['catalog'],'relic_'),('upgrade',economy['insightUpgrades'],'upgrade_'),('target',economy['bonusTargets'],'target_')]:
    for row in rows:require(prefix+row['id'] in ids,'Missing '+kind+': '+row['id'])
require(sum(a['category']=='achievement' for a in assets)==24,'Expected 24 achievement stamps')
require(sum(a['category']=='portrait' for a in assets)==8,'Expected 8 mythological portraits')
audio_stats=[]
for asset in assets:
    p=ROOT/asset['exportFile']
    require(p.is_file(),'Missing export '+str(p))
    if not p.is_file():continue
    require(hashlib.sha256(p.read_bytes()).hexdigest()==asset['sha256'],'Hash mismatch '+asset['id'])
    require(bool(asset.get('provenance')),'Missing provenance '+asset['id'])
    require((ROOT/asset['sourceFile']).is_file(),'Missing source '+asset['id'])
    if p.suffix=='.png':
        with Image.open(p) as im:
            require(list(im.size)==asset['dimensions'],'Wrong dimensions '+asset['id'])
            if asset['category']!='environment':
                require('A' in im.getbands() and im.getchannel('A').getextrema()[0]==0,'Missing alpha '+asset['id'])
        with Image.open(p) as check:check.verify()
    elif p.suffix=='.svg':
        require(ET.parse(p).getroot().tag.endswith('svg'),'Invalid SVG '+asset['id'])
    elif p.suffix=='.wav':
        with wave.open(str(p),'rb') as wav:
            require(wav.getnchannels()==1 and wav.getsampwidth()==2,'Unexpected audio format '+asset['id'])
            samples=np.frombuffer(wav.readframes(wav.getnframes()),dtype='<i2').astype(float)/32768
        require(len(samples)>0 and np.max(np.abs(samples))<.99,'Empty/clipped audio '+asset['id'])
        seam=abs(float(samples[0]-samples[-1]))
        if asset['loop']:require(seam<.02,'Loop boundary jump '+asset['id'])
        audio_stats.append(dict(id=asset['id'],loop=asset['loop'],boundaryJump=round(seam,6)))
report=dict(technicalChecks='PASS' if not errors else 'FAIL',assetCount=len(assets),errors=errors,artWarnings=manifest['warnings'],audio=audio_stats,limits=['No claim of final art approval','Character rigging and work-layer animation remain pending','No in-game readability or lifecycle verification','Audio listening and final mix remain pending'])
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='audio'},indent=2))
raise SystemExit(bool(errors))
