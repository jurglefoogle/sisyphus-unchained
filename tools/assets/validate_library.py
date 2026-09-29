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
delivery_path=OUT/'delivery.json'
queue=json.loads((ROOT/'docs/art-direction/asset-generation-queue-v1.json').read_text(encoding='utf-8'))
queued_ids=set()
for task in queue['tasks']:
    require(task['id'] not in queued_ids,'Duplicate generation task '+task['id'])
    require(task['reference'] in ids|queued_ids,'Unavailable generation reference '+task['reference'])
    require(bool(task['prompt'].strip()),'Missing generation prompt '+task['id'])
    require(task['output']=='public/assets/pottery-v1/art/'+task['id']+'.png','Unexpected generation destination '+task['id'])
    queued_ids.add(task['id'])
if delivery_path.exists():
    delivery=json.loads(delivery_path.read_text(encoding='utf-8'))
    for name,state in [('bare',delivery['assets']['sisyphus']['states']['walk']),('wrapped',delivery['assets']['sisyphus']['variants']['feet_wrapped']['states']['walk'])]:
        baselines=[]
        for layer in state['layers']:
            source=ROOT/'public'/layer['frame']['url'].lstrip('/')
            x,y,w,h=layer['frame']['rect']
            with Image.open(source) as im:
                alpha=im.getchannel('A').crop((x,y,x+w,y+h)).point(lambda value:255 if value>=128 else 0)
                bounds=alpha.getbbox()
            require(bounds is not None,f'Empty {name} walk frame')
            if bounds:
                require(bounds[0]>=12 and w-bounds[2]>=12,f'Clipped {name} walk frame {layer["id"]}')
                require(abs((bounds[0]+bounds[2])/2-w/2)<=2,f'Unregistered {name} walk frame {layer["id"]}')
                baselines.append(bounds[3])
        require(max(baselines)-min(baselines)<=2,f'Unaligned {name} walk foot baseline')
    for asset,spec in delivery['assets'].items():
        for name,state in spec['states'].items():
            if state['status']!='available':
                for planned in state.get('plannedAssets',[]):
                    require(planned in queued_ids,'Missing generation task '+planned)
            for layer in state['layers']:
                require((ROOT/'public'/layer['frame']['url'].lstrip('/')).is_file(),'Missing state layer '+asset+'/'+name)
                require(layer['frame']['assetId'] in ids,'Unregistered state layer '+layer['frame']['assetId'])
report=dict(technicalChecks='PASS' if not errors else 'FAIL',assetCount=len(assets),errors=errors,artWarnings=manifest['warnings'],audio=audio_stats,limits=['No claim of final art approval','See coverage.json for blocked image-generation states and wrapped-feet variant','No in-game readability or lifecycle verification','Audio listening and final mix remain pending'])
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='audio'},indent=2))
raise SystemExit(bool(errors))
