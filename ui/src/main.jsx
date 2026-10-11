import React from 'react'
import {createRoot} from 'react-dom/client'
import {renderToStaticMarkup} from 'react-dom/server'
import {Button as PixelButton, Card as PixelCard, Input as PixelInput, TextArea as PixelTextarea} from 'pixel-retroui'
import FormulaStream from './components/originkit/FormulaStream'
import CloudSky from './components/originkit/CloudSky'
import GlobeStudy from './components/originkit/GlobeStudy'
import CursorRingField from './components/originkit/CursorRingField'
import RoundCarousel from './components/originkit/RoundCarousel'
import './style.css'
// Keep the legacy DOM controls: lessons attach listeners and retain references to them.
// Render real library components and transfer their presentation onto those same nodes.
const records=new WeakMap(), roots=new Map()
let mode='pixel'
function template(component){const t=document.createElement('template');t.innerHTML=renderToStaticMarkup(component);return t.content.firstElementChild}
function palette(){const css=getComputedStyle(document.documentElement);const read=(name,fallback)=>css.getPropertyValue(name).trim()||fallback;return {bg:read('--card','#fffdf3'),textColor:read('--ink','#293a30'),borderColor:read('--pixel-edge','#354b3b'),shadow:read('--pixel-shadow','#a2b18b'),shadowColor:read('--pixel-shadow','#a2b18b')}}
function apply(el,kind){
 let record=records.get(el)
 if(record?.mode===mode)return
 if(!record){record={classes:[],styles:[],wrapper:null};records.set(el,record)}
 record.classes.forEach(c=>el.classList.remove(c));record.styles.forEach(k=>el.style.removeProperty(k))
 if(record.wrapper){record.wrapper.replaceWith(el);record.wrapper=null}
 const p=palette()
 const components={button:PixelButton,input:PixelInput,textarea:PixelTextarea,card:PixelCard}
 let source=template(React.createElement(components[kind],p))
 if(kind==='input'&&source.tagName!=='INPUT'){
  const input=source.querySelector('input');if(!input)return
  source.replaceChildren(el.cloneNode(false));el.before(source);source.replaceChildren(el);record.wrapper=source;source=input
 }
 record.classes=[...source.classList].filter(c=>!el.classList.contains(c));record.classes.forEach(c=>el.classList.add(c))
 record.styles=[...source.style];record.styles.forEach(k=>el.style.setProperty(k,source.style.getPropertyValue(k)))
 if(kind==='button'){
  el.style.borderRadius='2px'
  el.dataset.variant=source.dataset.variant || (el.classList.contains('primary')?'default':'outline')
 }
 el.dataset.library='retroui';el.dataset.ui=kind;record.mode=mode
}
function refresh(){
 const changed=false
 document.querySelectorAll('button').forEach(el=>apply(el,'button'))
 document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])').forEach(el=>apply(el,'input'))
 document.querySelectorAll('textarea').forEach(el=>apply(el,'textarea'))
 document.querySelectorAll('.topic-card,.lesson-card,.theory-card,.task-card,.auth-box,.panel,.tile').forEach(el=>apply(el,'card'))
 const path=location.pathname
 let stage=document.getElementById('tasked-origin-stage')
 if(!stage){stage=document.createElement('div');stage.id='tasked-origin-stage';document.body.prepend(stage);roots.set(stage,createRoot(stage))}
 const special=path.includes('student')?<CloudSky background="transparent" clouds={{softness:90,shadow:25,cirrus:60}} baseColor="#71816a" accentColor="#9c8c5b" sun={{x:76,y:16,glow:'rgba(156,140,91,.16)'}} pointer={{parallax:18,wind:20,damping:35}}/>:path.includes('teacher')?<GlobeStudy background="transparent" baseColor="#879778" globe={{drift:45,radius:70,letters:55}} pointer={{pins:5,zoom:80,light:65}}/>:null
 const background= special || <FormulaStream background="transparent" textColor="rgba(177,195,158,.15)" accent="rgba(170,145,89,.32)" font={{fontFamily:'Pixelify Sans,monospace',fontSize:21,fontWeight:600,fontStyle:'normal',lineHeight:'1.4em',letterSpacing:'0em'}} density={12} speed={11} curve={40} gap={95} hover={30} reach={180} style={{minWidth:0,minHeight:0}}/>
 if(stage.dataset.mounted!=='true'){roots.get(stage).render(background);stage.dataset.mounted='true'}
 const hero=document.querySelector('.hero')
 if(hero){
  let extra=hero.querySelector('#tasked-hero-atmosphere')
  if(!extra){extra=document.createElement('div');extra.id='tasked-hero-atmosphere';hero.prepend(extra);roots.set(extra,createRoot(extra))}
  if(extra.dataset.mounted!=='true'){roots.get(extra).render(<CursorRingField background="transparent" colors={{background:'transparent',points:['#718665','#af8c52','#5f8281']}} density={90} dotSize={48} speed={3} cameraDistance={160} ring={{push:18,width:5,radius:7,turbulence:35}} style={{width:'100%',height:'100%',minWidth:0,minHeight:0,pointerEvents:'none'}}/>);extra.dataset.mounted='true'}
  let carousel=hero.querySelector('#tasked-topic-carousel')
  if(!carousel){carousel=document.createElement('div');carousel.id='tasked-topic-carousel';hero.append(carousel);roots.set(carousel,createRoot(carousel))}
  if(carousel.dataset.mounted!=='true'){const images=[1,2,3,4,5].map(i=>({src:`/img/study-${i}.svg`}));roots.get(carousel).render(<RoundCarousel images={images} imageWidth={132} imageHeight={104} spacing={2.2} speed={2.2} tilt={-5} perspective={900} cornerRadius={14} innerDim={7} background="transparent" style={{width:'230px',height:'155px',background:'transparent'}}/>);carousel.dataset.mounted='true'}
 }
 document.querySelectorAll('.origin-bg').forEach(el=>el.remove())
}
let pending=false
const observer=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;observer.disconnect();refresh();observe()})})
function observe(){observer.observe(document.documentElement,{subtree:true,childList:true})}
function init(){refresh();observe()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()

