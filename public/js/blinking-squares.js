/* Adapted from OriginKit Blinking Squares, fetched through the authorized API.
   Vanilla DOM adapter retains deterministic cell phases, tint and sine twinkle.
   Tasked adds a 15 fps cap, hidden/offscreen suspension and static reduced motion. */
(() => {
 'use strict';
 const motion=matchMedia('(prefers-reduced-motion:reduce)');
 const specs=[{host:document.body,viewport:true,alpha:.42}];
 const hero=document.querySelector('.hero');if(hero)specs.push({host:hero,viewport:false,alpha:.22});
 for(const {host,viewport,alpha} of specs){
  const layer=document.createElement('div');layer.className=viewport?'origin-blinking-background':'origin-blinking-hero';layer.setAttribute('aria-hidden','true');
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');layer.append(canvas);host.prepend(layer);
  const ctx=canvas.getContext('2d');if(!ctx)continue;
  let w=0,h=0,cells=[],key='',frame=0,lastFrame=0,visible=true;
  const start=performance.now();
  function ensureCells(cols,rows){
   const next=`${cols}x${rows}`;if(key===next)return;key=next;
   cells=Array.from({length:cols*rows},(_,i)=>{
    const s=Math.sin(i*12.9898+78.233)*43758.5453,r1=s-Math.floor(s);
    const s2=Math.sin(i*7.137+33.71)*12345.6789,r2=s2-Math.floor(s2);
    const s3=Math.sin(i*3.51+5.91)*9876.54321,r3=s3-Math.floor(s3);
    return {phase:r1*Math.PI*2,rate:.6+r2*.8,tint:r3};
   });
  }
  function draw(now){
   if(w<=0||h<=0)return;
   const size=viewport?30:24,cols=Math.ceil(w/size),rows=Math.ceil(h/size);ensureCells(cols,rows);
   ctx.clearRect(0,0,w,h);
   const dark=document.documentElement.dataset.theme==='dark';
   const palette=dark?[[153,187,133],[199,170,112],[108,152,125]]:[[153,193,145],[224,193,116],[118,167,132]];
   const time=motion.matches?3:(now-start)/1000;
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const cell=cells[y*cols+x];if(!cell)continue;
    const osc=.5+.5*Math.sin(time*.4*cell.rate*Math.PI*2+cell.phase);
    const edge=viewport?1:Math.max(.5,Math.abs(x/Math.max(1,cols-1)-.5)*2);
    const opacity=(.12+.88*osc)*alpha*edge;
    if(opacity<=.002)continue;
    const [r,g,b]=palette[Math.min(palette.length-1,Math.floor(cell.tint*palette.length))];
    ctx.fillStyle=`rgba(${r},${g},${b},${opacity.toFixed(3)})`;
    ctx.fillRect(x*size+4,y*size+4,size-8,size-8);
   }
  }
  function loop(now){if(document.hidden||!visible||motion.matches){frame=0;return;}if(now-lastFrame>=1000/15){draw(now);lastFrame=now;}frame=requestAnimationFrame(loop);}
  function run(){cancelAnimationFrame(frame);frame=0;draw(performance.now());if(!document.hidden&&visible&&!motion.matches)frame=requestAnimationFrame(loop);}
  function resize(){
   w=viewport?innerWidth:host.clientWidth;h=viewport?innerHeight:host.clientHeight;
   const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;ctx.setTransform(dpr,0,0,dpr,0,0);key='';run();
  }
  let resizeObserver,intersection;
  if(viewport){addEventListener('resize',resize,{passive:true});resize();}
  else{
   resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
   intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;run();});intersection.observe(host);
  }
  document.addEventListener('visibilitychange',run);motion.addEventListener('change',run);
  const themeObserver=new MutationObserver(()=>draw(performance.now()));themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  addEventListener('pagehide',()=>{cancelAnimationFrame(frame);resizeObserver?.disconnect();intersection?.disconnect();themeObserver.disconnect();},{once:true});
 }
})();

