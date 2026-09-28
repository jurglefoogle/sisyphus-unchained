"""Authored scene geometry, independent machine parts, and renderer state recipes.

Called by build_library.py. PNG sources are referenced, never altered.
"""
from pathlib import Path
import hashlib
import json
import math
import re

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/pottery-v1'
INK,CLAY,PALE,PAPER,BRONZE='#211B17','#B65D35','#D99C6C','#EBDCC0','#A57B3B'
SOURCE='tools/assets/build_contract.py'

def read_geometry():
    text=(ROOT/'src/world/geometry.ts').read_text(encoding='utf-8')
    constants={key:float(value) for key,value in re.findall(r'export const (STAGE_W|STAGE_H|GROUND_Y) = ([0-9.]+);',text)}
    def number(token):
        token=token.strip()
        return constants[token] if token in constants else float(token)
    hill_block=re.search(r'export const HILL = \{(.*?)\n\};',text,re.S).group(1)
    hill={name:[number(x),number(y)] for name,x,y in re.findall(r'(footLeft|summitLeft|summitRight|footRight): \{ x: ([^,]+), y: ([^}]+)\}',hill_block)}
    if len(hill)==4:
        ascent=[hill['footLeft'],hill['summitLeft']]
        outline=[*ascent,hill['summitRight'],hill['footRight']]
    else:
        # Also accept the renderer's pottery-kit polyline form.
        kit_match=re.search(r'export const KIT = \{ scale: ([0-9.]+), x: ([0-9.]+), y: ([0-9.]+) \}',text)
        if not kit_match:raise ValueError('Could not read authoritative HILL geometry')
        scale,ox,oy=map(float,kit_match.groups())
        def k(x,y):return [ox+float(x)*scale,oy+float(y)*scale]
        ascent_text=re.search(r'const ASCENT: Vec\[\] = \[(.*?)\];',text,re.S).group(1)
        ascent=[k(x,y) for x,y in re.findall(r'k\(([0-9.]+),\s*([0-9.]+)\)',ascent_text)]
        points={name:k(x,y) for name,x,y in re.findall(r'(summitRight|descentFoot|basinEnd): k\(([0-9.]+),\s*([0-9.]+)\)',hill_block)}
        hill=dict(footLeft=ascent[0],summitLeft=ascent[-1],summitRight=points['summitRight'],footRight=points['descentFoot'])
        outline=[*ascent,points['summitRight'],points['descentFoot'],points['basinEnd'],[ascent[0][0],constants['GROUND_Y']]]
    return dict(stage=[constants['STAGE_W'],constants['STAGE_H']],ground=constants['GROUND_Y'],hill=hill,ascent=ascent,outline=outline,sha256=hashlib.sha256(text.encode()).hexdigest())

def build_contract(assets,emit_svg):
    geometry=read_geometry()
    def svg(asset_id,body,size=(256,256),pivot=(.5,.5),category='world-component'):
        emit_svg(asset_id,category,body,size,pivot,status='authored vector; in-game review pending')
        assets[-1]['sourceFile']=SOURCE
    def path(points):return ' '.join(f'{x:g},{y:g}' for x,y in points)
    palettes={
      'first_hill':(CLAY,PALE,INK), 'tartarus_rim':(INK,CLAY,PALE),
      'leaking_heights':(PAPER,BRONZE,INK), 'bronze_pass':(CLAY,BRONZE,INK),
      'skyward_escarpment':(PAPER,BRONZE,INK), 'olympian_approach':(PALE,PAPER,INK),
    }
    a,b,c,d=[geometry['hill'][key] for key in ['footLeft','summitLeft','summitRight','footRight']]
    stage=tuple(geometry['stage']); ground=geometry['ground']
    def ascent_at(u):
        x=a[0]+(b[0]-a[0])*u
        for left,right in zip(geometry['ascent'],geometry['ascent'][1:]):
            if x<=right[0]:return x,left[1]+(x-left[0])/(right[0]-left[0])*(right[1]-left[1])
        return b
    for site,(fill,accent,edge) in palettes.items():
        # Every decorative line remains INSIDE the authored hill polygon.
        contour=f'<polygon points="{path(geometry["outline"])}" fill="{fill}" stroke="{edge}" stroke-width="5"/>'
        # Broad strata and small incisions make the slope read as fired clay,
        # while keeping the collision silhouette and summit completely clear.
        etching=f'<path d="M{c[0]:g} {c[1]:g} {d[0]:g} {d[1]:g}H{c[0]-120:g}Z" fill="{edge}" stroke="none" opacity=".16"/>'
        for band in range(5):
            y=ground-35-band*73
            etching+=f'<path d="M{a[0]-20:g} {y:g}Q620 {y+45:g} 980 {y-18:g}T1480 {y+12:g}" stroke="{accent}" stroke-width="2" opacity=".28"/>'
        for i in range(1,8):
            x,y=ascent_at(i/9)
            etching+=f'<path d="M{x:g} {y+20:g}l-25 90 45 45" stroke="{accent}" stroke-width="2" opacity=".6"/>'
        for i in range(75):
            x=a[0]+((i*137)%int(d[0]-a[0]))
            y=b[1]+((i*83)%int(ground-b[1]))
            etching+=f'<path d="M{x:g} {y:g}l{4+i%7} -2" stroke="{accent}" stroke-width="1.5" opacity=".25"/>'
        ridge=[(x,y+9) for x,y in [*geometry['ascent'],c]]
        etching+=f'<polyline points="{path(ridge)}" stroke="{accent}" stroke-width="3" opacity=".7"/>'
        decorations=''
        if site=='leaking_heights':
            decorations=f'<path d="M640 580h340v60h100" stroke="{accent}" stroke-width="7"/>'
        elif site=='bronze_pass':
            decorations=f'<path d="M700 530v215m130-275v275m130-350v350M670 640h320" stroke="{accent}" stroke-width="12"/>'
        elif site in ('skyward_escarpment','olympian_approach'):
            decorations=''.join(f'<path d="M{x} 620v115m-16 0h32m-32-115h32" stroke="{accent}" stroke-width="6"/>' for x in (580,780,980,1180))
        hill=contour+f'<defs><clipPath id="inside"><polygon points="{path(geometry["outline"])}"/></clipPath></defs><g clip-path="url(#inside)">{etching}{decorations}</g>'
        svg('scene_'+site+'_hill',hill,stage,(0,0),'scene-layer')
        # The transparent area above y=844 leaves the return-path centre at y=794 clear.
        front=f'<path d="M0 {ground+84:g}H1600V900H0Z" fill="{fill}" stroke="{edge}" stroke-width="4"/><path d="M0 {ground+100:g}H1600" stroke="{accent}" stroke-width="3"/>'
        for x in range(20,1600,80):
            front+=f'<path d="M{x} 894v-22h44v13h-29" stroke="{accent}" stroke-width="3"/>'
        svg('scene_'+site+'_foreground',front,stage,(0,0),'scene-layer')

    svg('machine_drum_frame','<path d="M32 216 57 77h20l18 139m66 0 18-139h20l25 139Z" fill="'+CLAY+'"/><path d="M48 77h160v24H48Z" fill="'+BRONZE+'"/><path d="M24 216h208v16H24Z" fill="'+INK+'"/>',pivot=(.5,.5))
    svg('machine_drum_rotor','<circle cx="128" cy="128" r="65" fill="'+BRONZE+'"/><circle cx="128" cy="128" r="50" stroke-width="7"/><path d="M128 66v124M66 128h124M84 84l88 88M84 172l88-88" stroke-width="7"/><circle cx="128" cy="128" r="16" fill="'+CLAY+'"/><circle cx="128" cy="128" r="7" fill="'+INK+'"/>')
    svg('machine_wheel_stand','<path d="M31 235 113 128h30l82 107Z" fill="'+INK+'"/><path d="M58 221h140l-62-77h-16Z" stroke="'+BRONZE+'" stroke-width="5"/>')
    svg('machine_wheel_upgrade','<circle cx="128" cy="128" r="115" stroke="'+BRONZE+'" stroke-width="10"/><circle cx="128" cy="128" r="106" stroke="'+PAPER+'" stroke-width="3"/>'+''.join(f'<circle cx="128" cy="13" r="5" fill="{PAPER}" transform="rotate({i*45} 128 128)"/>' for i in range(8)))
    svg('install_scaffold_frame','<path d="M32 230V70m72 160V36m72 194V16M20 84 220 8M32 230l72-132 72 132M20 230h200" stroke="'+INK+'" stroke-width="11"/><path d="M30 223 102 99m8 0 66 124" stroke="'+BRONZE+'" stroke-width="3"/>',pivot=(.12,.9))
    svg('install_bronze_frame','<path d="M30 230V90l170-75v215H30Z" fill="'+BRONZE+'"/><path d="M48 212v-109l61-26v135Zm80 0V69l53-24v167Z" fill="'+INK+'"/><path d="M15 230h207v12H15Z" fill="'+CLAY+'"/>',pivot=(.12,.9))
    svg('machine_belt','<path d="M48 80h150a42 42 0 0 1 0 84H48a42 42 0 0 1 0-84Z" stroke-width="12"/><path d="M48 80h150a42 42 0 0 1 0 84H48a42 42 0 0 1 0-84Z" stroke="'+BRONZE+'" stroke-width="4" stroke-dasharray="14 7"/>')
    svg('height_marker_pole','<path d="M128 231V32" stroke="'+INK+'" stroke-width="9"/><path d="M133 36h68l-16 21 16 21h-68Z" fill="'+BRONZE+'"/><path d="M96 232h64" stroke-width="6"/>',pivot=(.5,232/256))
    steps=''
    for u in (.52,.60,.68,.76,.84,.92):
        x,y=ascent_at(u)
        # Incised below the route surface; never changes collision or movement.
        steps+=f'<path d="M{x:g} {y+9:g}h28v7h-28Z" fill="{INK}" stroke="{PALE}" stroke-width="2"/>'
    svg('route_footholds_overlay',steps,stage,(a[0]/stage[0],a[1]/stage[1]),'scene-layer')
    svg('fx_dust_puff','<path d="M25 176q-14-46 34-58-2-41 42-39 24-52 60-9 56-15 54 46 32 3 20 60Z" fill="'+PALE+'" stroke="none"/>')
    svg('fx_coin_disc','<circle cx="128" cy="128" r="84" fill="'+BRONZE+'" stroke-width="7"/><circle cx="128" cy="128" r="68" stroke="'+PAPER+'" stroke-width="4"/><path d="M86 141q42-62 84 0M89 154h78m-51-59v65m24-65v65" stroke-width="8"/>')
    svg('fx_relic_rays',''.join(f'<path d="M128 32v27" stroke="{BRONZE}" stroke-width="5" transform="rotate({i*30} 128 128)"/>' for i in range(12)))
    svg('decree_seal','<circle cx="128" cy="128" r="100" fill="'+CLAY+'" stroke-width="6"/><circle cx="128" cy="128" r="84" stroke="'+PAPER+'" stroke-width="4"/><path d="m141 56-58 84h48l-13 67 62-94h-48Z" fill="'+BRONZE+'" stroke-width="5"/>')
    lookup={a['id']:a for a in assets}
    delivery={}
    def frame(asset):
        if asset not in lookup:raise ValueError('Missing image dependency: '+asset)
        item=lookup[asset]
        return dict(assetId=asset,url=item['url'],dimensions=item['dimensions'],pivot=item['pivot'])
    def key(t,x=0,y=0,sx=1,sy=1,rotation=0,alpha=1):
        return dict(time=t,x=x,y=y,scaleX=sx,scaleY=sy,rotation=rotation,alpha=alpha)
    def layer(asset,name=None,keys=None,size=256):
        return dict(id=name or asset,frame=frame(asset),size=[size,size],keyframes=keys or [key(0)])
    def state(layers,duration=1,loop=False,note='',poster=0):
        return dict(status='available',duration=duration,loop=loop,reducedMotionTime=poster,layers=layers,notes=note)
    def put(asset,state_id,data):delivery.setdefault(asset,dict(states={},notes='In-game acceptance pending.'))['states'][state_id]=data
    def blocked(asset,state_id,planned):
        put(asset,state_id,dict(status='blocked-image-limit',duration=1,loop=False,reducedMotionTime=0,layers=[],plannedAssets=planned,notes='New character/stone raster artwork requires image generation. No unrelated pose substituted.'))
    def hold(asset):return state([layer(asset)])
    for asset in ('stone_limestone','stone_basalt','stone_marble','stone_bronze','stone_star','stone_decree'):put(asset,'texture',hold(asset))
    put('sisyphus','push_loop',state([layer('sisyphus_push',keys=[key(0),key(.6,x=2,sx=1.01),key(1.2)])],1.2,True,'Single illustrated pose with a subtle effort transform; articulated push frames remain pending.'))
    put('sisyphus','manual_assist',delivery['sisyphus']['states']['push_loop'])
    for name,planned in [('rest',['sisyphus_rest']),('strain_accent',['sisyphus_strain']),('summit_reaction',['sisyphus_summit']),('step_aside',['sisyphus_step_aside']),('walk',['sisyphus_walk_strip']),('slip_knockdown',['sisyphus_slip_strip']),('get_up',['sisyphus_get_up_strip'])]:blocked('sisyphus',name,planned)
    delivery['sisyphus']['variants']={'feet_wrapped':dict(status='blocked-image-limit',states={},notes='Rag-wrapped feet artwork required for every character state after Wrap Your Feet. Existing barefoot images must not be relabeled.')}
    put('shade_attendant','pull_loop',state([layer('shade_attendant',keys=[key(0),key(.65,x=-2,rotation=-.012),key(1.3)])],1.3,True,'Single-pose working motion; articulated arms pending.'))
    for name,planned in [('idle',['shade_idle']),('purchase_reaction',['shade_purchase_reaction']),('walk',['shade_walk_strip'])]:blocked('shade_attendant',name,planned)
    for name in ('rough','chipped'):blocked('stone_limestone_prelude',name,['stone_limestone_'+name])

    stand=layer('machine_wheel_stand','stand')
    put('flywheel','uninstalled',state([],note='Intentionally empty: no installed wheel. This is a delivered visibility state.'))
    put('flywheel','charging',state([stand,layer('flywheel_rotor','rotor',[key(0),key(.8,rotation=.4),key(1.8,rotation=math.tau)])],1.8,note='Fixed stand; wheel gains speed after the authoritative charge event.',poster=1.8))
    put('flywheel','turning',state([stand,layer('flywheel_rotor','rotor',[key(0),key(3,rotation=math.tau)])],3,True))
    put('flywheel','upgraded',state([stand,layer('flywheel_rotor','rotor',[key(0),key(2,rotation=math.tau)]),layer('machine_wheel_upgrade','rim')],2,True))
    drum_layers=[layer('machine_drum_frame','frame'),layer('machine_drum_rotor','rotor')]
    put('rope_drum','idle',state(drum_layers))
    put('rope_drum','turning',state([drum_layers[0],layer('machine_drum_rotor','rotor',[key(0),key(2.4,rotation=math.tau)])],2.4,True,note='Separate end-on drum rotor and fixed support frame.'))
    def burst(asset,count=6,spread=80,duration=.8):
        layers=[]
        for i in range(count):
            angle=(i/max(count-1,1))*math.pi
            x=math.cos(angle)*spread;y=-math.sin(angle)*spread-12
            layers.append(layer(asset,'particle_'+str(i),[key(0,sx=.35,sy=.35),key(duration*.45,x=x*.5,y=y,sx=.45,sy=.45,rotation=i*.45),key(duration,x=x,y=28,sx=.2,sy=.2,rotation=i*.9,alpha=0)],64))
        return state(layers,duration,note='Cosmetic particles only; grants remain authoritative.',poster=duration)
    for target in ('target_debris','target_coin_amphora','target_gilded_offering'):
        put(target,'idle',hold(target));put(target,'shatter',burst('prop_pottery_chip',6))
    for name in ('hermes','daedalus','ixion','danaids','talos','atlas','charter'):
        asset='work_'+name
        put(asset,'idle',state([layer(asset)],note='Held illustrated installation. Internal machine-layer animation remains a later art pass.'))
        put(asset,'entrance',state([layer(asset,keys=[key(0,y=12,alpha=0),key(.45,y=-2),key(.7)])],.7,poster=.7))
    put('install_level_10','idle',hold('install_scaffold_frame'))
    put('install_level_25','idle',hold('install_bronze_frame'))
    install_base=layer('install_bronze_frame','frame')
    put('install_level_50','idle',state([install_base,layer('machine_belt','belt'),layer('machine_drum_rotor','rotor',size=128)]))
    put('install_level_50','running',state([install_base,layer('machine_belt','belt'),layer('machine_drum_rotor','rotor',[key(0),key(2.4,rotation=math.tau)],128)],2.4,True))
    put('fx_coin','small_grant',state([layer('fx_coin_disc',keys=[key(0,sx=.4,sy=.4,alpha=0),key(.12,sx=.5,sy=.5),key(.9,y=-48,sx=.35,sy=.35,alpha=0)],size=64)],.9,poster=.9))
    put('fx_coin','milestone_grant',burst('fx_coin_disc',9,100,1.1))
    put('fx_relic','rare_discovery',state([layer('fx_relic_rays',keys=[key(0,sx=.5,sy=.5,alpha=0),key(.3),key(1.4,sx=1.1,sy=1.1,alpha=0)]),layer('ui_insight',keys=[key(0,sx=.2,sy=.2,alpha=0),key(.3,sx=.6,sy=.6),key(1.4,sx=.6,sy=.6,alpha=0)])],1.4,poster=1.4))
    put('decree_stamp','stamp',state([layer('decree_seal',keys=[key(0,sx=1.2,sy=1.2,alpha=0),key(.14,sx=.92,sy=.92),key(.3)])],.3,poster=.3))
    footholds=layer('route_footholds_overlay');footholds['size']=list(stage)
    put('route_footholds','idle',state([footholds]))
    put('best_height_marker','idle',hold('height_marker_pole'))
    put('best_height_marker','moved',state([layer('height_marker_pole',keys=[key(0,sy=.9),key(.15,sy=1.04),key(.35)])],.35,poster=.35))
    put('fx_fall','dust',state([layer('fx_dust_puff',keys=[key(0,sx=.2,sy=.2,alpha=0),key(.1,sx=.6,sy=.4,alpha=.65),key(.65,x=12,y=-8,sx=1.2,sy=.7,alpha=0)])],.65,poster=.65))
    put('fx_fall','obol_toss',burst('fx_coin_disc',3,60,.8))
    put('fx_first_summit','burst',burst('fx_coin_disc',12,125,1.25))
    for site in palettes:
        asset='scene_'+site
        for name,source in [('background',asset),('hill',asset+'_hill'),('foreground',asset+'_foreground')]:
            item=layer(source);item['size']=list(stage);item['frame']['pivot']=[0,0]
            put(asset,name,state([item],note='1600×900 stage layer; transparent hill/foreground follows geometry.ts.'))
    report=dict(version=1,geometry=geometry,assets=delivery,coordinateSystem='Layer x/y offsets are stage pixels relative to the requested asset pivot. size is the full source canvas rendered size; pivots are normalized. rotation is radians. Keyframes are linearly interpolated; frame is held. Empty uninstalled layers are intentional.',status='All non-character contract states delivered except two prelude stone illustrations. Character pose generation blocked by image quota.')
    (OUT/'delivery.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    rows=[dict(id=asset,state=name,status=clip['status']) for asset,spec in delivery.items() for name,clip in spec['states'].items()]
    blocked_rows=[row for row in rows if row['status']!='available']
    variants=[dict(id=asset,variant=name,status=variant['status']) for asset,spec in delivery.items() for name,variant in spec.get('variants',{}).items()]
    coverage=dict(requiredAssets=len(delivery),registeredAssets=len(set(delivery)|set(lookup)),requiredStates=len(rows),availableStates=len(rows)-len(blocked_rows),blockedStates=blocked_rows,variants=variants,complete=not blocked_rows and all(v['status']=='available' for v in variants),rows=rows,note='Derived from deliveries; tests/asset-contract.test.ts verifies coverage against REQUIRED_ASSETS in assets.ts.')
    (OUT/'coverage.json').write_text(json.dumps(coverage,indent=2)+'\n',encoding='utf-8')
