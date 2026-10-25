import numpy as np
from PIL import Image
FK=0.30; TEMP=-22
def _sat(s): return np.array([[0.213+0.787*s,0.715-0.715*s,0.072-0.072*s],[0.213-0.213*s,0.715+0.285*s,0.072-0.072*s],[0.213-0.213*s,0.715-0.715*s,0.072+0.928*s]])
def _sep(a):
    k=1-a; return np.array([[0.393+0.607*k,0.769-0.769*k,0.189-0.189*k],[0.349-0.349*k,0.686+0.314*k,0.168-0.168*k],[0.272-0.272*k,0.534-0.534*k,0.131+0.869*k]])
def softlight(cb,cs):
    D=np.where(cb<=0.25,((16*cb-12)*cb+4)*cb,np.sqrt(cb))
    return np.where(cs<=0.5, cb-(1-2*cs)*cb*(1-cb), cb+(2*cs-1)*(D-cb))
def bake(src,dst,fk=FK,temp=TEMP):
    im=Image.open(src); alpha=im.mode in('RGBA','LA')
    im=im.convert('RGBA' if alpha else 'RGB'); a=np.asarray(im).astype(float)/255; x=a[...,:3]
    lift=np.array([38,34,40])/255; x=x+fk*(np.maximum(x,lift)-x)
    tc=np.array([0xff,0x8a,0x3d] if temp>=0 else [0x3d,0x7b,0xff])/255; op=min(100,abs(temp))/100*0.6
    x=x+op*(softlight(x,tc)-x)
    x=np.clip((x-0.5)*(1-0.12*fk)+0.5,0,1); x=np.clip(x@_sat(1-0.22*fk).T,0,1); x=np.clip(x*(1+0.03*fk),0,1); x=np.clip(x@_sep(0.08*fk).T,0,1)
    a[...,:3]=x; out=Image.fromarray((a*255).round().astype(np.uint8),'RGBA' if alpha else 'RGB')
    out.save(dst,**({'quality':92} if dst.endswith('.jpg') else {'optimize':True}))
if __name__=='__main__':
    import sys
    for nm in ['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP']:
        bake(f'stone4/orig/{nm}.png',f'final/pieces/{nm}.png')
    bake('board2/tile_light.jpg','final/board/tile-light.jpg'); bake('board2/tile_dark.jpg','final/board/tile-dark.jpg')
