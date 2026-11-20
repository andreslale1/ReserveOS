"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import "./reserveos-editorial.css";

type Access = { label: string; href: string };
type Discipline = "pilates" | "crossfit" | "hyrox";
type Slot = { hour: string; title: string; coach: string; booked: number; capacity: number };
const DEMOS: Record<Discipline,{name:string;heading:string;description:string;details:string[];slots:Slot[]}> = {
  pilates: {
    name: "PILATES", heading: "Cada reformer. Cada clase. Bajo control.",
    description: "Gestiona cupos por reformer, instructores, paquetes de clases y asistencia desde un solo lugar.",
    details:["CAPACIDAD POR REFORMER","PAQUETES DE CLASES","INSTRUCTORAS Y ASISTENCIA"],
    slots:[{hour:"07:00",title:"Pilates Reformer",coach:"Instructora Sofía",booked:7,capacity:8},{hour:"09:00",title:"Pilates Mat",coach:"Instructora Paula",booked:8,capacity:10},{hour:"18:00",title:"Reformer Express",coach:"Instructora Sofía",booked:6,capacity:8}]
  },
  crossfit: {
    name:"CROSSFIT",heading:"Más entrenamiento. Menos administración.",
    description:"Planifica tus WOD, controla asistencia, organiza coaches y gestiona membresías.",
    details:["WOD Y OPEN GYM","CONTROL DE CUPOS","MEMBRESÍAS Y COACHES"],
    slots:[{hour:"06:00",title:"WOD del día",coach:"Coach Diego",booked:13,capacity:14},{hour:"12:00",title:"Open Gym",coach:"Coach Ana",booked:6,capacity:12},{hour:"19:00",title:"Fuerza + WOD",coach:"Coach Diego",booked:10,capacity:14}]
  },
  hyrox: {
    name:"HYROX",heading:"Control total, hasta la última estación.",
    description:"Organiza bloques, estaciones y carriles sin perder el seguimiento de entrenamientos y atletas.",
    details:["BLOQUES HORARIOS","CARRILES Y ESTACIONES","ENTRENADORES Y CUPOS"],
    slots:[{hour:"06:30",title:"HYROX Simulation",coach:"Coach Mario",booked:7,capacity:8},{hour:"12:15",title:"Sled + Run",coach:"Coach Elena",booked:6,capacity:8},{hour:"18:30",title:"Training Stations",coach:"Coach Mario",booked:8,capacity:8}]
  }
};
const features=[
 ["01","RESERVAS","Horarios, cupos, listas de espera y asistencia en una sola operación."],
 ["02","MEMBRESÍAS","Paquetes, créditos, vigencias y reglas ajustadas a cada estudio."],
 ["03","CLIENTES","Perfiles e historial de cada persona, sin hojas de cálculo dispersas."],
 ["04","COBROS","Registra y controla pagos presenciales y transferencias. Pagos online: próxima etapa."],
 ["05","EQUIPO","Roles diferenciados para gerencia, recepción, coaches y administración."],
 ["06","SEDES","Controla varias ubicaciones, su capacidad y sus equipos sin mezclar información."]
];
const MODES=[
 {id:"01",name:"DENTRO DE RESERVEOS",body:"Tu estudio tiene su propio espacio dentro de la plataforma. Una sola operación para horarios, paquetes, clientes y equipo.",example:"reserveos.app / tu-estudio",caption:"PLATAFORMA LISTA PARA USAR"},
 {id:"02",name:"EN TU PÁGINA WEB",body:"Conserva tu identidad y tu sitio web. Integramos el sistema de reservas para que tus clientes reserven desde donde ya te conocen.",example:"tuestudio.com / reservar",caption:"WIDGET E INTEGRACIÓN"},
 {id:"03",name:"DESARROLLO A MEDIDA",body:"Necesitas una experiencia personalizada. LL Agency diseña tu sitio o solución digital, con ReserveOS integrado según el alcance acordado.",example:"tu marca / tu experiencia",caption:"IMPLEMENTACIÓN PERSONALIZADA"}
];
export default function LandingReserveOS({acceso={label:"Entrar",href:"/login"}}:{acceso?:Access}){
 const [menu,setMenu]=useState(false);
 const [discipline,setDiscipline]=useState<Discipline>("pilates");
 const [day,setDay]=useState(0);
 const [selected,setSelected]=useState<string[]>([]);
 const [email,setEmail]=useState("");
 const [leadState,setLeadState]=useState<"idle"|"sending"|"done"|"error">("idle");
 const demo=DEMOS[discipline];
 const days=["LUN 23","MAR 24","MIÉ 25","JUE 26"];
 const scopedKey=(slot:Slot)=>discipline+"-"+day+"-"+slot.hour;
 const toggleDemo=(slot:Slot)=>{
   const key=scopedKey(slot);
   setSelected(prev=>prev.includes(key)?prev.filter(x=>x!==key):[...prev,key]);
 };
 const sendLead=async(e:FormEvent<HTMLFormElement>)=>{
   e.preventDefault();
   if(!email.trim())return;
   setLeadState("sending");
   try{
     const r=await fetch("/api/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim()})});
     setLeadState(r.ok?"done":"error");
   }catch{setLeadState("error")}
 };
 return <div className="ro-page" id="top">
   <header className="ro-nav ro-wrap">
      <a className="ro-logo" href="#top" aria-label="ReserveOS, inicio">reserveos<span>.</span></a>
      <div className="ro-tag">SISTEMA DE RESERVAS<br/>Y OPERACIÓN</div>
      <nav className="ro-navlinks" aria-label="Principal">
        <a href="#producto">PRODUCTO</a><a href="#modalidades">MODALIDADES</a><a href="#soluciones">SOLUCIONES</a><a href="#como-empezar">CÓMO EMPEZAR</a>
        <a href={acceso.href}>{acceso.label}</a>
        <a className="ro-button" href="/contacto">SOLICITAR DEMO <span aria-hidden="true">↗</span></a>
      </nav>
      <button type="button" className="ro-mobile-nav" onClick={()=>setMenu(!menu)} aria-expanded={menu} aria-controls="ro-menu">{menu?"CERRAR":"MENÚ"}</button>
      {menu&&<nav className="ro-mobile-panel" id="ro-menu" aria-label="Móvil">
       {[["Producto","#producto"],["Modalidades","#modalidades"],["Soluciones","#soluciones"],["Cómo empezar","#como-empezar"],[acceso.label,acceso.href],["Solicitar demo","/contacto"]].map(([name,href])=><a key={name} href={href} onClick={()=>setMenu(false)}>{name}</a>)}
      </nav>}
   </header>
   <main>
     <section className="ro-hero ro-wrap">
       <div className="ro-hero-grid">
         <div className="ro-hero-copy">
           <p className="ro-eyebrow">01 / EL SISTEMA DETRÁS DE TU ESTUDIO</p>
           <h1 className="ro-h1"><span>TODO</span><span>CONÉC-</span><span className="ro-blue">TADO.</span></h1>
           <p className="ro-lead">Reservas, clientes, membresías y operación. Un solo sistema para estudios de Pilates, CrossFit y HYROX.</p>
           <div className="ro-ctas">
             <a className="ro-button" href="/contacto">SOLICITAR DEMO <span aria-hidden="true">↗</span></a>
             <a className="ro-button ro-outline" href="#soluciones">VER CÓMO FUNCIONA <span aria-hidden="true">↘</span></a>
           </div>
         </div>
         <div className="ro-hero-aside">
           <div className="ro-halftone" aria-hidden="true"/>
           <div className="ro-orbit" aria-hidden="true">◎</div>
           <div className="ro-panel" aria-label="Demostración ilustrativa del panel de ReserveOS">
             <div className="ro-panel-top"><span><i className="ro-panel-dot"/>reserveos / PANEL</span><span>DEMO · NO DATOS REALES</span></div>
             <div className="ro-panel-main">
               <div className="ro-panel-head"><h3>Tu estudio, hoy.</h3><span className="ro-pill">EN TIEMPO REAL*</span></div>
               <div className="ro-metrics"><div className="ro-metric"><small>Ocupación</small><strong>87%</strong></div><div className="ro-metric"><small>Reservas</small><strong>42</strong></div><div className="ro-metric"><small>Clases</small><strong>12</strong></div></div>
               {[{hour:"07:00",title:"Pilates Reformer",coach:"Instructora Sofía",booked:7,capacity:8},{hour:"09:00",title:"Pilates Mat",coach:"Instructora Paula",booked:8,capacity:10},{hour:"18:00",title:"HYROX Training",coach:"Coach Mario",booked:6,capacity:8}].map(s=><div className="ro-class" key={s.hour}><time>{s.hour}</time><div><b>{s.title}</b><span>{s.coach}</span></div><div className="ro-capacity">{s.booked}/{s.capacity}<i style={{"--fill":(s.booked/s.capacity*100)+"%"} as CSSProperties}/></div></div>)}
               <p className="ro-panel-foot">* DEMOSTRACIÓN VISUAL CON DATOS SIMULADOS</p>
             </div>
           </div>
         </div>
       </div>
     </section>
     <div className="ro-strip ro-wrap"><span>DISEÑADO PARA ESTUDIOS Y GIMNASIOS</span><span>PILATES / CROSSFIT / HYROX</span><span>UN SISTEMA. TU OPERACIÓN.</span></div>
     <section className="ro-section ro-wrap" id="producto">
       <div className="ro-heading-row"><div><p className="ro-eyebrow">02 / TODO EN UN SOLO LUGAR</p><h2 className="ro-h2">MENOS CAOS.<br/>MÁS CONTROL.</h2></div><p className="ro-section-desc">Deja de coordinar cada parte de tu negocio en una herramienta diferente. El trabajo diario debe sentirse simple.</p></div>
       <div className="ro-feature-grid">{features.map(([id,name,desc])=><article className="ro-feature" key={id}><span className="ro-feature-num">{id} / FUNCIÓN</span><h3>{name}</h3><p>{desc}</p></article>)}</div>
     </section>
     <section className="ro-section ro-wrap" id="modalidades">
       <div className="ro-heading-row"><div><p className="ro-eyebrow">03 / FORMAS DE IMPLEMENTARLO</p><h2 className="ro-h2">TU NEGOCIO.<br/>TUS REGLAS.</h2></div><p className="ro-section-desc">No necesitas cambiar la forma en la que te presentas. Tenemos tres maneras de llevar ReserveOS a tu operación.</p></div>
       <div className="ro-modes">{MODES.map(m=><article className="ro-mode" key={m.id}>
         <div className="ro-mode-id">{m.id}</div>
         <div><h3>{m.name}</h3><p>{m.body}</p><a href="/contacto" className="ro-eyebrow" style={{display:"inline-block",marginTop:20,color:"var(--blue)"}}>CONOCER ESTA MODALIDAD ↗</a></div>
         <div className="ro-mode-visual"><div className="ro-mode-screen"><div className="ro-mini-header">{m.caption}</div><div className="ro-mini-line"/><div className="ro-mini-line"/><div className="ro-mini-accent"/><p style={{fontSize:10,fontFamily:"monospace",marginTop:8}}>{m.example}</p></div></div>
       </article>)}</div>
     </section>
     <section className="ro-section ro-demo ro-wrap" id="soluciones">
       <div className="ro-heading-row"><div><p className="ro-eyebrow">04 / PRUÉBALO EN ESTA PÁGINA</p><h2 className="ro-h2">HECHO PARA<br/>TU RITMO.</h2></div><p className="ro-section-desc">No todos los negocios reservan de la misma manera. Cambia de disciplina y explora una simulación del calendario.</p></div>
       <div className="ro-tabs" role="tablist" aria-label="Tipo de estudio">
         {(["pilates","crossfit","hyrox"] as Discipline[]).map(d=><button key={d} role="tab" aria-selected={discipline===d} onClick={()=>{setDiscipline(d);setDay(0)}}>{DEMOS[d].name}</button>)}
       </div>
       <div className="ro-demo-layout">
         <div className="ro-demo-copy"><h3>{demo.heading}</h3><p>{demo.description}</p><div className="ro-demo-list">{demo.details.map(t=><span key={t}>↗ {t}</span>)}</div></div>
         <div className="ro-schedule"><h4>Reserva una clase.</h4><div className="ro-daybar">{days.map((label,i)=><button key={label} aria-pressed={day===i} onClick={()=>setDay(i)}>{label}</button>)}</div>
           {demo.slots.map(slot=>{const key=scopedKey(slot);const mine=selected.includes(key);const full=slot.booked>=slot.capacity;return <div className="ro-slot" key={key}><time>{slot.hour}</time><div><b>{slot.title}</b><small>{slot.coach} · {slot.booked}/{slot.capacity} lugares</small></div><button type="button" aria-pressed={mine} onClick={()=>toggleDemo(slot)}>{mine?"✓ LISTO":full?"ESPERA":"RESERVAR"}</button></div>})}
           <p className="ro-disclaimer" style={{color:"#6b7280"}}>DEMO INTERACTIVA · NO GENERA RESERVAS NI COBROS REALES</p>
         </div>
       </div>
     </section>
     <section className="ro-section ro-wrap" id="como-empezar">
       <div className="ro-heading-row"><div><p className="ro-eyebrow">05 / IMPLEMENTACIÓN</p><h2 className="ro-h2">EMPEZAR ES<br/>SENCILLO.</h2></div><p className="ro-section-desc">Tú conoces tu negocio. Nosotros te ayudamos a configurar la tecnología alrededor de tus necesidades.</p></div>
       <div className="ro-process"><article><strong>01</strong><h3>CONVERSEMOS</h3><p>Entendemos tus sedes, horarios, paquetes y operación actual.</p></article><article><strong>02</strong><h3>CONFIGURAMOS</h3><p>Elegimos la modalidad adecuada y preparamos tu espacio de trabajo.</p></article><article><strong>03</strong><h3>COMIENZAS</h3><p>Tu equipo trabaja con la plataforma y tus clientes pueden gestionar sus clases.</p></article></div>
     </section>
     <section className="ro-final ro-wrap" id="contacto"><p className="ro-eyebrow">06 / EL SIGUIENTE PASO</p><h2>HAGAMOS QUE<br/>TODO FLUYA.</h2><p>Cuéntanos sobre tu estudio y te mostramos cómo ReserveOS puede adaptarse a tu operación.</p>
       <div className="ro-ctas"><a className="ro-button" href="/contacto">PEDIR UNA DEMOSTRACIÓN ↗</a></div>
       <form className="ro-leadbox" onSubmit={sendLead}><label className="ro-eyebrow" htmlFor="ro-email" style={{alignSelf:"center"}}>O DÉJANOS TU CORREO</label><input id="ro-email" type="email" required value={email} onChange={e=>{setEmail(e.target.value);setLeadState("idle")}} placeholder="tu@estudio.com" aria-label="Correo electrónico"/><button disabled={leadState==="sending"||leadState==="done"} type="submit">{leadState==="sending"?"ENVIANDO…":leadState==="done"?"ENVIADO ✓":"CONTACTARME ↗"}</button></form>
       <p className="ro-leadstatus" aria-live="polite">{leadState==="done"?"Recibimos tu correo. Gracias por tu interés.":leadState==="error"?"No se pudo enviar el formulario. Intenta nuevamente.":""}</p>
     </section>
   </main>
   <footer className="ro-footer ro-wrap"><a className="ro-logo" href="#top">reserveos<span>.</span></a><small>DESARROLLADO POR LL AGENCY · RESERVAS PARA ESTUDIOS Y GIMNASIOS</small><nav><a href="/contacto">CONTACTO</a><a href={acceso.href}>{acceso.label.toUpperCase()}</a></nav></footer>
 </div>;
}
