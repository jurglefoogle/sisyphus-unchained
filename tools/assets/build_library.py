"""Build original vector symbols, synthesized audio studies, and the asset catalog.

Raster art is inspected only: this script never edits generated images.
Requires Pillow and NumPy. Run from any working directory.
"""
from pathlib import Path
from collections import Counter
import hashlib
import html
import json
import math
import wave
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/pottery-v1'
SOURCE = 'tools/assets/build_library.py'
INK, CLAY, PALE, PAPER, BRONZE = '#211B17', '#B65D35', '#D99C6C', '#EBDCC0', '#A57B3B'
ASSETS = []

def record(asset_id, category, path, **extra):
    ASSETS.append(dict(id=asset_id, category=category,
        url='/assets/pottery-v1/' + path.relative_to(OUT).as_posix(),
        exportFile=path.relative_to(ROOT).as_posix(),
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(), **extra))

def svg(asset_id, category, body, size=(64, 64), pivot=(.5, .5), status='review-ready symbol'):
    p = OUT / 'icons' / (asset_id + '.svg')
    w, h = size
    p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>{html.escape(asset_id.replace("_", " "))}</title><g fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">{body}</g></svg>', encoding='utf-8')
    record(asset_id, category, p, dimensions=[w,h], pivot=list(pivot), sourceFile=SOURCE,
        provenance='Original code-authored vector for this project; no external assets.',
        status=status, hasTransparency=True)

MOTIFS = {
 'obols':'<circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="17"/><path d="M22 35q10-18 20 0M22 39h20M28 25v15m8-15v15"/>',
 'insight':'<path d="M32 8 40 24 56 32 40 40 32 56 24 40 8 32 24 24Z"/><circle cx="32" cy="32" r="6"/>',
 'push':'<path d="M10 32h35M34 19l13 13-13 13"/><path d="M8 20v24"/>',
 'strength':'<path d="M12 48V33l9-17 10 3-4 13 11 4 4-10 10 4-2 18Z"/>',
 'impact':'<path d="m15 10 10 18 15-4 8 11-16 7Z M12 52l12-7m8 3v9m10-13 12 6"/>',
 'wheel':'<circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="5"/><path d="M32 9v18m0 10v18M9 32h18m10 0h18M16 16l12 12m8 8 12 12M16 48l12-12m8-8 12-12"/>',
 'foreman':'<circle cx="25" cy="18" r="8"/><path d="M12 51V37q13-14 26 0v14M45 23v31m-6-27 6-7 7 7"/>',
 'milestone':'<path d="M15 54V12h30l-8 11 8 11H15M8 54h22"/>',
 'decree':'<path d="M17 12h32v38H20q-9 0-9-7t9-7h29M17 12q-8 0-8 7h8Z"/><path d="M26 21h15m-15 7h15"/>',
 'archive':'<path d="M10 12h19q5 0 5 6v36q-5-7-12-7H10ZM54 12H39q-5 0-5 6v36q5-7 12-7h8Z"/>',
 'settings':'<circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="5"/><path d="M32 8v11m0 26v11M8 32h11m26 0h11M15 15l8 8m18 18 8 8M15 49l8-8m18-18 8-8"/>',
 'pause':'<path d="M21 12v40m22-40v40" stroke-width="9"/>',
 'play':'<path d="m20 10 32 22-32 22Z"/>',
 'close':'<path d="m15 15 34 34M49 15 15 49"/>',
 'back':'<path d="M53 32H12l18-18M12 32l18 18"/>',
 'next':'<path d="M11 32h41L34 14M52 32 34 50"/>',
 'sound':'<path d="M10 25h10l14-12v38L20 39H10ZM42 23q10 9 0 18m5-28q19 19 0 38"/>',
 'music':'<path d="M25 44V16l27-6v29M25 24l27-6"/><ellipse cx="17" cy="47" rx="8" ry="6"/><ellipse cx="44" cy="42" rx="8" ry="6"/>',
 'save':'<path d="M12 9h33l8 8v38H12ZM21 9v17h22V9M22 55V37h22v18"/>',
 'offline':'<circle cx="32" cy="32" r="23"/><path d="M32 17v17l12 6M8 10v14h14"/>',
 'prestige':'<path d="M12 28a21 21 0 1 1 3 22M12 10v18h18"/><path d="m32 22 9 10-9 10-9-10Z"/>',
 'lock':'<rect x="15" y="27" width="34" height="28" rx="3"/><path d="M22 27V18a10 10 0 0 1 20 0v9M32 38v7"/>',
 'check':'<path d="m10 32 15 15 30-31"/>',
 'empire':'<path d="m6 49 12-23 12 23 13-35 15 35ZM18 26v-8m25-4V8"/>',
 'wing':'<path d="M10 42Q15 12 54 12L40 26H23m26-5L35 35H20m22-6L30 44H14M10 42l-2 10 17-4"/>',
 'pin':'<path d="m17 49 26-30m-4-9 13 12M12 54l5-14 8 7Z"/><circle cx="45" cy="16" r="8"/>',
 'vessel':'<path d="M25 10h14v12q16 5 12 20T32 55Q9 54 13 37q0-10 12-15ZM24 19Q8 12 8 29q0 10 7 9m25-19q16-7 16 10 0 10-7 9M23 38h18"/>',
 'ampoule':'<path d="M25 8h14v10l7 12v23H18V30l7-12ZM23 36h18M25 14h14"/>',
 'sky':'<path d="m15 12 36 10-9 31-31-9Z M32 20v19m-9-10h18m-16-7 14 14m0-14L25 36"/>',
 'bolt':'<path d="m35 7-20 28h16l-3 22 21-31H34Z"/>',
 'support':'<path d="M8 15h48M15 15v39m34-39v39M15 48 49 21M15 21l34 27M9 54h12m22 0h12"/>',
 'water':'<path d="M32 8Q9 34 16 45q16 20 32 0Q55 34 32 8Z M24 39q0 8 8 9"/>',
 'hand':'<path d="M14 35V24q0-7 6-4V12q3-5 6 0v13-15q3-5 6 0v15-11q3-5 6 0v17l7-5q8-2 5 5L38 53H23Z"/>',
 'memory':'<path d="M13 32q0-23 19-23t19 23q0 22-19 22M32 18q12 0 12 14T32 45q-13 0-13-13 0-7 7-7t7 7"/>',
 'debris':'<path d="m8 42 12-16 7 22ZM32 20l17 8-12 10ZM36 45l17-6 4 14Z"/>',
 'scroll':'<path d="M15 12h36v36H20q-10 0-10-8h41M15 12q-7 0-7 8h7ZM24 23h19m-19 8h14"/>',
}

def build_vectors(economy):
    ui = ['obols','insight','push','strength','impact','wheel','foreman','milestone','decree','archive','settings','pause','play','close','back','next','sound','music','save','offline','prestige','lock','check','empire']
    for name in ui:
        svg('ui_'+name, 'interface', MOTIFS[name])
    relics = dict(hermes_seal='wing', daedalus_pin='pin', danaid_handle='vessel', ichor_ampoule='ampoule', atlas_shard='sky', zeus_seal='bolt')
    for name,motif in relics.items():
        body=f'<circle cx="48" cy="48" r="40" fill="{PAPER}" stroke="{BRONZE}"/><g transform="translate(16 16)">{MOTIFS[motif]}</g>'
        svg('relic_'+name, 'relic', body, (96,96))
    upgrades=['hand','wheel','decree','empire','scroll','offline','water','memory']
    for data,motif in zip(economy['insightUpgrades'],upgrades):
        svg('upgrade_'+data['id'], 'insight-upgrade', MOTIFS[motif])
    achievements=[('first_summit','milestone'),('first_return','back'),('first_purchase','obols'),('ten_levels','strength'),('first_wheel','wheel'),('first_auto','foreman'),('first_hermes','wing'),('first_expansion','empire'),('first_daedalus','pin'),('first_ixion','wheel'),('first_danaids','water'),('first_talos','ampoule'),('first_atlas','sky'),('first_relic','insight'),('full_relics','vessel'),('first_prestige','prestige'),('record_prestige','memory'),('old_site_50','support'),('million','obols'),('billion','decree'),('trillion','archive'),('all_sites','empire'),('level_100','milestone'),('charter','bolt')]
    for index,(name,motif) in enumerate(achievements):
        ticks=''.join(f'<path d="M64 10v5" transform="rotate({j*15} 64 64)"/>' for j in range(index+1))
        body=f'<circle cx="64" cy="64" r="58" fill="{PAPER}"/><circle cx="64" cy="64" r="47" stroke="{BRONZE}"/>{ticks}<g transform="translate(32 32)">{MOTIFS[motif]}</g>'
        svg('achievement_'+name, 'achievement', body, (128,128))
    for name,motif in [('debris','debris'),('coin_amphora','vessel'),('gilded_offering','vessel')]:
        extra=f'<circle cx="32" cy="36" r="7" fill="{BRONZE}"/>' if name=='gilded_offering' else ''
        svg('target_'+name, 'target', MOTIFS[motif]+extra, pivot=(.5,.86))
    props={
      'scaffold':MOTIFS['support'],
      'bronze_support':'<path d="M9 12h46v8H9ZM18 20v34h8V20m12 0v34h8V20M12 54h40" fill="'+BRONZE+'"/>',
      'flywheel_stand':'<path d="M8 54 27 16h10l19 38ZM16 54h32M27 16v12h10V16"/>',
      'capture_paddle':'<path d="M10 36h43v9H10ZM24 36V16h13v20M30 45v10" fill="'+BRONZE+'"/>',
      'belt_segment':'<path d="M8 24h48v6H8ZM8 38h48v6H8Z" fill="'+INK+'"/>',
      'rope_segment':'<path d="M8 32h48" stroke-width="6" stroke="'+BRONZE+'"/><path d="m12 29 4 6m4-6 4 6m4-6 4 6m4-6 4 6m4-6 4 6" stroke-width="1"/>',
      'pottery_chip':'<path d="m17 13 32 11-16 28-20-9Z" fill="'+CLAY+'"/>',
      'water_drop':MOTIFS['water'],
      'reward_spark':MOTIFS['insight'],
    }
    for name,body in props.items():
        svg('prop_'+name,'prop',body,status='geometric component study')
    # Deterministic route geometry is separate from generated environmental art.
    kits=[('clay',CLAY,PALE),('underworld',INK,CLAY),('celestial',PAPER,BRONZE)]
    for name,fill,line in kits:
        body=f'<path d="M30 400 170 335 350 260 530 180 680 100 720 100 860 390 950 420H30Z" fill="{fill}" stroke="{line}" stroke-width="6"/><path d="M30 420H950M860 390 720 100M170 335l60 45m120-120 60 95m120-175 30 100m120-180-10 110" stroke="{line}" stroke-width="4"/>'
        svg('terrain_'+name,'terrain-kit',body,(1000,480),pivot=(0,0),status='deterministic route geometry study')

RATE=22050
def tone(freq, seconds, kind='pluck'):
    t=np.arange(round(seconds*RATE))/RATE
    if kind=='pluck':
        s=(np.sin(2*np.pi*freq*t)+.32*np.sin(2*np.pi*freq*2*t)+.12*np.sin(2*np.pi*freq*3*t))*np.exp(-4*t/max(seconds,.01))
    elif kind=='reed':
        s=(np.sin(2*np.pi*freq*t)+.15*np.sin(2*np.pi*freq*3*t))*np.sin(np.pi*t/seconds)**2
    else:
        s=np.sin(2*np.pi*(freq*t+24*(1-np.exp(-12*t))))*np.exp(-10*t)
    fade=min(110,len(s)//2)
    s[:fade]*=np.linspace(0,1,fade)
    s[-fade:]*=np.linspace(1,0,fade)
    return s

def write_audio(asset_id, samples, category, loop=False):
    peak=float(np.max(np.abs(samples)))
    if peak: samples=samples/peak*.48
    data=np.rint(samples*32767).astype('<i2')
    path=OUT/'audio'/(asset_id+'.wav')
    with wave.open(str(path),'wb') as out:
        out.setparams((1,2,RATE,len(data),'NONE','not compressed'))
        out.writeframes(data.tobytes())
    record(asset_id,category,path,sourceFile=SOURCE,provenance='Original deterministic synthesis; no samples or external compositions.',status='prototype audio; listening and mix approval pending',durationSeconds=len(data)/RATE,sampleRate=RATE,channels=1,loop=loop,peakDbFS=round(20*math.log10(max(float(np.max(np.abs(data.astype(float))))/32768,1e-10)),2))

def build_audio():
    cues={
      'ui_open':[293.66], 'ui_close':[220], 'ui_buy':[392,523.25], 'ui_unavailable':[146.83],
      'summit':[392,587.33], 'coin':[783.99], 'milestone':[293.66,392,587.33],
      'wheel_charge':[196,293.66,392], 'foreman':[293.66,440,587.33],
      'decree':[146.83,220], 'relic':[392,587.33,783.99],
      'prestige':[196,293.66,392,587.33], 'site_unlock':[220,329.63,440],
      'charter':[293.66,392,440,587.33], 'offline_return':[293.66,392],
    }
    for name,notes in cues.items():
        out=np.zeros(round((.12*len(notes)+.6)*RATE))
        for i,n in enumerate(notes):
            s=tone(n,.6); start=round(i*.12*RATE); out[start:start+len(s)]+=s
        write_audio('sfx_'+name,out,'interface-audio' if name.startswith('ui_') else 'effects-audio')
    rng=np.random.default_rng(7319)
    for name,duration,freq in [('scrape',1.2,60),('roll',2,85),('impact_pottery',.55,140),('impact_bronze',1.0,220),('machine_pulse',1.0,100)]:
        t=np.arange(round(duration*RATE))/RATE
        noise=rng.normal(size=len(t)); noise=np.convolve(noise,np.ones(11)/11,mode='same')
        if name in ('scrape','roll'):
            out=(noise*.3+np.sin(2*np.pi*freq*t)*.09)*(np.sin(np.pi*t/duration)**2)*(.7+.3*np.sin(2*np.pi*9*t))
        else:
            out=(noise*.2+np.sin(2*np.pi*freq*t)*.55+np.sin(2*np.pi*freq*2.71*t)*.15)*np.exp(-7*t/duration)
        edge=min(110,len(out)//2);out[:edge]*=np.linspace(0,1,edge);out[-edge:]*=np.linspace(1,0,edge)
        write_audio('sfx_'+name,out,'effects-audio')
    # 24 seconds / 8 bars at 80 BPM. Wrap note tails modulo length for continuity.
    for name,base,pattern in [('early_labor',146.83,[0,7,10,7,0,5,7,3]),('underworld_enterprise',110,[0,3,7,10,7,5,3,7]),('approach_to_olympus',196,[0,7,12,10,7,5,10,12])]:
        out=np.zeros(RATE*24)
        for beat in range(32):
            freq=base*2**(pattern[beat%8]/12)
            s=tone(freq,2.4)*.25
            indices=(np.arange(len(s))+round(beat*.75*RATE))%len(out)
            out[indices]+=s
            if beat%4==0:
                reed=tone(base/2,3,'reed')*.14
                ri=(np.arange(len(reed))+round(beat*.75*RATE))%len(out);out[ri]+=reed
                drum=tone(65,.3,'drum')*.09
                di=(np.arange(len(drum))+round(beat*.75*RATE))%len(out);out[di]+=drum
        write_audio('music_'+name,out,'music',True)

def inspect_art():
    prompt_path=ROOT/'docs/art-direction/asset-generation-v1.json'
    tasks=json.loads(prompt_path.read_text(encoding='utf-8'))['tasks']
    warnings=[]
    for task in tasks:
        path=OUT/'art'/(task['id']+'.png')
        if not path.exists():
            warnings.append('Missing raster: '+task['id']);continue
        with Image.open(path) as image:
            w,h=image.size
            has_alpha='A' in image.getbands()
            alpha=image.getchannel('A') if has_alpha else None
            transparent=bool(alpha and alpha.getextrema()[0]<255)
            bounds=alpha.getbbox() if alpha else (0,0,w,h)
            if alpha:
                opaque_y,opaque_x=np.where(np.asarray(alpha)>=128)
                visible_bounds=(int(opaque_x.min()),int(opaque_y.min()),int(opaque_x.max()+1),int(opaque_y.max()+1)) if len(opaque_x) else bounds
            else:visible_bounds=bounds
            margins=[bounds[0]/w,bounds[1]/h,(w-bounds[2])/w,(h-bounds[3])/h] if bounds else [0]*4
        category=task['category']
        status='first-pass raster; visual approval pending'
        if category in ('character','installation'):status='single pose / flattened source; rigging required'
        if category!='environment' and not transparent:
            warnings.append('No transparent pixels: '+task['id']);status='blocked: opaque sprite background'
        if category!='environment' and min(margins)<.025:warnings.append('Tight edge padding: '+task['id'])
        center=[(visible_bounds[0]+visible_bounds[2])/(2*w),(visible_bounds[1]+visible_bounds[3])/(2*h)]
        pivot=center if category in ('stone','portrait') or task['id']=='flywheel_rotor' else ([0,0] if category=='environment' else [center[0],visible_bounds[3]/h])
        record(task['id'],category,path,dimensions=[w,h],pivot=pivot,pivotStatus='suggested from alpha >= 128 bounds; calibrate during scene integration',alphaBounds=list(bounds) if bounds else None,visibleAlphaBounds=list(visible_bounds),hasTransparency=transparent,sourceFile=path.relative_to(ROOT).as_posix(),promptSource=prompt_path.relative_to(ROOT).as_posix(),provenance='Generated with OpenAI built-in image generation for this project, 2026-09-27; no external reference images.',status=status)
    return warnings

def catalog(warnings):
    counts=Counter(a['category'] for a in ASSETS)
    manifest=dict(version='0.1.0',status='first-pass library; not release approved',assets=ASSETS,counts=dict(counts),warnings=warnings)
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    cards=[]
    for a in ASSETS:
        url=html.escape(a['url'].removeprefix('/assets/pottery-v1/'))
        label=html.escape(a['id'])
        if a['category'].endswith('audio') or a['category']=='music':
            media=f'<audio controls preload="none" src="{url}"></audio>'
        else:media=f'<div class="preview"><img loading="lazy" src="{url}" alt="{label}"></div>'
        detail=f'{a.get("dimensions", "")} {a.get("durationSeconds", "")} '
        cards.append(f'<article data-category="{a["category"]}" data-id="{label}">{media}<h2>{label}</h2><p>{html.escape(a["status"])}</p><small>{detail}</small><a href="{url}" download>Download</a></article>')
    options=''.join(f'<option>{k}</option>' for k in sorted(counts))
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sisyphus asset library</title><style>
    :root{font:16px/1.5 system-ui;color:#211b17;background:#ebdcc0}body{margin:0;padding:28px;max-width:1600px;margin-inline:auto}h1{font-family:Georgia,serif;font-size:clamp(2rem,5vw,4rem);margin:0}header{max-width:850px}p{margin:.5rem 0 1rem}nav{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}input,select,button{font:inherit;padding:12px;border:1px solid #68503b;background:#f6ecdc;color:#211b17;border-radius:4px;min-height:44px}input{flex:1;min-width:180px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}article{background:#f6ecdc;border:1px solid #c1a582;padding:14px;border-radius:6px;min-width:0}article[hidden]{display:none}.preview{height:230px;display:grid;place-items:center;background-color:#d99c6c;background-image:linear-gradient(45deg,#ebdcc050 25%,transparent 25%,transparent 75%,#ebdcc050 75%),linear-gradient(45deg,#ebdcc050 25%,transparent 25%,transparent 75%,#ebdcc050 75%);background-size:24px 24px;background-position:0 0,12px 12px}img{max-width:100%;max-height:230px;object-fit:contain}h2{font-size:1rem;overflow-wrap:anywhere}small{display:block}a{color:#633214}audio{width:100%;margin:30px 0}footer{padding:32px 0}.dark .preview{background-color:#211b17}.dark .preview img[src$=".svg"]{background:#ebdcc0;border-radius:6px}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #b65d35;outline-offset:3px}
    </style><header><h1>Sisyphus / asset library</h1><p>Pottery, machinery, and divine administration.</p><p>First-pass art and original prototype audio. Characters and installations still need rigging; generated backgrounds are full plates. Inspect on both grounds before integrating.</p><a href="manifest.json">Asset manifest</a> · <a href="motion-contract.json">Motion handoff</a></header><nav><input id="search" type="search" aria-label="Find an asset" placeholder="Find an asset…"><select id="category" aria-label="Asset category"><option value="">All categories</option>OPTIONS</select><button id="ground">Switch preview ground</button></nav><p id="count" aria-live="polite"></p><main>CARDS</main><footer>Original sources: tools/assets/build_library.py and docs/art-direction/asset-generation-v1.json. No font files or third-party samples included.</footer><script>
    const search=document.querySelector('#search'),category=document.querySelector('#category'),cards=[...document.querySelectorAll('article')];function filter(){let n=0;for(const card of cards){card.hidden=!(card.dataset.id.includes(search.value.trim().toLowerCase())&&(!category.value||card.dataset.category===category.value));if(!card.hidden)n++}document.querySelector('#count').textContent=n+' assets shown'}search.addEventListener('input',filter);category.addEventListener('change',filter);document.querySelector('#ground').addEventListener('click',()=>document.body.classList.toggle('dark'));filter();
    </script></html>'''.replace('OPTIONS',options).replace('CARDS',''.join(cards))
    page=page.replace('<a href="manifest.json">Asset manifest</a>', '<a href="states.html">Animated states</a> · <a href="coverage.json">Coverage</a> · <a href="manifest.json">Asset manifest</a>')
    (OUT/'index.html').write_text(page,encoding='utf-8')
    print(json.dumps({'assets':len(ASSETS),'counts':dict(counts),'warnings':warnings},indent=2))

def main():
    for folder in ['icons','art','audio']: (OUT/folder).mkdir(parents=True,exist_ok=True)
    economy=json.loads((ROOT/'src/content/economy.json').read_text(encoding='utf-8'))
    build_vectors(economy)
    build_audio()
    warnings=inspect_art()
    from build_contract import build_contract
    build_contract(ASSETS, svg)
    catalog(warnings)

if __name__=='__main__':main()
