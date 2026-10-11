/* Adapted from OriginKit Pixel Trail, obtained via authorized OriginKit API.
   Tasked vanilla DOM adapter adds autonomous ambient motion for touch screens. */
(() => {
 'use strict';
 if (!window.ResizeObserver) return;
 const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
 const fine = window.matchMedia('(pointer: fine)');
 const workspaces = [];
 const pageGrid = document.createElement('div');
 pageGrid.className = 'origin-workspace-grid';
 pageGrid.setAttribute('aria-hidden','true');
 document.body.prepend(pageGrid);
 workspaces.push({host:document.body,grid:pageGrid,viewport:true});
 const hero=document.querySelector('.hero');
 if(hero){
  const grid=document.createElement('div');grid.className='origin-pixel-trail';grid.setAttribute('aria-hidden','true');hero.prepend(grid);
  workspaces.push({host:hero,grid,viewport:false});
 }
 for(const workspace of workspaces){
  const {host,grid,viewport}=workspace;
  let cells=[],timers=[],cols=0,rows=0,pitch=0,last=null,visible=true,cycle=null;
  function clear(){timers.forEach(timer=>clearTimeout(timer));timers=[];}
  function measure(){
   clear();
   const width=viewport?innerWidth:host.clientWidth,height=viewport?innerHeight:host.clientHeight;
   if(width<=0||height<=0)return;
   cols=Math.max(2,Math.round(width/(viewport?32:24)));pitch=width/cols;rows=Math.ceil(height/pitch);
   while(cols*rows>4200&&cols>2){cols=Math.max(2,Math.floor(cols*.85));pitch=width/cols;rows=Math.ceil(height/pitch);}
   grid.style.gridTemplateColumns=`repeat(${cols},1fr)`;
   cells=Array.from({length:cols*rows},()=>document.createElement('span'));
   grid.replaceChildren(...cells);last=null;
  }
  function strike(col,row,alpha=.45){
   if(col<0||col>=cols||row<0||row>=rows)return;
   const i=row*cols+col,cell=cells[i];if(!cell)return;
   clearTimeout(timers[i]);cell.style.transition='none';cell.style.opacity=String(alpha);
   timers[i]=setTimeout(()=>{cell.style.transition='opacity 1.2s linear';cell.style.opacity='0';timers[i]=0;},800);
  }
  function ambient(){
   if(motion.matches||document.hidden||!visible||pitch<=0)return;
   for(let cluster=0;cluster<2;cluster++){
   const x=Math.floor(Math.random()*Math.max(1,cols-3)),y=Math.floor(Math.random()*Math.max(1,rows-3));
   // Small pixel constellations use the source component's bounded strike/fade grid.
   strike(x,y,.48);strike(x+1,y,.3);strike(x,y+1,.22);
   if(viewport)strike(x+2,y+1,.22);
   }
  }
  function run(){if(cycle)clearInterval(cycle);cycle=null;if(!motion.matches&&!document.hidden){ambient();cycle=setInterval(ambient,420);}}
  function stamp(x,y){strike(Math.floor(x/pitch),Math.floor(y/pitch),.48);}
  function trace(event){
   if(motion.matches||!fine.matches||event.pointerType==='touch'||pitch<=0)return;
   const bounds=host.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;
   if(last){const dx=x-last.x,dy=y-last.y,n=Math.min(96,Math.ceil(Math.hypot(dx,dy)/(pitch*.5)));for(let i=1;i<n;i++)stamp(last.x+dx*i/n,last.y+dy*i/n);}
   stamp(x,y);last={x,y};
  }
  let observer,intersection;
  if(viewport){window.addEventListener('resize',measure,{passive:true});measure();}
  else{
   observer=new ResizeObserver(measure);observer.observe(host);
   intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;});intersection.observe(host);
   host.addEventListener('pointermove',trace,{passive:true});host.addEventListener('pointerleave',()=>{last=null;},{passive:true});
  }
  motion.addEventListener('change',()=>{clear();cells.forEach(cell=>cell.style.opacity='0');run();});
  document.addEventListener('visibilitychange',run);
  run();
  window.addEventListener('pagehide',()=>{clear();clearInterval(cycle);observer?.disconnect();intersection?.disconnect();},{once:true});
 }
})();

