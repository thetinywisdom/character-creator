# Tiny City office kit: builds every item + the full office room in Blender 5.2 and exports GLB.
# Run from the repo root: blender -b -P src/office/build_office_kit.py
# Writes public/office-kit/models/*.glb, manifest.json and layout.json (what Vite serves),
# and saves src/office/office_kit.blend beside this script.
# The viewer does not load the GLBs: src/office/items.js rebuilds the same boxes and cylinders
# so createAsset stays synchronous. Re-run this only to refresh the files.
# Authored in three.js axes (metres, y up, front = +z, origin = bottom centre), converted to Blender Z-up;
# the glTF exporter's +Y-up switch turns it back, so three.js sees exactly these numbers.
import bpy, bmesh, json, math, os, random
from mathutils import Matrix, Vector, Euler
HERE=os.path.dirname(os.path.abspath(__file__))  # src/office
ROOT=os.path.dirname(os.path.dirname(HERE))
KIT=os.path.join(ROOT,'public','office-kit'); MOD=os.path.join(KIT,'models'); os.makedirs(MOD,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
# --- the repo palette (src/styles/palette.js PALETTE, base 'Muted' values) ---
PALETTE={'Off white':0xf2efe8,'Paper':0xe4e0d6,'Light gray':0xcfccc4,'Stone':0xb3b0a8,'Gray':0x918f8a,'Slate':0x6f747a,'Charcoal':0x4a4d52,'Ink':0x2f3236,
 'Blush':0xe8c8c4,'Dusty rose':0xc99c98,'Peach':0xecccb0,'Apricot':0xdcb08c,'Butter':0xece0aa,'Sand':0xd8caa8,'Sage':0xb6c6a6,'Mint':0xc4dccf,'Seafoam':0x9fbfb6,
 'Sky':0xbcd2e0,'Powder blue':0x9fb6cc,'Lavender':0xc9c2dc,'Lilac':0xa99dbf,'Moss':0x8aa082,'Denim':0x7d93ab,'Navy':0x56647a,'Tan':0xb89e80,'Cocoa':0x8a7462,'Walnut':0x66584c,'Brick':0x9e6c60}
def lin(c):c/=255;return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
MATS={}
def M(key):  # key = 'role:Swatch'  -> material named exactly that (the loader re-colours by this name)
    if key in MATS:return MATS[key]
    role,sw=key.split(':');h=PALETTE[sw];rgb=(lin(h>>16&255),lin(h>>8&255),lin(h&255),1)
    m=bpy.data.materials.new(key);m.diffuse_color=rgb
    b=m.node_tree.nodes.get('Principled BSDF') if m.node_tree else None
    if b is None:
        m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=rgb;b.inputs['Roughness'].default_value=1.0;b.inputs['Metallic'].default_value=0.0
    if role=='light':b.inputs['Emission Color'].default_value=rgb;b.inputs['Emission Strength'].default_value=0.55
    MATS[key]=m;return m
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))  # three (x,y,z) -> blender (x,-z,y)
CI=C.inverted()
class Item:
    def __init__(s,name):s.name=name;s.bm=bmesh.new();s.mats=[]
    def _mi(s,key):
        m=M(key)
        if m not in s.mats:s.mats.append(m)
        return s.mats.index(m)
    def _add(s,geom_verts,key):
        faces={f for v in geom_verts for f in v.link_faces};mi=s._mi(key)
        for f in faces:f.material_index=mi;f.smooth=False
    def _mat(s,pos,rot,scl):
        T=Matrix.Translation(Vector(pos))@Euler(rot or (0,0,0),'XYZ').to_matrix().to_4x4()@Matrix.Diagonal(Vector((*scl,1)))
        return C@T@CI
    def box(s,w,h,d,key,pos=(0,0,0),rot=None):
        r=bmesh.ops.create_cube(s.bm,size=1,matrix=s._mat(pos,rot,(w,h,d)));s._add(r['verts'],key)
    def cyl(s,rt,rb,h,key,pos=(0,0,0),seg=6,rot=None,scl=(1,1,1)):
        r=bmesh.ops.create_cone(s.bm,cap_ends=True,segments=seg,radius1=rb,radius2=rt,depth=h,matrix=s._mat(pos,rot,scl))
        s._add(r['verts'],key)
    def lobe(s,r,key,pos,scl=(1,.8,1),seed=1):  # faceted foliage lobe, like lib/foliage.js lobe() (icosahedron, detail 0)
        rng=random.Random(seed);res=bmesh.ops.create_icosphere(s.bm,subdivisions=1,radius=r,matrix=Matrix.Identity(4))
        tw=rng.random()*6.28;amp=.07+rng.random()*.1
        for v in res['verts']:
            p=v.co.normalized();wob=math.sin(p.x*4.1+tw)*math.cos(p.y*3.4-tw)*math.sin(p.z*4.7+tw*.5);v.co=p*r*(1+amp*wob)
        bmesh.ops.transform(s.bm,matrix=s._mat(pos,(rng.uniform(-.2,.2),rng.random()*6.28,rng.uniform(-.2,.2)),scl),verts=res['verts'])
        s._add(res['verts'],key)
    def finish(s):
        me=bpy.data.meshes.new(s.name);s.bm.to_mesh(me);s.bm.free()
        for m in s.mats:me.materials.append(m)
        ob=bpy.data.objects.new(s.name,me);return ob
ITEMS={};META={}
def item(name,label,group):
    def deco(fn):
        it=Item(name);fn(it);ob=it.finish();ITEMS[name]=ob;META[name]=(label,group);return fn
    return deco
P=math.pi
# ---------------- WORK ----------------
@item('desk','Desk (IDÅSEN-style sit/stand, 160x80)','work')
def _(t):
    t.box(1.6,.035,.8,'wood:Tan',(0,.7125,0))
    for sx in(-1,1):
        t.box(.07,.66,.07,'darkMetal:Charcoal',(sx*.66,.36,0));t.box(.07,.03,.72,'darkMetal:Charcoal',(sx*.66,.015,0))
    t.box(1.32,.05,.06,'darkMetal:Charcoal',(0,.67,0))
@item('office_chair','Office chair (MARKUS-style, high back)','work')
def _(t):
    for i in range(5):
        a=i*2*P/5;t.box(.05,.035,.3,'darkMetal:Ink',(math.sin(a)*.15,.06,math.cos(a)*.15),(0,a,0))
        t.box(.04,.05,.04,'darkMetal:Ink',(math.sin(a)*.29,.025,math.cos(a)*.29))
    t.cyl(.03,.03,.32,'metal:Stone',(0,.24,0))
    t.box(.52,.08,.5,'cloth:Ink',(0,.45,.03))
    t.box(.48,.66,.07,'cloth:Charcoal',(0,.87,-.25),(-.12,0,0))
    t.box(.34,.14,.07,'cloth:Ink',(0,1.24,-.30),(-.12,0,0))
    for sx in(-1,1):t.box(.05,.2,.05,'darkMetal:Ink',(sx*.27,.55,.02));t.box(.07,.03,.26,'darkMetal:Ink',(sx*.27,.66,.02))
@item('monitor','Monitor (27in, tilt stand)','work')
def _(t):
    t.box(.62,.36,.035,'darkMetal:Ink',(0,.29,0));t.box(.57,.31,.006,'glass:Navy',(0,.29,.019))
    t.box(.07,.22,.025,'metal:Light gray',(0,.11,-.035),(.12,0,0));t.box(.2,.012,.16,'metal:Light gray',(0,.006,-.03))
@item('laptop','Laptop (open)','work')
def _(t):
    t.box(.31,.016,.22,'metal:Stone',(0,.008,0));t.box(.26,.003,.09,'darkMetal:Charcoal',(0,.017,-.03))
    t.box(.31,.21,.008,'metal:Stone',(0,.115,-.125),(-.22,0,0));t.box(.28,.18,.002,'glass:Navy',(0,.117,-.119),(-.22,0,0))
@item('keyboard','Keyboard + mouse','work')
def _(t):
    t.box(.36,.02,.12,'paint:Off white',(0,.01,0));t.box(.06,.025,.1,'paint:Off white',(.26,.0125,0))
@item('desk_lamp','Desk lamp (angled arm)','work')
def _(t):
    t.cyl(.07,.08,.025,'darkMetal:Charcoal',(0,.0125,0));t.box(.02,.32,.02,'darkMetal:Charcoal',(0,.17,-.04),(-.35,0,0))
    t.box(.02,.26,.02,'darkMetal:Charcoal',(0,.40,.0),(.75,0,0))
    t.cyl(.035,.075,.11,'darkMetal:Charcoal',(0,.43,.13),rot=(.5,0,0));t.cyl(.06,.06,.01,'light:Butter',(0,.39,.155),rot=(.5,0,0))
@item('mug','Mug','work')
def _(t):
    t.cyl(.042,.04,.095,'paint:Off white',(0,.0475,0));t.box(.015,.05,.04,'paint:Off white',(.05,.05,0))
@item('bookcase','Bookcase (BILLY-style 80x28x202) with books','work')
def _(t):
    W,D,H='paint:Off white',.28,2.02
    for sx in(-1,1):t.box(.02,H,D,W,(sx*.39,H/2,0))
    t.box(.8,.02,.01,W,(0,H-.01,-.135));t.box(.76,H,.01,W,(0,H/2,-.135))
    for y in(.06,.42,.80,1.18,1.56,2.01):t.box(.76,.02,D,W,(0,y,0))
    cols=['paint:Powder blue','paint:Dusty rose','paint:Sage','paint:Butter','paint:Navy','paint:Sand','paint:Lilac','paint:Slate']
    rng=random.Random(7)
    for k,y in enumerate((.07,.43,.81,1.19,1.57)):
        x=-.37
        while x<.33:
            w=rng.choice((.08,.1,.12,.16));h=rng.choice((.24,.27,.3,.22)) if k<4 else .2
            if x+w>.37:break
            if rng.random()<.18:x+=w;continue
            t.box(w-.006,h,.2,rng.choice(cols),(x+w/2,y+.01+h/2,-.01));x+=w
@item('copier','Copier/printer on cabinet','work')
def _(t):
    t.box(.6,.6,.5,'paint:Light gray',(0,.3,0));t.box(.58,.004,.004,'darkMetal:Charcoal',(0,.3,.25))
    t.box(.5,.36,.45,'paint:Off white',(0,.78,0));t.box(.5,.08,.42,'darkMetal:Charcoal',(0,1.0,-.01))
    t.box(.16,.04,.1,'darkMetal:Ink',(.15,1.03,.17),(.3,0,0));t.box(.36,.01,.2,'paint:Paper',(0,.83,.27))
@item('flat_file','Flat-file cabinet (5 drawers, 165x42x75)','work')
def _(t):
    t.box(1.65,.75,.42,'paint:Off white',(0,.375,0))
    for i in range(5):
        y=.15+i*.125;t.box(1.6,.004,.005,'paint:Light gray',(0,y-.06,.211));t.box(.3,.02,.025,'metal:Stone',(0,y,.22))
@item('wall_shelf','Wall shelf plank (100x20)','work')
def _(t):
    t.box(1.0,.04,.2,'wood:Tan',(0,.02,.1))
    for sx in(-1,1):t.box(.02,.12,.02,'darkMetal:Charcoal',(sx*.38,-.04,.01))
# ---------------- LOUNGE ----------------
@item('sofa','Sofa 3-seat (BORKUM-style, 218 cm)','lounge')
def _(t):
    for sx in(-1,1):
        t.box(.04,.04,.86,'metal:Light gray',(sx*1.0,.02,0));t.box(.04,.3,.04,'metal:Light gray',(sx*1.0,.17,.38));t.box(.04,.3,.04,'metal:Light gray',(sx*1.0,.17,-.38))
    t.box(2.1,.12,.82,'cloth:Walnut',(0,.36,0))
    for i in(-1,0,1):t.box(.64,.14,.62,'cloth:Cocoa',(i*.67,.49,.07))
    for i in(-1,0,1):t.box(.64,.36,.18,'cloth:Cocoa',(i*.67,.64,-.31),(-.12,0,0))
    for sx in(-1,1):t.box(.12,.28,.84,'cloth:Walnut',(sx*1.03,.52,0))
@item('coffee_table','Coffee table (LISTERBY-style 140x60)','lounge')
def _(t):
    t.box(1.4,.04,.6,'wood:Tan',(0,.35,0))
    for sx in(-1,1):
        for sz in(-1,1):t.box(.05,.33,.05,'wood:Tan',(sx*.64,.165,sz*.24))
    t.box(1.28,.02,.48,'wood:Tan',(0,.12,0))
@item('side_table','Side tray table (GLADOM-style)','lounge')
def _(t):
    t.cyl(.225,.225,.05,'darkMetal:Ink',(0,.505,0),seg=8)
    for i in range(3):a=i*2*P/3;t.box(.02,.52,.02,'darkMetal:Ink',(math.sin(a)*.13,.25,math.cos(a)*.13),(math.cos(a)*.18,0,-math.sin(a)*.18))
@item('rug','Rug (jute, 300x200)','lounge')
def _(t):t.box(3.0,.01,2.0,'cloth:Sand',(0,.005,0));t.box(2.8,.002,1.8,'cloth:Tan',(0,.011,0))
@item('rug_large','Rug (jute, 350x240)','meeting')
def _(t):t.box(3.5,.01,2.4,'cloth:Sand',(0,.005,0));t.box(3.3,.002,2.2,'cloth:Tan',(0,.011,0))
@item('whiteboard_mobile','Mobile whiteboard (120x90 on casters)','lounge')
def _(t):
    for sx in(-1,1):
        t.box(.04,1.72,.04,'metal:Stone',(sx*.66,.9,0));t.box(.05,.04,.56,'metal:Stone',(sx*.66,.07,0))
        for sz in(-1,1):t.box(.04,.05,.04,'darkMetal:Ink',(sx*.66,.025,sz*.25))
    t.box(1.26,.94,.03,'metal:Light gray',(0,1.22,0));t.box(1.2,.88,.012,'paint:Off white',(0,1.22,.016));t.box(1.0,.03,.06,'metal:Stone',(0,.76,.04))
@item('whiteboard_wall','Wall whiteboard (180x120, back at z=0)','meeting')
def _(t):
    t.box(1.84,1.24,.03,'metal:Light gray',(0,.62,.015));t.box(1.78,1.18,.01,'paint:Off white',(0,.62,.032));t.box(.6,.025,.06,'metal:Stone',(0,.01,.04))
# ---------------- MEETING ----------------
@item('meeting_table','Meeting table (boat shape 200x100)','meeting')
def _(t):
    t.cyl(.5,.5,.04,'wood:Tan',(0,.73,0),seg=12,scl=(2.0,1,1))
    for sx in(-1,1):t.box(.06,.71,.55,'wood:Tan',(sx*.55,.355,0))
    t.box(1.1,.06,.06,'wood:Tan',(0,.12,0))
@item('meeting_chair','Meeting chair (Brno-style)','meeting')
def _(t):
    for sx in(-1,1):
        x=sx*.25;t.box(.025,.03,.5,'metal:Light gray',(x,.015,-.02));t.box(.025,.42,.03,'metal:Light gray',(x,.22,.22),(-.25,0,0))
        t.box(.025,.03,.42,'metal:Light gray',(x,.62,.02));t.box(.025,.3,.03,'metal:Light gray',(x,.48,-.25),(.3,0,0))
    t.box(.5,.08,.46,'cloth:Ink',(0,.45,.02));t.box(.5,.32,.07,'cloth:Ink',(0,.65,-.22),(-.15,0,0))
# ---------------- KITCHEN ----------------
@item('kitchen_run','Kitchen run (324 cm, sage cabinets, sink)','kitchen')
def _(t):
    L=3.24;t.box(L,.1,.55,'darkMetal:Charcoal',(0,.05,-.03));t.box(L,.77,.6,'paint:Sage',(0,.485,-.02))
    t.box(L,.04,.64,'paint:Moss',(0,.89,0));t.box(L,.19,.02,'paint:Moss',(0,1.005,-.31))
    n=8
    for i in range(n+1):t.box(.006,.74,.005,'paint:Seafoam',(-L/2+i*L/n,.49,.281))
    for i in range(n):t.box(.14,.015,.02,'metal:Stone',(-L/2+(i+.5)*L/n,.8,.29))
    t.box(.46,.012,.3,'metal:Stone',(-1.15,.906,.0));t.box(.03,.26,.03,'metal:Stone',(-1.15,1.04,-.24));t.box(.03,.03,.16,'metal:Stone',(-1.15,1.16,-.17))
@item('fridge','Fridge (top freezer, 76x77x169)','kitchen')
def _(t):
    t.box(.76,1.69,.72,'metal:Light gray',(0,.845,-.025));t.box(.76,1.66,.05,'metal:Light gray',(0,.845,.36))
    t.box(.74,.006,.006,'darkMetal:Charcoal',(0,1.2,.386))
    for y in(1.44,.75):t.box(.03,.36,.04,'metal:Stone',(-.3,y,.41))
@item('trash_can','Trash can (sensor, 58 L)','kitchen')
def _(t):t.box(.47,.6,.33,'darkMetal:Ink',(0,.3,0));t.box(.47,.03,.33,'darkMetal:Charcoal',(0,.615,0))
@item('coffee_machine','Espresso machine','kitchen')
def _(t):
    t.box(.34,.36,.32,'metal:Stone',(0,.22,-.02));t.box(.34,.04,.4,'metal:Stone',(0,.02,.02))
    t.cyl(.06,.04,.12,'glass:Charcoal',(0,.46,-.06));t.box(.05,.03,.12,'darkMetal:Ink',(0,.2,.17));t.box(.16,.06,.005,'darkMetal:Charcoal',(0,.33,.141))
@item('microwave','Microwave','kitchen')
def _(t):t.box(.46,.28,.37,'paint:Off white',(0,.14,0));t.box(.3,.2,.005,'glass:Ink',(-.05,.14,.186));t.box(.08,.22,.005,'paint:Light gray',(.17,.14,.186))
@item('bar_table','Bar table (terrazzo top, terracotta base, 220x65x105)','kitchen')
def _(t):
    t.box(2.1,.97,.5,'paint:Dusty rose',(0,.485,0));t.box(2.2,.07,.65,'concrete:Paper',(0,1.0,0))
    rng=random.Random(3)
    for i in range(18):t.box(.05,.004,.04,rng.choice(('concrete:Peach','concrete:Stone','concrete:Dusty rose')),(rng.uniform(-1.05,1.05),1.036,rng.uniform(-.28,.28)),(0,rng.random()*3,0))
@item('bar_stool','Bar stool (cane seat, 78 cm)','kitchen')
def _(t):
    for i in range(4):
        a=P/4+i*P/2;t.box(.03,.78,.03,'wood:Walnut',(math.sin(a)*.17,.38,math.cos(a)*.17),(math.cos(a)*.1,0,-math.sin(a)*.1))
    t.cyl(.2,.2,.02,'wood:Walnut',(0,.3,0),seg=8);t.cyl(.19,.19,.04,'wood:Sand',(0,.76,0),seg=8)
@item('pendant_lamp','Bar pendant (coral, hangs 1.23 m)','kitchen')
def _(t):
    t.cyl(.11,.11,.22,'paint:Dusty rose',(0,.11,0),seg=8);t.cyl(.09,.09,.005,'light:Butter',(0,.002,0),seg=8)
    t.cyl(.006,.006,1.0,'darkMetal:Ink',(0,.72,0),seg=4);t.cyl(.05,.05,.02,'paint:Dusty rose',(0,1.22,0),seg=6)
# ---------------- PLANTS ----------------
@item('plant_fig','Fiddle-leaf fig (1.7 m)','plants')
def _(t):
    t.cyl(.17,.13,.34,'concrete:Off white',(0,.17,0));t.cyl(.15,.15,.01,'wood:Walnut',(0,.335,0))
    t.cyl(.02,.03,1.0,'wood:Walnut',(0,.8,0),seg=5)
    for i,(x,y,z,r) in enumerate(((0,1.55,0,.22),(.15,1.3,.08,.2),(-.14,1.2,-.05,.2),(.05,1.05,-.15,.18),(-.06,1.45,.14,.17))):t.lobe(r,'leaf:Moss' if i%2 else 'leaf:Sage',(x,y,z),seed=i+1)
@item('plant_monstera','Monstera in woven basket','plants')
def _(t):
    t.cyl(.21,.17,.32,'wood:Sand',(0,.16,0),seg=8)
    for i in range(6):
        a=i*2*P/6;t.lobe(.2,'leaf:Moss' if i%2 else 'leaf:Sage',(math.sin(a)*.2,.62+.12*(i%3),math.cos(a)*.2),scl=(1.2,.45,1.2),seed=10+i)
    t.lobe(.2,'leaf:Moss',(0,1.0,0),scl=(1.1,.5,1.1),seed=20)
@item('plant_snake','Snake plant (tall blades)','plants')
def _(t):
    t.cyl(.13,.11,.28,'concrete:Charcoal',(0,.14,0))
    rng=random.Random(5)
    for i in range(8):
        a=i*2*P/8;h=rng.uniform(.5,.8);t.box(.06,h,.012,'leaf:Moss' if i%3 else 'leaf:Sage',(math.sin(a)*.05,.28+h/2,math.cos(a)*.05),(math.cos(a)*.12,a,-math.sin(a)*.08))
@item('plant_small','Small potted plant (ZZ / pothos)','plants')
def _(t):
    t.cyl(.07,.055,.11,'concrete:Off white',(0,.055,0))
    for i,(x,y,z) in enumerate(((0,.2,0),(.06,.16,.03),(-.05,.15,-.03))):t.lobe(.08,'leaf:Moss',(x,y,z),seed=30+i)
@item('planter_divider','Planter divider (240 cm trough + greenery, 1.46 m)','plants')
def _(t):
    t.box(2.4,.5,.46,'paint:Off white',(0,.25,0))
    rng=random.Random(11)
    for i in range(14):
        x=-1.08+i*2.16/13;t.lobe(rng.uniform(.2,.27),rng.choice(('leaf:Moss','leaf:Sage','leaf:Moss')),(x,rng.uniform(.75,1.1),rng.uniform(-.06,.06)),scl=(1,1.3,.9),seed=40+i)
    for i in range(6):t.box(.05,.5,.012,'leaf:Moss',(-1.0+i*.4,1.2,0),(0,i,.15*(-1)**i))
# ---------------- build + export items ----------------
def tris(ob):ob.data.calc_loop_triangles();return len(ob.data.loop_triangles)
col=bpy.data.collections.new('Kit_Items');bpy.context.scene.collection.children.link(col)
def export(objs,path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_texcoords=False,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False)
manifest={'units':'metres','up':'+y','front':'+z','origin':'bottom centre','palette_source':'thetinywisdom/character-creator src/styles/palette.js','items':{}}
for n,ob in ITEMS.items():
    col.objects.link(ob)
    export([ob],os.path.join(MOD,n+'.glb'))
    bb=[ob.matrix_world@Vector(v) for v in ob.bound_box]
    # blender -> three: width x, height z, depth y
    w=max(v.x for v in bb)-min(v.x for v in bb);d=max(v.y for v in bb)-min(v.y for v in bb);h=max(v.z for v in bb)-min(v.z for v in bb)
    manifest['items'][n]={'label':META[n][0],'group':META[n][1],'file':'models/'+n+'.glb','size':[round(w,3),round(h,3),round(d,3)],'footprint':[round(w,3),round(d,3)],'tris':tris(ob),
        'materials':[m.name for m in ob.data.materials],'bytes':os.path.getsize(os.path.join(MOD,n+'.glb'))}
# ---------------- the office room (layout from office_v23.blend) ----------------
# office plan coords: X east 0..6.5, Y north 0..14.5. three: x = X-3.25, z = 7.25-Y (room centred on the origin, north = -z).
FACE={'S':0.0,'E':P/2,'N':P,'W':-P/2}
L=[]
def put(n,X,Y,f='S',el=0.0,tag=''):L.append({'item':n,'x':round(X-3.25,3),'y':round(el,3),'z':round(7.25-Y,3),'rotY':round(FACE[f],4),'tag':tag})
for nm,(X,Y,d,cx,mx) in {'Downey':(3.69,13.35,'W',3.04,3.98),'Penny':(3.69,11.75,'W',3.04,3.98),'Grey':(4.51,13.35,'E',5.16,4.22),'Joy':(4.51,11.75,'E',5.16,4.22)}.items():
    o='E' if d=='W' else 'W'
    put('desk',X,Y,d,0,nm);put('office_chair',cx,Y,o,0,nm);put('monitor',mx,Y,d,.73,nm)
    put('keyboard',X-.14 if d=='W' else X+.14,Y,d,.73,nm)
put('laptop',4.62,12.2,'E',.73);put('desk_lamp',3.85,13.95,'W',.73);put('mug',3.5,13.0,'S',.73);put('mug',4.7,11.4,'S',.73);put('plant_small',4.4,14.0,'S',.73)
put('bookcase',1.39,13.35,'E');put('bookcase',1.39,12.5,'E');put('copier',1.55,11.7,'E')
put('plant_fig',1.6,13.95);put('plant_monstera',6.05,13.93);put('plant_snake',6.03,6.07)
put('planter_divider',4.1,9.7,'S')
put('rug',4.15,7.43);put('sofa',4.16,8.82,'S');put('sofa',5.85,7.4,'W');put('coffee_table',4.26,7.63);put('plant_small',4.6,7.62,'S',.38);put('mug',4.0,7.55,'S',.38)
put('side_table',5.75,9.0);put('whiteboard_mobile',2.47,9.0,'E')
put('flat_file',1.46,6.83,'E')
for z in(1.06,1.44,1.82):put('wall_shelf',1.25,7.8,'E',z)
put('plant_small',1.36,7.98,'E',1.1);put('plant_small',1.36,7.47,'E',1.48);put('plant_small',1.36,8.0,'E',1.86)
put('rug_large',3.83,1.35);put('meeting_table',3.75,1.35)
for X in(3.06,3.75,4.44):put('meeting_chair',X,1.75,'S');put('meeting_chair',X,.95,'N')
put('whiteboard_wall',3.77,.15,'N',.88);put('whiteboard_wall',1.25,1.4,'E',.88)
put('kitchen_run',3.92,3.12,'N');put('fridge',5.945,3.215,'N');put('microwave',5.26,3.03,'N',.91);put('coffee_machine',3.81,3.06,'N',.91);put('mug',3.4,3.12,'N',.91)
put('bar_table',3.5,4.705);put('trash_can',4.9,4.71,'N')
for X in(2.675,3.225,3.775,4.325):put('bar_stool',X,5.29,'N')
for X in(2.95,3.5,4.05):put('pendant_lamp',X,4.7,'S',1.77)
put('mug',3.2,4.62,'S',1.035)
# room shell (one mesh: floor, walls, partitions, glass, stairs), east wall separate for cutaways
sh=Item('room_shell');ew=Item('room_wall_east')
def wallB(it,x0,x1,y0,y1,z0,z1,key):it.box(x1-x0,z1-z0,y1-y0,key,((x0+x1)/2-3.25,(z0+z1)/2,7.25-(y0+y1)/2))
for i in range(4):
    for j in range(8):wallB(sh,1.25+i*1.275,1.25+(i+1)*1.275,.15+j*1.775,.15+(j+1)*1.775,-.05,0,'concrete:Light gray' if (i+j)%2 else 'concrete:Stone')
wallB(sh,0,6.5,0,14.5,-.30,-.05,'concrete:Gray')
W='building:Off white'
wallB(sh,0,6.5,0,.15,0,3,W);wallB(sh,0,.15,.15,14.35,0,3,W)
wallB(sh,1.1,1.25,.15,5.0,0,3,W);wallB(sh,1.1,1.25,5.9,14.35,0,3,W);wallB(sh,1.1,1.25,5.0,5.9,2.1,3,W)
wallB(sh,1.25,2.4,2.65,2.8,0,3,W);wallB(sh,4.8,6.35,2.65,2.8,0,3,W);wallB(sh,2.4,4.8,2.65,2.8,0,1.1,W);wallB(sh,2.4,4.8,2.65,2.8,2.1,3,W)
wallB(sh,2.4,4.8,2.7,2.75,1.1,1.14,'darkMetal:Charcoal');wallB(sh,2.4,4.8,2.7,2.75,2.06,2.1,'darkMetal:Charcoal');wallB(sh,2.44,4.76,2.72,2.73,1.14,2.06,'glass:Sky')
wallB(sh,1.16,1.22,5.04,5.86,0,2.05,'glass:Sky')
wallB(sh,0,6.5,14.35,14.5,2.8,3,W);wallB(sh,0,1.25,14.35,14.5,0,2.8,W)
for k in range(5):x=1.25+k*1.275;wallB(sh,x,x+.06,14.33,14.47,0,2.8,'darkMetal:Charcoal')
wallB(sh,1.25,6.35,14.33,14.47,0,.4,'darkMetal:Charcoal');wallB(sh,1.25,6.35,14.33,14.47,2.74,2.8,'darkMetal:Charcoal');wallB(sh,1.25,6.35,14.42,14.44,.4,2.74,'glass:Sky')
for s in range(16):wallB(sh,.15,1.1,.15+s*.297,.15+(s+1)*.297,0,.19*(s+1),'concrete:Stone')
wallB(ew,6.35,6.5,.15,14.35,0,3,W)
shell=sh.finish();east=ew.finish()
room=bpy.data.collections.new('Office_Room');bpy.context.scene.collection.children.link(room)
root=bpy.data.objects.new('tiny_office',None);room.objects.link(root)
for o in(shell,east):room.objects.link(o);o.parent=root
cnt={}
for e in L:
    n=e['item'];cnt[n]=cnt.get(n,0)+1
    o=bpy.data.objects.new(f"{n}_{cnt[n]:02d}"+(('_'+e['tag']) if e['tag'] else ''),ITEMS[n].data)  # linked duplicate (shared mesh)
    o.location=Vector((e['x'],-e['z'],e['y']));o.rotation_euler=(0,0,e['rotY']);room.objects.link(o);o.parent=root
for o in col.objects:o.hide_render=o.hide_viewport=True
bpy.context.view_layer.update()
room_objs=[root]+[o for o in room.objects if o!=root]
export(room_objs,os.path.join(MOD,'office_room.glb'))
rt=sum(tris(ITEMS[e['item']]) for e in L)+tris(shell)+tris(east)
manifest['room']={'file':'models/office_room.glb','size':[6.5,3.0,14.5],'tris':rt,'placed_items':len(L),'shell_tris':tris(shell)+tris(east),
  'bytes':os.path.getsize(os.path.join(MOD,'office_room.glb')),'note':'room centred on the origin; north window wall at z=-7.25; east wall node is room_wall_east (hide it for a cutaway)'}
json.dump(manifest,open(os.path.join(KIT,'manifest.json'),'w'),indent=1,ensure_ascii=False)
json.dump({'units':'metres','note':'three.js coords; room centred; item origin bottom centre; rotY radians','placements':L},open(os.path.join(KIT,'layout.json'),'w'),indent=1)
for o in col.objects:o.hide_render=o.hide_viewport=False
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'office_kit.blend'),compress=True)
print('KIT_DONE items',len(ITEMS),'room tris',rt,'placed',len(L))
for n,v in manifest['items'].items():print('ITEM',n,v['tris'],v['bytes'],v['size'])
