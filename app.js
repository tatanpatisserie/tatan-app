/* Tatan Gestión. Si la app se abre adentro de otra página (para engañar a alguien), no se muestra. */
if (window.top !== window.self) { document.documentElement.style.display = 'none'; throw new Error('Tatan no se puede abrir dentro de otra página'); }
(function(){
'use strict';
/* ---------- utilidades ---------- */
const $ = n => (n==null||isNaN(n)) ? '—' : (n<0?'−':'') + '$ ' + Math.round(Math.abs(n)).toLocaleString('es-AR');
const pct = n => (n==null||!isFinite(n)) ? '—' : (Math.round(n*1000)/10).toLocaleString('es-AR') + '%';
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const num = v => { if(v===''||v==null) return 0; const n = parseFloat(String(v).replace(',','.')); return isNaN(n)?0:n; };
const pad = n => String(n).padStart(2,'0');
const isoDate = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today = () => isoDate(new Date());
const addDays = (iso,n) => { const d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return isoDate(d); };
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['dom','lun','mar','mié','jue','vie','sáb'];
const mesLabel = m => { const [y,mm]=m.split('-'); const s=MESES[+mm-1]; return s[0].toUpperCase()+s.slice(1)+' '+y; };
const mesShift = (m,n) => { const [y,mm]=m.split('-').map(Number); const d=new Date(y,mm-1+n,1); return d.getFullYear()+'-'+pad(d.getMonth()+1); };
const fdate = iso => { if(!iso) return '—'; const [y,m,d]=iso.split('-'); return d+'/'+m+'/'+y; };
const fdateShort = iso => { if(!iso) return ''; const d=new Date(iso+'T12:00:00'); return DIAS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1); };
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const clone = o => JSON.parse(JSON.stringify(o));
const sum = (a,f) => a.reduce((s,x)=>s+(f?f(x):x),0);
const icon = {
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  bag:'<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  whisk:'<path d="M4 20l7-7"/><path d="M12 12c3-6 7-8 8-7s-1 5-7 8"/><path d="M13.5 13.5c-1 3-4 5-5 4"/>',
  dots:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.8-4-5.6"/>',
  tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  chev:'<path d="M9 6l6 6-6 6"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
};
const svg = (k, cls) => '<svg viewBox="0 0 24 24" aria-hidden="true"'+(cls?' class="'+cls+'"':'')+'>'+icon[k]+'</svg>';

/* ---------- datos ---------- */
const COLS = ['pedidos','presupuestos','gastos','clientes','recetas','insumos','stockpt','produccion','proveedores','movprov','empleados','horas','novedades'];
const S = { pedidos:{}, presupuestos:{}, gastos:{}, clientes:{}, recetas:{}, insumos:{}, stockpt:{}, produccion:{}, proveedores:{}, movprov:{}, empleados:{}, horas:{}, novedades:{}, negocio:{}, catalogo:{items:[]} };
let SECTOR = 'todo'; let PERFIL = null; let sb = null;
const SECTORES = {todo:'Dueñas y administración', local:'Local', cocina:'Cocina'};
const NEG_DEF = { nombre:'Tatan', subtitulo:'Pâtisserie', telefono:'', instagram:'', direccion:'', costoHora:5500, multiplicador:3, costoDefault:35, validez:15, obsPresupuesto:'Presupuesto válido por 15 días.', proxPresupuesto:1 };
const neg = () => Object.assign({}, NEG_DEF, S.negocio||{});
let mode = 'loading', readOnly = false;
let USER_ID = '', USER_EMAIL = '', EQUIPO = null;
const loaded = new Set();
// Qué tablas lee cada sector. "rpc:" = vista segura sin precios.
const FUENTES = {
  todo:   {pedidos:'t', presupuestos:'t', gastos:'t', clientes:'t', recetas:'t', insumos:'t', stockpt:'t', produccion:'t', proveedores:'t', movprov:'t', empleados:'t', horas:'t', novedades:'t', config:'t'},
  local:  {pedidos:'t', presupuestos:'t', clientes:'t', stockpt:'t', produccion:'t', proveedores:'t', config:'t'},
  cocina: {pedidos:'rpc:pedidos_cocina', insumos:'rpc:insumos_cocina', stockpt:'t', produccion:'t'}
};
const fuentes = () => FUENTES[SECTOR] || {};

function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true, 2600); }
function onWriteError(e){
  console.warn(e);
  const m = (e && (e.message||'')) + '';
  if(/row-level security|permission|sin permiso/i.test(m)){ toast('No se guardó: tu sector no tiene permiso para esto.'); return; }
  if(/id_valido|tamano_valido/i.test(m)){ toast('No se guardó: el dato tiene un formato no permitido.'); return; }
  if(!navigator.onLine){ toast('No se pudo guardar: no hay conexión a internet.'); return; }
  toast('No se pudo guardar ('+(e&&(e.code||e.status)||'error')+'): '+m.slice(0,120));
}
async function rpc(fn, args){ const { error } = await sb.rpc(fn, args); if(error) onWriteError(error); }

async function save(col, obj){
  const id = obj.id || uid(); const body = clone(obj); delete body.id; body.updatedAt = new Date().toISOString();
  S[col] = Object.assign({}, S[col], {[id]: Object.assign({id}, body)});
  render();
  let q;
  if(SECTOR==='local' && (col==='gastos'||col==='movprov')){ q = sb.from(col).insert({id, data: body}); setTimeout(()=>{ const n=Object.assign({},S[col]); delete n[id]; S[col]=n; }, 0); }
  else q = sb.from(col).upsert({id, data: body, updated_at: body.updatedAt});
  const { error } = await q; if(error) onWriteError(error);
  return id;
}
async function remove(col, id){
  const n = Object.assign({}, S[col]); delete n[id]; S[col]=n; render();
  const { error } = await sb.from(col).delete().eq('id', id); if(error) onWriteError(error);
}
async function saveDoc(key, body){
  S[key] = clone(body); render();
  const { error } = await sb.from('config').upsert({id:key, data: clone(body), updated_at: new Date().toISOString()}); if(error) onWriteError(error);
}
async function saveInsumoStock(full, patch){
  S.insumos = Object.assign({}, S.insumos, {[full.id]: full}); render();
  if(SECTOR==='cocina') return rpc('ajustar_insumo', {p_id: full.id, p_patch: patch});
  return save('insumos', full);
}

function setSync(){
  const p = document.getElementById('syncpill'); if(!p) return;
  const need = Object.keys(fuentes()).length;
  if(mode==='db'){ const all = loaded.size >= need; p.className='pill '+(all?'p-ok':'p-neu'); p.textContent = all?'En línea':'Sincronizando…'; }
  else if(mode==='offline'){ p.className='pill p-warn'; p.textContent='Sin conexión'; }
}

const ID_OK = /^[A-Za-z0-9_.:-]{1,100}$/;
function aplicarFilas(col, rows){
  rows = (rows||[]).filter(r => r && typeof r.id==='string' && ID_OK.test(r.id));
  if(col==='config'){ rows.forEach(r=>{ if(r.id==='negocio'||r.id==='catalogo') S[r.id]=r.data||{}; }); if(!S.catalogo||!S.catalogo.items) S.catalogo={items:[]}; return; }
  const o = {}; rows.forEach(r => { o[r.id] = Object.assign({id:r.id}, r.data||{}); }); S[col] = o;
}
const CC_INICIAL = ['Cata','Gabi-Marcelo','Flavia','Marcela Ramos','Marta Budiño','Agustin-Agustina','Rama'];
let ccSeedHecho = false;
async function sembrarCC(){
  if(ccSeedHecho || SECTOR!=='todo' || !loaded.has('clientes') || !loaded.has('config') || !S.negocio || neg().ccSeed1) return; ccSeedHecho = true;
  const nuevos = []; CC_INICIAL.forEach(nombre => { const ex = Object.values(S.clientes).find(c=>norm(c.nombre)===norm(nombre));
    if(ex){ if(ex.tipo!=='Cuenta corriente') nuevos.push(Object.assign({}, ex, {tipo:'Cuenta corriente'})); } else nuevos.push({id:'cc-'+hashTxt(norm(nombre)), nombre, telefono:'', tipo:'Cuenta corriente', creado: today()}); });
  if(nuevos.length && !(await saveMany('clientes', nuevos))) { ccSeedHecho=false; return; }
  await saveDoc('negocio', Object.assign({}, S.negocio, {ccSeed1:true}));
}
async function cargar(col){
  const f = fuentes()[col];
  let res;
  if(f.startsWith('rpc:')) res = await sb.rpc(f.slice(4));
  else { const all=[]; let desde=0; res={data:all, error:null};
    while(true){ const r = await sb.from(col).select('id,data').order('id').range(desde, desde+999); if(r.error){ res=r; break; } all.push(...(r.data||[])); if(!r.data || r.data.length<1000) break; desde+=1000; } }
  if(res.error){ console.warn(col, res.error); mode = navigator.onLine ? mode : 'offline'; }
  else { aplicarFilas(col, res.data||[]); loaded.add(col); }
  render(); sembrarCC();
}
function aplicarCambio(col, pl){
  if(col==='config'){ return recargarPronto(col); }
  const n = Object.assign({}, S[col]);
  if(pl.eventType==='DELETE'){ if(pl.old && pl.old.id) delete n[pl.old.id]; }
  else if(pl.new && pl.new.id && ID_OK.test(pl.new.id)){ n[pl.new.id] = Object.assign({id:pl.new.id}, pl.new.data||{}); }
  S[col] = n; clearTimeout(aplicarCambio._t); aplicarCambio._t = setTimeout(render, 120);
}
async function saveMany(col, arr, prog){
  const now = new Date().toISOString(); const n = Object.assign({}, S[col]);
  // Una misma fila no puede ir dos veces en el mismo envío (la base lo rechaza): si se repite, se juntan sus datos.
  const porId = new Map(); arr.forEach(o => { const id=o.id||uid(); porId.set(id, Object.assign(porId.get(id)||{}, o, {id})); });
  const rows = [...porId.values()].map(o => { const id=o.id; const body=clone(o); delete body.id; body.updatedAt=now; n[id]=Object.assign({id},body); return {id, data:body, updated_at:now}; });
  for(let i=0;i<rows.length;i+=500){ const { error } = await sb.from(col).upsert(rows.slice(i,i+500)); if(error){ onWriteError(error); return false; } if(prog) prog(Math.min(rows.length,i+500), rows.length); }
  S[col]=n; render(); return true;
}
let recargas = {};
function recargarPronto(col){ clearTimeout(recargas[col]); recargas[col] = setTimeout(()=>cargar(col), 250); }

let INVITES = [];
async function cargarEquipo(){
  const [r1, r2] = await Promise.all([
    sb.from('perfiles').select('id,nombre,rol,email').order('nombre'),
    sb.from('invitaciones').select('email,nombre,rol,usada,creada').order('creada', {ascending:false})
  ]);
  if(r1.error){ toast('No se pudo leer el equipo'); return; }
  EQUIPO = r1.data||[]; INVITES = (r2.data||[]).filter(i=>!i.usada);
  if(U.view==='equipo' || U.view==='historial') render();
}
let HIST = null, HIST_F = 'todo';
async function cargarHistorial(){
  if(!EQUIPO) cargarEquipo();
  let q = sb.from('auditoria').select('n,cuando,usuario,tabla,fila,accion,antes,despues').order('n', {ascending:false}).limit(300);
  if(HIST_F==='borrado') q = q.eq('accion','borrado');
  const { data, error } = await q;
  if(error){ toast('No se pudo leer el historial'); HIST = []; } else HIST = data||[];
  if(U.view==='historial') render();
}

/* ---------- ingreso ---------- */
function pantallaLogin(msg, registrar){
  document.getElementById('app').hidden = true;
  const L = document.getElementById('login'); L.hidden = false;
  L.innerHTML = '<form class="card" id="loginf" autocomplete="on">'+
    '<img src="logo-tatan.png" alt="Tatan" class="logo"><p class="muted" style="margin:0">'+(registrar?'Creá tu usuario con el mismo mail con el que te invitaron.':'Entrá con tu usuario del equipo.')+'</p>'+
    (registrar?'<label class="lb">Tu nombre<input class="f" name="nombre" required autocomplete="name"></label>':'')+
    '<label class="lb">Mail<input class="f" name="email" type="email" required autocomplete="username" inputmode="email"></label>'+
    '<label class="lb">Contraseña<input class="f" name="pass" type="password" required minlength="8" autocomplete="'+(registrar?'new-password':'current-password')+'"></label>'+
    (msg?'<p class="err">'+esc(msg)+'</p>':'')+
    '<button class="btn pri" type="submit">'+(registrar?'Crear usuario':'Entrar')+'</button>'+
    '<button class="lnk" type="button" id="logsw">'+(registrar?'Ya tengo usuario':'Soy nueva en el equipo: crear usuario')+'</button>'+
  '</form>';
  document.getElementById('logsw').onclick = () => pantallaLogin('', !registrar);
  document.getElementById('loginf').onsubmit = async ev => {
    ev.preventDefault(); const f = ev.target; const email=f.email.value.trim(), password=f.pass.value;
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    let r;
    if(registrar) r = await sb.auth.signUp({ email, password, options:{ data:{ nombre: f.nombre.value.trim() } } });
    else r = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if(r.error){
      const m = r.error.message||'';
      const txt = /invalid/i.test(m) ? 'Mail o contraseña incorrectos.'
        : /TATAN_NO_INVITADO|database error|saving new user/i.test(m) ? 'Ese mail no está invitado. Pedile a una dueña o a administración que te invite desde Más → Equipo y usuarios, con este mismo mail.'
        : /already|registered/i.test(m) ? 'Ese mail ya tiene usuario. Tocá "Ya tengo usuario" y entrá.'
        : /rate|too many/i.test(m) ? 'Demasiados intentos. Esperá unos minutos y probá de nuevo.'
        : /password/i.test(m) ? 'La contraseña tiene que tener al menos 8 caracteres.'
        : 'No se pudo entrar. Revisá la conexión y probá de nuevo.';
      pantallaLogin(txt, registrar); return;
    }
    if(registrar && !r.data.session){ pantallaLogin('Listo. Revisá tu mail para confirmar y después entrá.', false); return; }
    iniciar(r.data.session);
  };
}
function pantallaEspera(){
  document.getElementById('app').hidden = true;
  const L = document.getElementById('login'); L.hidden = false;
  L.innerHTML = '<div class="card"><h1>Tatan</h1><p>Hola '+esc((PERFIL&&PERFIL.nombre)||'')+'. Tu usuario no tiene acceso en este momento.</p><p class="muted" style="margin:0">Si creés que es un error, avisale a una dueña o a administración para que te habiliten en Más → Equipo y usuarios. Después tocá "Ya me habilitaron".</p><button class="btn pri" id="reint">Ya me habilitaron</button><button class="lnk" id="out">Cerrar sesión</button></div>';
  document.getElementById('reint').onclick = () => location.reload();
  document.getElementById('out').onclick = async () => { await sb.auth.signOut(); location.reload(); };
}

async function iniciar(session){
  USER_ID = session.user.id; USER_EMAIL = session.user.email || '';
  const { data: perf, error } = await sb.from('perfiles').select('id,nombre,rol').eq('id', USER_ID).maybeSingle();
  if(error){ pantallaLogin('No se pudo leer tu perfil. Revisá la conexión.'); return; }
  PERFIL = perf || {nombre:'', rol:'pendiente'};
  if(!FUENTES[PERFIL.rol]){ pantallaEspera(); return; }
  SECTOR = PERFIL.rol;
  document.getElementById('login').hidden = true; document.getElementById('app').hidden = false;
  mode = 'db'; route();
  const cols = Object.keys(fuentes());
  await Promise.all(cols.map(cargar));
  const slow = setTimeout(()=>{ if(loaded.size < cols.length) toast('Los datos tardan en llegar. Revisá la conexión.'); }, 10000);
  // Cambios en vivo: las tablas que el sector lee directo llegan al instante; las vistas sin precios se refrescan seguido.
  const ch = sb.channel('tatan');
  cols.forEach(col => {
    if(fuentes()[col]==='t') ch.on('postgres_changes', {event:'*', schema:'public', table:col}, pl => aplicarCambio(col, pl));
  });
  ch.subscribe();
  const vistas = cols.filter(c => fuentes()[c] !== 't');
  if(vistas.length) setInterval(()=>{ if(!document.hidden) vistas.forEach(cargar); }, 15000);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) cols.forEach(recargarPronto); });
  window.addEventListener('online', ()=>{ mode='db'; cols.forEach(recargarPronto); });
  window.addEventListener('offline', ()=>{ mode='offline'; render(); });
  clearTimeout(slow);
}

async function boot(){
  const cfg = window.TATAN_CONFIG || {};
  if(!window.supabase || !cfg.url || /PEGAR/.test(cfg.url)){
    document.getElementById('login').hidden = false;
    document.getElementById('login').innerHTML = '<div class="card"><h1>Tatan</h1><p>Falta conectar la base de datos. Completá config.js con los datos de Supabase.</p></div>';
    return;
  }
  sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth:{ persistSession:true, autoRefreshToken:true } });
  const { data } = await sb.auth.getSession();
  if(data && data.session) iniciar(data.session); else pantallaLogin('');
}

/* ---------- cálculos ---------- */
const catalogo = () => (S.catalogo && S.catalogo.items) || [];
const prodById = id => catalogo().find(p=>p.id===id);
const insumoCU = ins => (ins && ins.precio>0 && ins.presentacion>0) ? ins.precio/ins.presentacion : null;
const unidadLabel = u => ({g:'g',ml:'ml',u:'u'}[u]||esc(u||''));
function recetaCosto(r){
  const n = neg(); let ing=0, faltan=0;
  (r.ingredientes||[]).forEach(l => { const cu = insumoCU(S.insumos[l.insumoId]); if(cu==null) faltan++; else ing += cu*num(l.cant); });
  const mo = num(r.minutos)/60*num(n.costoHora); const extra = num(r.extra);
  const total = ing+mo+extra; const rinde = num(r.rinde)||1;
  return { ing, mo, extra, total, unit: total/rinde, faltan };
}
function costoProducto(p){
  if(!p) return null;
  if(p.recetaId && S.recetas[p.recetaId]){ const rc = recetaCosto(S.recetas[p.recetaId]); return { costo: rc.unit*(num(p.factor)||1) + num(p.packaging), real:true }; }
  if(p.precio) return { costo: p.precio*num(neg().costoDefault)/100, real:false };
  return null;
}
function lineaCosto(l){
  const p = l.pid ? prodById(l.pid) : null;
  if(p && p.recetaId && S.recetas[p.recetaId]){ const c = costoProducto(p); return { costo:c.costo*num(l.cant), real:true }; }
  return { costo: num(l.precio)*num(l.cant)*num(neg().costoDefault)/100, real:false };
}
const IVA_PCT = 21;
function totPedido(p){
  const sub = sum(p.items||[], l=>num(l.cant)*num(l.precio));
  const desc = num(p.descPct) ? Math.round(sub*num(p.descPct))/100 : num(p.descuento);
  const total = sub - desc; const envio = num(p.envio);
  // IVA solo en mayoristas "con IVA": los precios de lista mayorista son sin IVA. No suma a lo facturado (es del fisco).
  const iva = p.iva ? Math.round(total*IVA_PCT)/100 : 0;
  const aCobrar = total + iva + envio; const pagado = sum(p.pagos||[], x=>num(x.monto));
  return { sub, desc, total, iva, envio, aCobrar, pagado, saldo: aCobrar - pagado };
}
const pedidosArr = () => Object.values(S.pedidos);
function metricas(mes){
  const fin = mes+'-31';
  const delMes = pedidosArr().filter(p => (p.entrega||'').startsWith(mes) && p.estado!=='cancelado');
  let facturado=0, costo=0, costoReal=0, factReal=0, envios=0, entregados=0;
  const rank = {};
  delMes.forEach(p => {
    const t = totPedido(p); facturado += t.total; envios += t.envio; if(p.estado==='entregado') entregados++;
    const subBruto = t.sub || 1; const descFactor = t.sub ? t.total/t.sub : 1;
    (p.items||[]).forEach(l => {
      const lc = lineaCosto(l); costo += lc.costo; const fl = num(l.cant)*num(l.precio)*descFactor;
      if(lc.real){ costoReal += lc.costo; factReal += fl; }
      const k = l.nombre||'Sin nombre'; const r = rank[k] || (rank[k] = {nombre:k, cant:0, fact:0, costo:0, real:lc.real});
      r.cant += num(l.cant); r.fact += fl; r.costo += lc.costo;
    });
  });
  let cobrado = 0;
  pedidosArr().forEach(p => (p.pagos||[]).forEach(x => { if((x.f||'').startsWith(mes)) cobrado += num(x.monto); }));
  const porCobrar = sum(pedidosArr().filter(p => p.estado!=='cancelado' && (p.entrega||'') <= fin), p => Math.max(0, totPedido(p).saldo));
  const gastos = Object.values(S.gastos).filter(g => (g.fecha||'').startsWith(mes) && !/^(equipamiento|inversi[oó]n)/i.test(g.cat||'')); // la inversión no es gasto del mes (igual que en el Estado de Resultado)
  const fijos = sum(gastos.filter(g=>g.tipo==='fijo'), g=>num(g.monto));
  const variables = sum(gastos.filter(g=>g.tipo!=='fijo'), g=>num(g.monto));
  const sueldos = sum(Object.values(S.horas).filter(h=>(h.fecha||'').startsWith(mes)), h=>num(h.importe));
  // Compras reales del mes: facturas y remitos de proveedores (+ND −NC). Si hay, la ganancia usa esto y no la estimación por recetas.
  const compras = sum(Object.values(S.movprov||{}).filter(x=>(x.fecha||'').startsWith(mes)), x => { const t=num(x.total); return x.tipo==='NC' ? -t : (x.tipo==='PAGO' ? 0 : t); });
  const usaCompras = compras > 0;
  const ganancia = facturado - (usaCompras ? compras : costo) - fijos - variables - sueldos;
  return { compras, usaCompras, sueldos, facturado, costo, envios, entregados, cantPedidos: delMes.length, cobrado, porCobrar, fijos, variables, ganancia, margen: facturado? ganancia/facturado : null, cobertura: facturado? factReal/facturado : 0, rank: Object.values(rank) };
}
function saldoCliente(cid){ return sum(pedidosArr().filter(p=>p.clienteId===cid && p.estado!=='cancelado'), p=>Math.max(0,totPedido(p).saldo)); }

/* ---------- estado de UI ---------- */
const U = { view:'inicio', mes: today().slice(0,7), fPed:'activos', fCanal:'', q:'', costosTab:'recetas', fCat:'', qCat:'', qIns:'', fInsCat:'' };
const VIEWS = ['estadisticas','semana','empleados','proveedores','equipo','historial','inicio','pedidos','presupuestos','produccion','stockpt','costos','mas','gastos','clientes','catalogo','stock','ajustes'];
const TABSETS = {
  todo:[['inicio','Inicio','home'],['pedidos','Pedidos','bag'],['produccion','Producción','whisk'],['presupuestos','Presupuestos','doc'],['mas','Más','dots']],
  local:[['pedidos','Pedidos','bag'],['presupuestos','Presupuestos','doc'],['stockpt','Stock','box'],['produccion','Producción','whisk'],['mas','Más','dots']],
  cocina:[['semana','Semana','bag'],['produccion','Producción','whisk'],['stockpt','Stock','box'],['stock','Mercadería','tag']]
};
const ALLOWED = { todo: VIEWS, local:['semana','pedidos','presupuestos','stockpt','produccion','mas','clientes','catalogo','estadisticas'], cocina:['semana','produccion','stockpt','stock'] };
const SUBOF = {estadisticas:'mas',semana:'produccion',empleados:'mas',proveedores:'mas',equipo:'mas',historial:'mas',gastos:'mas',clientes:'mas',catalogo:'mas',stock:'mas',ajustes:'mas',costos:'mas'};
const verPlata = () => SECTOR==='todo';
function route(){ const h = (location.hash||'').slice(1); const ok = ALLOWED[SECTOR]||VIEWS; U.view = (VIEWS.includes(h) && ok.includes(h)) ? h : TABSETS[SECTOR][0][0]; if(U.view==='historial') HIST=null; render(); window.scrollTo(0,0); }
window.addEventListener('hashchange', route);

/* ---------- render principal ---------- */
function render(){
  setSync();
  const n = neg();
  document.getElementById('brand').innerHTML = '<img src="logo-tatan.png" alt="'+esc(n.nombre||'Tatan')+'" class="logo">';
  const tabs = TABSETS[SECTOR] || TABSETS.todo;
  const active = tabs.some(t=>t[0]===U.view) ? U.view : (SUBOF[U.view] || U.view);
  document.getElementById('tabs').style.gridTemplateColumns = 'repeat('+tabs.length+',1fr)';
  document.getElementById('secbtn').textContent = (PERFIL && PERFIL.nombre) ? PERFIL.nombre.split(' ')[0] : 'Cuenta';
  document.getElementById('tabs').innerHTML = tabs.map(([k,l,ic]) => '<a href="#'+k+'"'+(k===active?' aria-current="page"':'')+'>'+svg(ic)+'<span>'+l+'</span></a>').join('');
  if(mode==='loading') return;
  const ae = document.activeElement; const keep = ae && ae.id && document.getElementById('view').contains(ae) ? {id:ae.id, s:ae.selectionStart, e:ae.selectionEnd} : null;
  const v = document.getElementById('view'); v.classList.toggle('wide', U.view==='semana');
  v.innerHTML = (readOnly?'<div class="banner">Estás viendo en modo lectura. Para cargar pedidos pedí acceso de edición.</div>':'') + (R[U.view]||R.inicio)();
  if(keep){ const el=document.getElementById(keep.id); if(el){ el.focus(); try{ el.setSelectionRange(keep.s,keep.e); }catch(e){} } }
}

const R = {};
const TIPOS_MOV = ['FACTURA','REMITO','NC','ND','PAGO'];
const TIPO_LBL = {FACTURA:'Factura', REMITO:'Remito', NC:'Nota de crédito', ND:'Nota de débito', PAGO:'Pago'};
const signoMov = t => (t==='PAGO'||t==='NC') ? -1 : 1;
const slug = s => norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'sin-nombre';
const provKey = m => slug(m.proveedor);
const movsArr = () => Object.values(S.movprov);
function cuentasProv(){
  const c = {};
  Object.values(S.proveedores).forEach(p => { c[p.id] = {id:p.id, nombre:p.nombre, p, saldo:0, compras:0, pagos:0, ult:'', n:0}; });
  const mes = today().slice(0,7);
  movsArr().forEach(m => { const k='pv-'+provKey(m); const x = c[k] || (c[k] = {id:k, nombre:m.proveedor||'Sin proveedor', p:null, saldo:0, compras:0, pagos:0, ult:'', n:0});
    const t = num(m.total); x.saldo += signoMov(m.tipo)*t; x.n++; if((m.fecha||'')>x.ult) x.ult=m.fecha||'';
    if((m.fecha||'').startsWith(U.mes)){ if(m.tipo==='PAGO') x.pagos+=t; else if(m.tipo!=='NC') x.compras+=t; } });
  return Object.values(c);
}
const deudaTotal = () => sum(cuentasProv(), x => Math.max(0, x.saldo));
const RUBROS_DEF = () => [...new Set(movsArr().map(m=>m.rubro).filter(Boolean).concat(Object.values(S.proveedores).map(p=>p.rubro).filter(Boolean)))].sort();
const hhmm = h => { h=num(h); const t=Math.round(h*60); return Math.floor(t/60)+':'+pad(t%60); };
const aHoras = v => { if(v instanceof Date && !isNaN(v)) return v.getHours()+v.getMinutes()/60; if(typeof v==='number') return v<1 ? v*24 : v; const m=String(v||'').trim().match(/^(\d{1,2}):(\d{2})/); return m ? +m[1]+(+m[2])/60 : num(v); };
const aHora = v => { if(v instanceof Date && !isNaN(v)) return pad(v.getHours())+':'+pad(v.getMinutes()); if(typeof v==='number'){ const t=Math.round((v<1?v*24:v)*60); return pad(Math.floor(t/60)%24)+':'+pad(t%60); } const m=String(v||'').trim().match(/^(\d{1,2}):(\d{2})/); return m? pad(+m[1])+':'+m[2] : ''; };
const empKey = n => 'em-'+slug(n);
const NOV_TIPOS = ['Vacaciones','Enfermedad','Enfermedad familiar','Falta','Adelanto','Consumo en cuenta corriente','Aguinaldo','Aumento','Uniforme','Libreta sanitaria','Otro'];
function cuentasEmp(mes){
  const c = {};
  Object.values(S.empleados).forEach(e => { c[e.id] = {id:e.id, nombre:e.nombre, e, horas:0, importe:0, turnos:0, nov:0, desc:0}; });
  Object.values(S.horas).forEach(h => { if(!(h.fecha||'').startsWith(mes)) return; const k=empKey(h.empleado); const x=c[k]||(c[k]={id:k, nombre:h.empleado, e:null, horas:0, importe:0, turnos:0, nov:0, desc:0}); x.horas+=num(h.horas); x.importe+=num(h.importe); x.turnos++; });
  Object.values(S.novedades).forEach(n => { if(!(n.desde||n.fecha||'').startsWith(mes)) return; const k=empKey(n.empleado); const x=c[k]; if(!x) return; x.nov++; if(['Adelanto','Consumo en cuenta corriente'].includes(n.tipo)) x.desc+=num(n.monto); });
  return Object.values(c);
}
R.empleados = function(){
  const cs = cuentasEmp(U.mes); const verTodos = U.fEmp==='todos';
  const list = cs.filter(x => verTodos || (x.e ? x.e.activo!==false : x.turnos>0) || x.turnos>0).sort((a,b)=> b.importe-a.importe || a.nombre.localeCompare(b.nombre));
  const tot = sum(cs,x=>x.importe), hs = sum(cs,x=>x.horas), desc = sum(cs,x=>x.desc);
  const chip = (v,l) => '<button class="chip" data-act="fEmp" data-v="'+v+'" aria-pressed="'+((U.fEmp||'')===v)+'">'+l+'</button>';
  return `<div class="stack">
    <div class="row between"><a href="#mas" class="muted">‹ Más</a><div class="row" style="gap:8px"><button class="btn sm" data-act="nuevoEmp">${svg('plus')}Empleado</button><button class="btn pri sm" data-act="nuevoTurno">${svg('plus')}Horas</button></div></div>
    <div class="monthbar"><button class="btn" data-act="mes" data-n="-1" aria-label="Mes anterior">‹</button><div style="text-align:center"><div class="eyebrow">Empleados</div><h1>${esc(mesLabel(U.mes))}</h1></div><button class="btn" data-act="mes" data-n="1" aria-label="Mes siguiente">›</button></div>
    <div class="tiles" style="grid-template-columns:repeat(3,1fr)"><div class="tile"><span class="k">Horas</span><span class="v num">${hhmm(hs)}</span></div><div class="tile"><span class="k">A pagar</span><span class="v num">${$(tot)}</span></div><div class="tile"><span class="k">Adelantos y consumos</span><span class="v num">${$(desc)}</span></div></div>
    <div class="chips">${chip('','Activos')}${chip('todos','Todos')}<button class="chip" data-act="nuevaNov">+ Novedad</button></div>
    ${list.length? '<div class="list">'+list.map(x=>'<button class="item" data-act="verEmp" data-id="'+esc(x.id)+'"><div class="main"><span class="t">'+esc(titulo(x.nombre))+'</span><span class="s">'+(x.e&&x.e.puesto?esc(titulo(x.e.puesto))+' · ':'')+(x.turnos? x.turnos+' turnos · '+hhmm(x.horas)+' h' : 'sin horas este mes')+(x.nov?' · '+x.nov+' novedad'+(x.nov>1?'es':''):'')+'</span></div><div class="end"><span class="num" style="font-weight:700">'+$(x.importe)+'</span>'+(x.desc?'<span class="pill p-warn">− '+$(x.desc)+'</span>':'')+'</div></button>').join('')+'</div>'
      : '<div class="card empty"><p>Cargá a tu equipo o importá la planilla EMPLEADOS desde Más → Importar desde planillas.</p></div>'}
  </div>`;
};
const lunesDe = iso => { const d=new Date(iso+'T12:00:00'); const w=(d.getDay()+6)%7; d.setDate(d.getDate()-w); return isoDate(d); };
const DIAS_LARGOS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const esVentaDia = p => p.origen==='bistrosoft' || p.clienteNombre==='Mostrador';
R.semana = function(){
  const ini = U.semana || lunesDe(today()); const fin = addDays(ini,6);
  const fc = U.fSem==='may' ? 'may' : 'min'; const q = norm(U.qSem||'');
  let peds = pedidosArr().filter(p => (p.entrega||'')>=ini && (p.entrega||'')<=fin && p.estado!=='cancelado' && !esVentaDia(p));
  if(fc==='may') peds = peds.filter(p=>p.canal==='Mayorista'); if(fc==='min') peds = peds.filter(p=>p.canal!=='Mayorista');
  if(q) peds = peds.filter(p=>norm(p.clienteNombre+' '+(p.items||[]).map(i=>i.nombre).join(' ')+' '+(p.notas||'')).includes(q));
  const totItems = sum(peds,p=>(p.items||[]).length), listos = sum(peds,p=>(p.items||[]).filter(i=>i.listo).length);
  const dias = []; for(let i=0;i<7;i++){ const f=addDays(ini,i); const ps=peds.filter(p=>p.entrega===f).sort(byEntrega); if(i<6 || ps.length) dias.push({f, i, ps}); }
  const card = p => { const its=p.items||[]; const l=its.filter(x=>x.listo).length; const done=its.length && l===its.length;
    return '<div class="wcard'+(done?' done':'')+'"><div class="wh"><div><b>'+esc(p.clienteNombre||'Sin nombre')+'</b>'+(p.retiraOtro&&p.retiraNombre?' <span class="muted" style="font-size:12.5px">· retira '+esc(p.retiraNombre)+'</span>':'')+(p.hora?' <span class="muted num" style="font-size:12.5px">'+esc(p.hora)+'</span>':'')+'</div>'+(p.canal==='Mayorista'?'<span class="pill p-neu">May.</span>':'')+'</div>'+
      (its.length?'<div class="bar"><i style="width:'+(l/its.length*100)+'%"></i></div>':'')+
      '<div class="cklist">'+its.map((x,i)=>'<div class="ckrow'+(x.listo?' done':'')+'">'+check(x.listo,'tglPed','data-id="'+p.id+'" data-i="'+i+'"')+'<span class="ckn"><b class="num">'+esc(fmtNum(x.cant))+'</b> '+esc(x.nombre)+'</span></div>').join('')+'</div>'+
      (p.notas?'<div class="wnote">'+esc(p.notas)+'</div>':'')+
      '<div class="row" style="justify-content:flex-end;gap:6px">'+(!done&&its.length?'<button class="btn sm ghost" data-act="todoListo" data-id="'+p.id+'">Todo listo</button>':'')+(SECTOR!=='cocina'?'<button class="btn sm ghost" data-act="editPedido" data-id="'+p.id+'">Abrir</button>':'')+'</div></div>'; };
  const tot = {}; peds.forEach(p=>(p.items||[]).forEach(x=>{ const k=norm(x.nombre).trim(); const t=tot[k]||(tot[k]={n:x.nombre,c:0,l:0}); t.c+=num(x.cant); if(x.listo) t.l+=num(x.cant); }));
  const totList = Object.values(tot).sort((a,b)=>b.c-a.c);
  const chip = (v,l) => '<button class="chip" data-act="fSem" data-v="'+v+'" aria-pressed="'+(fc===v)+'">'+l+'</button>';
  return `<div class="stack">
    <div class="monthbar"><button class="btn" data-act="semNav" data-n="-7" aria-label="Semana anterior">‹</button><div style="text-align:center"><div class="eyebrow">Pedidos de la semana</div><h1>${fdateShort(ini).replace(/^\S+ /,'')} al ${fdateShort(addDays(ini,5)).replace(/^\S+ /,'')}</h1></div><button class="btn" data-act="semNav" data-n="7" aria-label="Semana siguiente">›</button></div>
    <div class="row between" style="flex-wrap:wrap;gap:8px"><div class="chips">${chip('min','Minoristas')}${chip('may','Mayoristas')}${ini!==lunesDe(today())?'<button class="chip" data-act="semHoy">Esta semana</button>':''}</div>
      <div class="row" style="gap:8px"><span class="pill ${totItems&&listos===totItems?'p-ok':'p-pis'}">${listos}/${totItems} listos</span>${SECTOR!=='cocina'?'<button class="btn sm" data-act="nuevoPedido">'+svg('plus')+'Minorista</button><button class="btn pri sm" data-act="nuevoMay">'+svg('plus')+'Mayorista</button>':''}</div></div>
    <div class="search">${svg('search')}<input class="f" id="qsem" placeholder="Buscar cliente o producto" value="${esc(U.qSem||'')}" data-bind="qSem"></div>
    <div class="week">${dias.map(d=>'<section class="wday'+(d.f===today()?' hoy':'')+'"><h3><span>'+DIAS_LARGOS[d.i]+' '+(+d.f.slice(8))+'/'+(+d.f.slice(5,7))+'</span><span class="muted num" style="font-size:12px">'+(d.ps.length?d.ps.length+' ped.':'')+'</span></h3>'+(d.ps.length?d.ps.map(card).join(''):'<div class="wempty">Sin pedidos</div>')+'</section>').join('')}</div>
    ${totList.length?'<details class="card"><summary><b>Total de la semana por producto</b> <span class="muted">('+totList.length+')</span></summary><div class="totsem" style="margin-top:8px">'+totList.map(t=>'<div><span>'+esc(t.n)+'</span><span class="num">'+(t.l?'<span class="muted">'+fmtNum(t.l)+'/</span>':'')+fmtNum(t.c)+'</span></div>').join('')+'</div></details>':''}
  </div>`;
};
const fmtNum = n => { n=num(n); return Number.isInteger(n) ? String(n) : n.toLocaleString('es-AR',{maximumFractionDigits:2}); };
R.proveedores = function(){
  const cs = cuentasProv(); const q = norm(U.qProv||'');
  let list = cs.filter(x => !q || norm(x.nombre).includes(q) || norm(x.p&&x.p.razonSocial).includes(q));
  if(U.fProv==='deben') list = list.filter(x => x.saldo > 0.5);
  list.sort((a,b)=> U.fProv==='deben' ? b.saldo-a.saldo : (b.ult||'').localeCompare(a.ult||'') || a.nombre.localeCompare(b.nombre));
  const compras = sum(cs, x=>x.compras), pagos = sum(cs, x=>x.pagos), deuda = sum(cs, x=>Math.max(0,x.saldo));
  const chip = (v,l) => '<button class="chip" data-act="fProv" data-v="'+v+'" aria-pressed="'+((U.fProv||'')===v)+'">'+l+'</button>';
  return `<div class="stack">
    <div class="row between"><a href="#mas" class="muted">‹ Más</a><div class="row" style="gap:8px"><button class="btn sm" data-act="nuevoProv">${svg('plus')}Proveedor</button><button class="btn pri sm" data-act="nuevoMov">${svg('plus')}Comprobante</button></div></div>
    <div class="monthbar"><button class="btn" data-act="mes" data-n="-1" aria-label="Mes anterior">‹</button><div style="text-align:center"><div class="eyebrow">Proveedores</div><h1>${esc(mesLabel(U.mes))}</h1></div><button class="btn" data-act="mes" data-n="1" aria-label="Mes siguiente">›</button></div>
    <div class="tiles" style="grid-template-columns:repeat(3,1fr)"><div class="tile"><span class="k">Compras del mes</span><span class="v num">${$(compras)}</span></div><div class="tile"><span class="k">Pagado del mes</span><span class="v num">${$(pagos)}</span></div><div class="tile"><span class="k">Deuda total</span><span class="v num" style="color:var(--bad)">${$(deuda)}</span></div></div>
    <div class="search">${svg('search')}<input class="f" id="qprov" placeholder="Buscar proveedor" value="${esc(U.qProv||'')}" data-bind="qProv"></div>
    <div class="chips">${chip('','Todos')}${chip('deben','Les debemos')}</div>
    ${list.length? '<div class="list">'+list.map(x=>'<button class="item" data-act="verProv" data-id="'+esc(x.id)+'"><div class="main"><span class="t">'+esc(x.nombre)+'</span><span class="s">'+(x.p&&x.p.rubro?esc(x.p.rubro)+' · ':'')+(x.ult?'último movimiento '+fdate(x.ult):'sin movimientos')+(x.compras?' · compras del mes '+$(x.compras):'')+'</span></div><div class="end"><span class="num" style="font-weight:700'+(x.saldo>0.5?';color:var(--bad)':'')+'">'+(Math.abs(x.saldo)<0.5?'$ 0':$(x.saldo))+'</span><span class="pill '+(x.saldo>0.5?'p-bad':x.saldo<-0.5?'p-ok':'p-neu')+'">'+(x.saldo>0.5?'Le debemos':x.saldo<-0.5?'A favor':'Al día')+'</span></div></button>').join('')+'</div>'
      : '<div class="card empty"><p>Todavía no hay proveedores. Cargá uno, o importá tu planilla de PROVEEDORES desde Más → Importar desde planillas.</p></div>'}
  </div>`;
};

/* ===== INICIO ===== */
R.inicio = function(){
  const m = metricas(U.mes); const n = neg();
  const prox = pedidosArr().filter(p => ['pendiente','produccion','listo'].includes(p.estado||'pendiente') && (p.entrega||'') >= today() && (p.entrega||'') <= addDays(today(),7)).sort(byEntrega).slice(0,8);
  const atrasados = pedidosArr().filter(p => ['pendiente','produccion','listo'].includes(p.estado||'pendiente') && (p.entrega||'9') < today());
  const rank = m.rank.map(r=>Object.assign(r,{gan:r.fact-r.costo, mg: r.fact? (r.fact-r.costo)/r.fact : 0})).sort((a,b)=>b.gan-a.gan).slice(0,8);
  const bajos = Object.values(S.insumos).filter(i => i.minimo>0 && num(i.stock) <= num(i.minimo));
  const tile = (k,v,h,cls) => '<div class="tile"><span class="k">'+k+'</span><span class="v num'+(cls?' '+cls:'')+'">'+v+'</span>'+(h?'<span class="h">'+h+'</span>':'')+'</div>';
  return `
  <div class="stack">
    <div class="monthbar">
      <button class="btn" data-act="mes" data-n="-1" aria-label="Mes anterior">‹</button>
      <div style="text-align:center"><div class="eyebrow">Resumen del mes</div><h1>${esc(mesLabel(U.mes))}</h1></div>
      <button class="btn" data-act="mes" data-n="1" aria-label="Mes siguiente">›</button>
    </div>
    <div class="hero">
      <span class="eyebrow" style="color:inherit;opacity:.75">${m.usaCompras?'Ganancia neta del mes':'Ganancia neta estimada'}</span>
      <span class="big num">${$(m.ganancia)}</span>
      <div class="sub"><span>Margen neto <b class="num">${pct(m.margen)}</b></span><span>${m.cantPedidos} pedidos del mes · ${m.entregados} entregados</span></div>
    </div>
    <div class="tiles">
      ${tile('Facturado',$(m.facturado),'productos, sin envíos')}
      ${tile('Cobrado',$(m.cobrado),'pagos y señas del mes')}
      ${tile('Por cobrar',$(m.porCobrar),'saldos pendientes', m.porCobrar>0?'':'')}
      ${m.usaCompras ? tile('Compras a proveedores',$(m.compras),'facturas y remitos del mes'+(m.facturado?' · '+pct(m.compras/m.facturado):'')) : tile('Costo de productos',$(m.costo), m.facturado? pct(m.costo/m.facturado)+' de lo facturado':'')}
      ${tile('Gastos fijos',$(m.fijos),'<a href="#gastos">ver gastos</a>')}
      ${tile('Gastos variables',$(m.variables),'')}
      ${tile('Sueldos por horas',$(m.sueldos),'<a href="#empleados">ver empleados</a>')}
      ${tile('Envíos cobrados',$(m.envios),'van aparte, no suman ganancia')}
      ${tile('Pedidos entregados',String(m.entregados),'de '+m.cantPedidos+' del mes')}
    </div>
    ${m.usaCompras ? '<div class="note">Ganancia = facturado − compras a proveedores − gastos − sueldos del mes. Si una factura de proveedor o un sueldo todavía no está cargado, el mes da de más.</div>' : m.facturado ? '<div class="note">El costo sale de tus recetas para el '+pct(m.cobertura)+' de lo facturado. Para el resto se estima un '+num(n.costoDefault)+'% del precio (lo cambiás en <a href="#ajustes">Ajustes</a>). Cuantas más recetas cargues, más exacta la ganancia.</div>' : ''}
    <div class="quick">
      <button class="btn" data-act="nuevoPedido">${svg('bag')}Nuevo pedido</button>
      <button class="btn" data-act="ventaLocal">${svg('cash')}Venta local</button>
      <button class="btn" data-act="nuevoGasto">${svg('receipt')}Cargar gasto</button>
    </div>
  </div>
  ${atrasados.length?`<div class="sec"><div class="banner">${atrasados.length} pedido${atrasados.length>1?'s':''} con fecha pasada sin marcar como entregado. <a href="#pedidos">Revisalos</a>.</div></div>`:''}
  <div class="sec">
    <div class="sec-h"><h2>Próximas entregas</h2><a href="#pedidos" class="muted">Ver todos</a></div>
    ${prox.length ? '<div class="list">'+prox.map(pedidoItem).join('')+'</div>' : '<div class="card empty"><p>No hay entregas en los próximos 7 días.</p><button class="btn pri" data-act="nuevoPedido">Cargar un pedido</button></div>'}
  </div>
  <div class="sec">
    <div class="sec-h"><h2>Rentabilidad por producto</h2><span class="muted" style="font-size:12.5px">${esc(mesLabel(U.mes))}</span></div>
    ${rank.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Vendidos</th><th class="r">Facturado</th><th class="r">Ganancia</th><th style="width:90px">Margen</th></tr></thead><tbody>'+
      rank.map(r=>'<tr><td>'+esc(r.nombre)+(r.real?'':' <span class="pill p-neu" title="Sin receta: costo estimado">est.</span>')+'</td><td class="r num">'+(Math.round(r.cant*10)/10).toLocaleString('es-AR')+'</td><td class="r num">'+$(r.fact)+'</td><td class="r num">'+$(r.gan)+'</td><td><div class="bar"><i class="'+(r.mg<0?'neg':r.mg<.4?'low':'')+'" style="width:'+Math.max(4,Math.min(100,r.mg*100))+'%"></i></div><span class="num" style="font-size:11.5px">'+pct(r.mg)+'</span></td></tr>').join('')+
      '</tbody></table></div>' : '<div class="card empty"><p>Cuando cargues pedidos de este mes vas a ver qué productos te dejan más ganancia.</p></div>'}
  </div>
  ${bajos.length?`<div class="sec"><div class="sec-h"><h2>Falta mercadería</h2><a href="#stock" class="muted">Stock</a></div><div class="list">${bajos.map(i=>'<button class="item" data-act="stockMov" data-id="'+i.id+'"><div class="main"><span class="t">'+esc(i.nombre)+'</span><span class="s">Quedan '+fmtCant(i.stock,i.unidad)+' · avisar con '+fmtCant(i.minimo,i.unidad)+'</span></div><span class="pill '+(num(i.stock)<=0?'p-bad':'p-warn')+'">'+(num(i.stock)<=0?'Sin stock':'Poco stock')+'</span></button>').join('')}</div></div>`:''}
  `;
};
const byEntrega = (a,b) => ((a.entrega||'')+(a.hora||'')).localeCompare((b.entrega||'')+(b.hora||''));
const ESTADOS = {pendiente:['Pendiente','p-neu'], produccion:['En producción','p-pis'], listo:['Listo','p-acc'], entregado:['Entregado','p-ok'], cancelado:['Cancelado','p-bad']};
const CANALES = ['Pedido particular','Local','Evento','Fecha especial','Mayorista','Empresa','Cuenta corriente'];
const CANALES_MIN = ['Local','WhatsApp','Cuenta corriente'];
const MEDIOS = ['Efectivo','Transferencia','QR Galicia','Mercado Pago','Tarjeta','Cuenta corriente'];
function saldoPill(p){ const t = totPedido(p); if(t.aCobrar<=0) return ''; if(t.saldo<=0.5) return '<span class="pill p-ok">Pagado</span>'; if(t.pagado>0) return '<span class="pill p-warn">Debe '+$(t.saldo)+'</span>'; return '<span class="pill p-bad">Sin seña</span>'; }
function pedidoItem(p){
  const t = totPedido(p); const d = p.entrega? new Date(p.entrega+'T12:00:00') : null; const e = ESTADOS[p.estado||'pendiente'];
  const resumen = (p.items||[]).map(l => (num(l.cant)!==1?l.cant+'× ':'')+l.nombre).join(', ');
  return '<button class="item" data-act="editPedido" data-id="'+p.id+'">'+
    '<div class="datechip'+(p.entrega===today()?' today':'')+'">'+(d?'<span>'+DIAS[d.getDay()]+'</span><b>'+d.getDate()+'</b>':'<b>?</b>')+'</div>'+
    '<div class="main"><span class="t">'+esc(p.clienteNombre||'Sin nombre')+(p.remito?' <span class="muted" style="font-weight:500">· Rto '+esc(p.remito)+'</span>':'')+(p.retiraOtro&&p.retiraNombre?' <span class="muted" style="font-weight:500">· retira '+esc(p.retiraNombre)+'</span>':'')+(p.hora?' <span class="muted" style="font-weight:500">· '+esc(p.hora)+'</span>':'')+'</span><span class="s">'+esc(resumen||'Sin productos')+'</span>'+
    '<span class="row" style="gap:5px"><span class="pill '+e[1]+'">'+e[0]+'</span>'+progresoPill(p)+(p.canal&&p.canal!=='Pedido particular'&&p.canal!=='Mayorista'?'<span class="pill p-neu">'+esc(p.canal)+'</span>':'')+(p.canal==='Fecha especial'&&p.cuentaCorriente?'<span class="pill p-acc">Cuenta corriente</span>':'')+(p.iva?'<span class="pill p-neu">Con IVA</span>':'')+'</span></div>'+
    '<div class="end"><span class="num" style="font-weight:700">'+$(t.aCobrar)+'</span>'+saldoPill(p)+'</div></button>';
}
/* ===== PEDIDOS ===== */
function vistaPedBtns(){ const v=U.pedVista||'semana'; return '<div class="subtabs" style="min-width:180px"><button data-act="pedVista" data-v="semana" aria-pressed="'+(v==='semana')+'">Semana</button><button data-act="pedVista" data-v="lista" aria-pressed="'+(v==='lista')+'">Lista</button></div>'; }
/* Fecha especial → Cantidad: cuánto hay pedido de cada producto, por fecha de entrega, para saber qué producir */
function cantidadesFE(arr){
  const desde = today(); const porFecha = {}; const tot = {};
  arr.filter(p=>p.estado!=='cancelado' && (p.entrega||'')>=desde).forEach(p=>{ const k=p.entrega||''; const m=porFecha[k]||(porFecha[k]={n:0,prod:{}}); m.n++;
    (p.items||[]).forEach(l=>{ const nom=(l.nombre||'Sin nombre').trim(); const c=num(l.cant); m.prod[nom]=(m.prod[nom]||0)+c; tot[nom]=(tot[nom]||0)+c; }); });
  const fechas = Object.keys(porFecha).sort();
  if(!fechas.length) return '<div class="card empty"><h2>No hay pedidos de fecha especial por delante</h2><p>Cuando se carguen, acá vas a ver cuánto hay que producir de cada producto, día por día.</p></div>';
  const tabla = prod => '<table class="stat-t"><thead><tr><th>Producto</th><th class="num" style="text-align:right">Cantidad</th></tr></thead><tbody>'+
    Object.entries(prod).sort((a,b)=>a[0].localeCompare(b[0],'es')).map(([n,c])=>'<tr><td>'+esc(n)+'</td><td class="num" style="text-align:right"><b>'+c.toLocaleString('es-AR')+'</b></td></tr>').join('')+'</tbody></table>';
  return '<div class="note">Desde hoy en adelante, sin los cancelados. Sirve para saber cuánto producir para cada día.</div>'+
    fechas.map(k=>'<div class="group-h">'+esc(k?fdateShort(k):'Sin fecha')+' · '+porFecha[k].n+' pedido'+(porFecha[k].n===1?'':'s')+'</div><div class="card">'+tabla(porFecha[k].prod)+'</div>').join('')+
    (fechas.length>1?'<div class="group-h">Total de todas las fechas</div><div class="card">'+tabla(tot)+'</div>':'');
}
R.pedidos = function(){
  const f = U.fPed, q = norm(U.q);
  let arr = pedidosArr();
  if(f==='activos') arr = arr.filter(p=>['pendiente','produccion','listo'].includes(p.estado||'pendiente'));
  if(f==='entregados') arr = arr.filter(p=>p.estado==='entregado');
  if(f==='deben') arr = arr.filter(p=>p.estado!=='cancelado' && totPedido(p).saldo>0.5);
  if((U.pedVista||'semana')==='semana') return '<div class="stack"><div class="row between"><h1>Pedidos</h1>'+vistaPedBtns()+'</div>'+R.semana()+'</div>';
  const may = false, fe = true; // la lista es solo de fecha especial; minoristas y mayoristas se ven en la semana
  arr = arr.filter(p => may ? p.canal==='Mayorista' : fe ? p.canal==='Fecha especial' : (p.canal!=='Mayorista' && p.canal!=='Fecha especial'));
  if(!may && !fe) arr = arr.filter(p=>!esVentaDia(p));
  if(!may && U.fCanal) arr = arr.filter(p=>(p.canal||'Pedido particular')===U.fCanal);
  if(q) arr = arr.filter(p=> norm(p.clienteNombre+' '+(p.remito||'')+' '+(p.items||[]).map(l=>l.nombre).join(' ')+' '+(p.notas||'')).includes(q));
  const feCant = (fe && f==='cantidad') ? cantidadesFE(arr) : null;
  arr.sort(byEntrega); if(f==='entregados'||f==='todos') arr.reverse();
  const totalArr = arr.length; const lim = U.pedLim||120; arr = arr.slice(0, lim);
  const groups = []; let cur=null;
  arr.forEach(p => { const k = p.entrega||''; if(!cur||cur.k!==k){ cur={k,items:[]}; groups.push(cur);} cur.items.push(p); });
  const gname = k => !k?'Sin fecha': k===today()?'Hoy · '+fdateShort(k): k===addDays(today(),1)?'Mañana · '+fdateShort(k): k<today()? fdateShort(k)+' · pasado' : fdateShort(k);
  const chip = (k,l) => '<button class="chip" data-act="fPed" data-v="'+k+'" aria-pressed="'+(f===k)+'">'+l+'</button>';
  return `<div class="stack">
    <div class="row between"><h1>Pedidos</h1><div class="row">${vistaPedBtns()}<button class="btn pri sm" data-act="${may?'nuevoMay':fe?'nuevoFE':'nuevoPedido'}">${svg('plus')}${may?'Nuevo mayorista':fe?'Nuevo pedido fecha especial':'Nuevo minorista'}</button></div></div>
    <div class="search">${svg('search')}<input class="f" id="qped" placeholder="${may?'Buscar por cliente, remito o producto':'Buscar por cliente o producto'}" value="${esc(U.q)}" data-bind="q"></div>
    <div class="chips">${chip('activos','Activos')}${chip('deben','Deben plata')}${chip('entregados','Entregados')}${chip('todos','Todos')}${fe?chip('cantidad','Cantidad'):''}
      ${may||fe?'':'<select class="chip" id="fcanal" data-bind="fCanal" aria-label="Canal"><option value="">Todos los canales</option>'+CANALES_MIN.map(c=>'<option'+(U.fCanal===c?' selected':'')+'>'+c+'</option>').join('')+'</select>'}</div>
    ${feCant!=null ? feCant : groups.length ? groups.map(g=>'<div class="group-h">'+esc(gname(g.k))+'</div><div class="list">'+g.items.map(p=>f==='activos'?'<div class="itemwrap">'+pedidoItem(p)+'<button class="btn sm ent" data-act="entAsk" data-id="'+esc(p.id)+'">Entregado</button></div>':pedidoItem(p)).join('')+'</div>').join('') + (totalArr>lim?'<button class="btn" data-act="masPed">Ver más ('+(totalArr-lim).toLocaleString('es-AR')+')</button>':'') :
      (may ? '<div class="card empty"><h2>No hay pedidos mayoristas acá</h2><p>Cargá el pedido con el cliente, el remito y los productos con el precio de la lista mayorista.</p><button class="btn pri" data-act="nuevoMay">Nuevo pedido mayorista</button></div>'
           : fe ? '<div class="card empty"><h2>No hay pedidos de fecha especial acá</h2><p>Cuando carguemos los pedidos de fechas especiales los vas a ver en esta lista.</p></div>'
           : '<div class="card empty"><h2>No hay pedidos acá</h2><p>Cargá un pedido con fecha de entrega, seña y saldo. Lo ves en Inicio y en la lista del día.</p><button class="btn pri" data-act="nuevoPedido">Nuevo pedido</button></div>')}
  </div>`;
};
/* ===== PRESUPUESTOS ===== */
function estadoPresu(p){ if(p.estado==='aceptado') return ['Aceptado','p-ok']; if(p.estado==='rechazado') return ['Rechazado','p-bad']; if(p.validoHasta && p.validoHasta<today()) return ['Vencido','p-neu']; return ['Enviado','p-acc']; }
R.presupuestos = function(){
  const arr = Object.values(S.presupuestos).sort((a,b)=>(b.numero||0)-(a.numero||0));
  return `<div class="stack">
    <div class="row between"><h1>Presupuestos</h1><button class="btn pri sm" data-act="nuevoPresu">${svg('plus')}Nuevo</button></div>
    <p class="muted" style="margin:0">Armá el presupuesto con tu lista de precios, mandalo y, cuando lo confirman, pasalo a pedido con un toque.</p>
    ${arr.length ? '<div class="list">'+arr.map(p=>{ const e=estadoPresu(p); const t=totPedido(p).aCobrar;
      return '<button class="item" data-act="editPresu" data-id="'+p.id+'"><div class="datechip"><span>N°</span><b>'+pad(p.numero||0)+'</b></div><div class="main"><span class="t">'+esc(p.clienteNombre||'Sin cliente')+'</span><span class="s">'+esc(p.evento||'')+(p.fechaEvento?' · '+fdate(p.fechaEvento):'')+(p.invitados?' · '+p.invitados+' invitados':'')+'</span><span><span class="pill '+e[1]+'">'+e[0]+'</span></span></div><div class="end"><span class="num" style="font-weight:700">'+$(t)+'</span></div></button>'; }).join('')+'</div>'
      : '<div class="card empty"><h2>Todavía no hay presupuestos</h2><button class="btn pri" data-act="nuevoPresu">Armar el primero</button></div>'}
  </div>`;
};
/* ===== COSTOS ===== */
R.costos = function(){
  const t = U.costosTab;
  const st = (k,l) => '<button data-act="costosTab" data-v="'+k+'" aria-pressed="'+(t===k)+'">'+l+'</button>';
  let body='';
  if(t==='recetas'){
    const arr = Object.values(S.recetas).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
    body = `<div class="row between"><p class="muted" style="margin:0;flex:1;min-width:200px">Cada receta calcula su costo con los precios de tus insumos, la mano de obra y el packaging.</p><button class="btn pri sm" data-act="nuevaReceta">${svg('plus')}Receta</button></div>`+
      (arr.length? '<div class="list">'+arr.map(r=>{ const c=recetaCosto(r); const prods=catalogo().filter(p=>p.recetaId===r.id);
        const mg = prods.length && prods[0].precio ? (prods[0].precio - costoProducto(prods[0]).costo)/prods[0].precio : null;
        return '<button class="item" data-act="editReceta" data-id="'+r.id+'"><div class="main"><span class="t">'+esc(r.nombre)+'</span><span class="s">Rinde '+(r.rinde||1)+' '+esc(r.unidadRinde||'u')+' · '+(prods.length? prods.length+' producto'+(prods.length>1?'s':'')+' vinculado'+(prods.length>1?'s':'') : 'sin producto vinculado')+'</span>'+(c.faltan?'<span><span class="pill p-warn">Falta precio de '+c.faltan+' insumo'+(c.faltan>1?'s':'')+'</span></span>':'')+'</div><div class="end"><span class="num" style="font-weight:700">'+$(c.unit)+'</span><span class="muted" style="font-size:12px">por '+esc(singular(r.unidadRinde))+'</span>'+(mg!=null?'<span class="pill '+(mg<.5?'p-warn':'p-ok')+'">margen '+pct(mg)+'</span>':'')+'</div></button>'; }).join('')+'</div>'
      : '<div class="card empty"><p>Cargá tu primera receta para conocer el costo real de cada producto.</p></div>');
  } else if(t==='insumos'){
    const cats = [...new Set(Object.values(S.insumos).map(i=>i.cat||'Varios'))].sort();
    const q = norm(U.qIns);
    let arr = Object.values(S.insumos).filter(i=>(!U.fInsCat||(i.cat||'Varios')===U.fInsCat) && (!q||norm(i.nombre).includes(q))).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
    const sinPrecio = Object.values(S.insumos).filter(i=>!insumoCU(i)).length;
    body = `<div class="row"><div class="search" style="flex:1;min-width:180px">${svg('search')}<input class="f" id="qins" placeholder="Buscar insumo" value="${esc(U.qIns)}" data-bind="qIns"></div><button class="btn pri sm" data-act="nuevoInsumo">${svg('plus')}Insumo</button></div>
      <div class="chips"><button class="chip" data-act="fInsCat" data-v="" aria-pressed="${!U.fInsCat}">Todos (${Object.keys(S.insumos).length})</button>${cats.map(c=>'<button class="chip" data-act="fInsCat" data-v="'+esc(c)+'" aria-pressed="'+(U.fInsCat===c)+'">'+esc(c)+'</button>').join('')}</div>
      ${sinPrecio?'<div class="note">'+sinPrecio+' insumo'+(sinPrecio>1?'s':'')+' sin precio. Las recetas que los usan quedan incompletas.</div>':''}
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Insumo</th><th class="r">Precio</th><th class="r">Costo unitario</th><th>Actualizado</th></tr></thead><tbody>
      ${arr.slice(0,400).map(i=>{ const cu=insumoCU(i); const va = i.precioAnterior>0 && i.precio>0 ? (i.precio-i.precioAnterior)/i.precioAnterior : null;
        return '<tr data-act="editInsumo" data-id="'+i.id+'" style="cursor:pointer"><td><b style="font-weight:650">'+esc(i.nombre)+'</b><br><span class="muted" style="font-size:12px">'+esc(i.cat||'')+'</span></td><td class="r num">'+(i.precio?$(i.precio)+'<br><span class="muted" style="font-size:12px">x '+fmtCant(i.presentacion,i.unidad)+'</span>':'<span class="pill p-warn">Sin precio</span>')+'</td><td class="r num">'+(cu!=null?'$ '+cu.toLocaleString('es-AR',{maximumFractionDigits:2})+' /'+unidadLabel(i.unidad):'—')+'</td><td class="num" style="font-size:12.5px">'+(i.precioFecha?fdate(i.precioFecha):'<span class="muted">'+esc((i.nota||'').slice(0,22))+'</span>')+(va!=null?'<br><span class="pill '+(va>0?'p-bad':'p-ok')+'">'+(va>0?'+':'')+pct(va)+'</span>':'')+'</td></tr>'; }).join('')}
      </tbody></table></div>`;
  } else {
    const arr = catalogo().filter(p=>p.recetaId && S.recetas[p.recetaId]).map(p=>{ const c=costoProducto(p).costo; return {p,c,mg:p.precio?(p.precio-c)/p.precio:null}; }).sort((a,b)=>(a.mg??9)-(b.mg??9));
    const mult = num(neg().multiplicador)||3;
    body = `<p class="muted" style="margin:0">Productos con receta: precio actual contra costo real. El precio sugerido es costo × ${mult} (lo cambiás en <a href="#ajustes">Ajustes</a>).</p>`+
      (arr.length? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Precio</th><th class="r">Costo</th><th class="r">Margen</th><th class="r">Sugerido</th></tr></thead><tbody>'+arr.map(x=>'<tr data-act="editProd" data-id="'+x.p.id+'" style="cursor:pointer"><td>'+esc(x.p.nombre)+'</td><td class="r num">'+$(x.p.precio)+'</td><td class="r num">'+$(x.c)+'</td><td class="r"><span class="pill '+(x.mg==null?'p-neu':x.mg<.5?'p-warn':'p-ok')+'">'+pct(x.mg)+'</span></td><td class="r num">'+$(Math.ceil(x.c*mult/100)*100)+'</td></tr>').join('')+'</tbody></table></div>'
      : '<div class="card empty"><p>Vinculá una receta a un producto del catálogo para ver su margen real.</p></div>');
  }
  return `<div class="stack"><h1>Costos</h1><div class="subtabs">${st('recetas','Recetas')}${st('insumos','Insumos')}${st('margenes','Márgenes')}</div>${body}</div>`;
};
const singular = u => { u = u||'unidad'; return u.endsWith('es')&&!u.endsWith('ones')?u.slice(0,-2):u.endsWith('s')?u.slice(0,-1):u; };
function fmtCant(v,u){ v=num(v); if(u==='g'&&Math.abs(v)>=1000) return (v/1000).toLocaleString('es-AR',{maximumFractionDigits:2})+' kg'; if(u==='ml'&&Math.abs(v)>=1000) return (v/1000).toLocaleString('es-AR',{maximumFractionDigits:2})+' lt'; return v.toLocaleString('es-AR',{maximumFractionDigits:2})+' '+unidadLabel(u); }
/* ===== MÁS ===== */
R.mas = function(){
  const it = (h,ic,t,s) => '<a class="item" href="#'+h+'" style="text-decoration:none;color:inherit"><span class="ic">'+svg(ic)+'</span><div class="main"><span class="t">'+t+'</span><span class="s">'+s+'</span></div>'+svg('chev','muted').replace('<svg','<svg style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2"')+'</a>';
  const m = metricas(U.mes);
  if(SECTOR==='local') return `<div class="stack"><h1>Más</h1><div class="list morelist">
    <button class="item" data-act="verCuentas"><span class="ic">${svg('cash')}</span><div class="main"><span class="t">Cuentas corrientes</span><span class="s">Quién debe y cobrar en el momento</span></div></button>
    ${it('clientes','users','Clientes',Object.keys(S.clientes).length+' clientes · historial y lo que deben')}
    ${it('estadisticas','chart','Pedidos por canal','Qué porcentaje entra por local, WhatsApp y cuenta corriente')}
    ${it('catalogo','tag','Lista de precios',catalogo().length+' productos')}
    <button class="item" data-act="nuevoMov"><span class="ic">${svg('receipt')}</span><div class="main"><span class="t">Cargar factura o remito de proveedor</span><span class="s">Se guarda para administración. Después no se ve desde el local.</span></div></button>
  </div></div>`;
  return `<div class="stack"><h1>Más</h1><div class="list morelist">
    ${it('costos','whisk','Costos y recetas',Object.keys(S.recetas).length+' recetas · '+Object.keys(S.insumos).length+' insumos · márgenes')}
    ${it('empleados','users','Empleados','Horas, sueldos, nómina y novedades · '+esc(mesLabel(U.mes))+': '+$(m.sueldos))}
    ${it('proveedores','box','Proveedores','Facturas, remitos, pagos y cuenta corriente · deuda '+$(deudaTotal()))}
    ${it('gastos','receipt','Gastos','Fijos y variables · '+esc(mesLabel(U.mes))+': '+$(m.fijos+m.variables))}
    ${it('estadisticas','chart','Estadísticas de ventas','Mes a mes por canal: local, WhatsApp, cuenta corriente, mayoristas')}
    ${it('clientes','users','Clientes',Object.keys(S.clientes).length+' clientes · historial y cuenta corriente')}
    ${it('catalogo','tag','Catálogo y precios',catalogo().length+' productos · ajuste de precios por categoría')}
    ${it('stockpt','box','Stock de producto terminado',Object.keys(S.stockpt).length+' productos · cocina y local')}
    ${it('stock','box','Stock de mercadería','Materia prima, mínimos y faltantes')}
    ${it('ajustes','gear','Ajustes','Datos del local, hora de trabajo, márgenes')}
    ${it('equipo','users','Equipo y usuarios','Invitar personas y elegir qué sector ve cada una')}
    ${it('historial','doc','Historial de cambios','Quién cargó, cambió o borró cada cosa · recuperar lo borrado')}
    <button class="item" data-act="importarSheet"><span class="ic">${svg('plus')}</span><div class="main"><span class="t">Importar desde planillas</span><span class="s">Pasá el historial de pedidos, proveedores, gastos y empleados (archivo .xlsx)</span></div></button>
    <button class="item" data-act="exportar"><span class="ic">${svg('doc')}</span><div class="main"><span class="t">Descargar copia en Excel</span><span class="s">Todos los datos, una hoja por sección. Guardala en Drive.</span></div></button>
  </div></div>`;
};
R.equipo = function(){
  if(!EQUIPO) { cargarEquipo(); return '<div class="stack"><div class="row between"><a href="#mas" class="muted">‹ Más</a></div><h1>Equipo y usuarios</h1><p class="muted">Cargando…</p></div>'; }
  const opts = r => ['pendiente','todo','local','cocina'].map(k=>'<option value="'+k+'"'+(k===r?' selected':'')+'>'+(k==='pendiente'?'Sin acceso':SECTORES[k])+'</option>').join('');
  const optsInv = ['local','cocina','todo'].map(k=>'<option value="'+k+'">'+SECTORES[k]+'</option>').join('');
  return `<div class="stack equipo">
    <div class="row between"><a href="#mas" class="muted">‹ Más</a></div>
    <h1>Equipo y usuarios</h1>
    <div class="card stack">
      <h2 style="margin:0">Invitar a una persona</h2>
      <p class="muted" style="margin:0;font-size:13.5px">Solo pueden crear usuario los mails invitados acá. Después la persona entra al link de la app, toca "crear usuario" con ese mismo mail y ya queda con su sector.</p>
      <label class="lb">Nombre<input class="f" id="inv-nombre" maxlength="60" autocomplete="off"></label>
      <label class="lb">Mail<input class="f" id="inv-email" type="email" inputmode="email" maxlength="120" autocomplete="off"></label>
      <label class="lb">Sector<select class="f" id="inv-rol">${optsInv}</select></label>
      <button class="btn pri" data-act="invitar">Invitar</button>
    </div>
    ${INVITES.length?'<h2>Invitaciones sin usar</h2><div class="list">'+INVITES.map(i=>'<div class="item"><div class="main"><span class="t">'+esc(i.nombre||i.email)+'</span><span class="s">'+esc(i.email)+' · '+esc(SECTORES[i.rol]||i.rol)+'</span></div><div class="end"><button class="btn sm ghost" data-act="quitarInv" data-id="'+esc(i.email)+'">Quitar</button></div></div>').join('')+'</div>':''}
    <h2>Personas con usuario</h2>
    <div class="list">${EQUIPO.map(p=>'<div class="item"><div class="main"><span class="t">'+esc(p.nombre||'Sin nombre')+'</span><span class="s">'+esc(p.email||'')+(p.id===USER_ID?' · Vos':'')+'</span></div><div class="end"><select class="f rolsel" data-chg="setRol" data-id="'+esc(p.id)+'"'+(p.id===USER_ID?' disabled':'')+'>'+opts(p.rol)+'</select></div></div>').join('')}</div>
    <div class="note">Para sacarle el acceso a alguien (por ejemplo si deja de trabajar o pierde el celular), poné "Sin acceso". Deja de ver todo al instante. Nadie puede cambiar su propio sector, y siempre queda al menos una persona con acceso a todo.</div>
    <div class="note">Dueñas y administración ven todo. Local: pedidos, presupuestos, clientes, lista de precios, stock terminado y producción, sin costos. Cocina: producción, pedidos sin precios y stock.</div>
  </div>`;
};
const TABLA_LBL = {pedidos:'Pedido',presupuestos:'Presupuesto',gastos:'Gasto',clientes:'Cliente',recetas:'Receta',insumos:'Insumo',stockpt:'Stock terminado',produccion:'Producción',proveedores:'Proveedor',movprov:'Comprobante de proveedor',empleados:'Empleado',horas:'Horas',novedades:'Novedad',config:'Ajustes',perfiles:'Usuario',invitaciones:'Invitación'};
const ACC_LBL = {alta:'Alta',insert:'Alta',cambio:'Cambio',update:'Cambio',borrado:'Borrado',delete:'Borrado'};
function descHist(h){
  const r = h.despues || h.antes || {}; const d = r.data || r;
  const t = d.clienteNombre || d.nombre || d.proveedor || d.empleado || d.desc || d.descripcion || d.cat || d.email || h.fila;
  const extra = d.entrega ? ' · '+fdate(d.entrega) : d.fecha ? ' · '+fdate(d.fecha) : '';
  return String(t)+extra;
}
R.historial = function(){
  if(!HIST){ cargarHistorial(); return '<div class="stack"><div class="row between"><a href="#mas" class="muted">‹ Más</a></div><h1>Historial de cambios</h1><p class="muted">Cargando…</p></div>'; }
  const quien = id => { const p=(EQUIPO||[]).find(x=>x.id===id); return p ? (p.nombre||p.email) : (id?'Otra persona':'Sistema'); };
  const hora = iso => { const d=new Date(iso); return pad(d.getDate())+'/'+pad(d.getMonth()+1)+' '+pad(d.getHours())+':'+pad(d.getMinutes()); };
  const restaurable = h => (h.accion==='borrado'||h.accion==='cambio') && h.antes && h.antes.id && TABLA_LBL[h.tabla] && !['perfiles','invitaciones'].includes(h.tabla);
  return `<div class="stack">
    <div class="row between"><a href="#mas" class="muted">‹ Más</a></div>
    <h1>Historial de cambios</h1>
    <p class="muted" style="margin:0">Cada alta, cambio o borrado queda guardado con quién lo hizo. Nadie lo puede borrar. Si algo se borró o se cambió por error, tocá "Recuperar" y vuelve a como estaba.</p>
    <div class="chips"><button class="chip" data-act="fHist" data-id="todo" aria-pressed="${HIST_F==='todo'}">Todo</button><button class="chip" data-act="fHist" data-id="borrado" aria-pressed="${HIST_F==='borrado'}">Solo borrados</button></div>
    ${HIST.length?'<div class="list">'+HIST.map(h=>'<div class="item"><div class="main"><span class="t">'+esc(ACC_LBL[h.accion]||h.accion)+' · '+esc(TABLA_LBL[h.tabla]||h.tabla)+': '+esc(descHist(h))+'</span><span class="s">'+esc(hora(h.cuando))+' · '+esc(quien(h.usuario))+'</span></div>'+(restaurable(h)?'<div class="end"><button class="btn sm ghost" data-act="restaurar" data-id="'+esc(String(h.n))+'">Recuperar</button></div>':'')+'</div>').join('')+'</div>':'<p class="muted">Todavía no hay cambios.</p>'}
    <p class="muted" style="font-size:13px">Se muestran los últimos 300 movimientos.</p>
  </div>`;
};
R.gastos = function(){
  const gs = Object.values(S.gastos).filter(g=>(g.fecha||'').startsWith(U.mes)).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const fijos = sum(gs.filter(g=>g.tipo==='fijo'),g=>num(g.monto)), vars = sum(gs.filter(g=>g.tipo!=='fijo'),g=>num(g.monto));
  const prevFijos = Object.values(S.gastos).filter(g=>(g.fecha||'').startsWith(mesShift(U.mes,-1)) && g.tipo==='fijo');
  const porCat = {}; gs.forEach(g=>{ porCat[g.cat||'Otros']=(porCat[g.cat||'Otros']||0)+num(g.monto); });
  const tot = fijos+vars;
  return `<div class="stack">
    <div class="row between"><a href="#mas" class="muted">‹ Más</a><button class="btn pri sm" data-act="nuevoGasto">${svg('plus')}Gasto</button></div>
    <div class="monthbar"><button class="btn" data-act="mes" data-n="-1" aria-label="Mes anterior">‹</button><div style="text-align:center"><div class="eyebrow">Gastos</div><h1>${esc(mesLabel(U.mes))}</h1></div><button class="btn" data-act="mes" data-n="1" aria-label="Mes siguiente">›</button></div>
    <div class="tiles" style="grid-template-columns:repeat(3,1fr)"><div class="tile"><span class="k">Fijos</span><span class="v num">${$(fijos)}</span></div><div class="tile"><span class="k">Variables</span><span class="v num">${$(vars)}</span></div><div class="tile"><span class="k">Total</span><span class="v num">${$(tot)}</span></div></div>
    ${!gs.some(g=>g.tipo==='fijo') && prevFijos.length ? '<div class="card row between"><span>¿Repetís los '+prevFijos.length+' gastos fijos de '+esc(mesLabel(mesShift(U.mes,-1)))+' ('+$(sum(prevFijos,g=>num(g.monto)))+')?</span><button class="btn sm" data-act="copiarFijos">Copiar a este mes</button></div>' : ''}
    ${Object.keys(porCat).length? '<div class="card stack" style="gap:8px">'+Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([c,v])=>'<div><div class="row between" style="font-size:13.5px"><span>'+esc(c)+'</span><span class="num">'+$(v)+'</span></div><div class="bar"><i style="width:'+(tot?v/tot*100:0)+'%;background:var(--accent)"></i></div></div>').join('')+'</div>' : ''}
    ${gs.length? '<div class="list">'+gs.map(g=>'<button class="item" data-act="editGasto" data-id="'+g.id+'"><div class="main"><span class="t">'+esc(g.concepto||g.cat)+'</span><span class="s">'+fdate(g.fecha)+' · '+esc(g.cat||'')+'</span></div><div class="end"><span class="num" style="font-weight:700">'+$(g.monto)+'</span><span class="pill '+(g.tipo==='fijo'?'p-acc':'p-neu')+'">'+(g.tipo==='fijo'?'Fijo':'Variable')+'</span></div></button>').join('')+'</div>'
      : '<div class="card empty"><p>Cargá alquiler, sueldos, cargas sociales, servicios y compras para que la ganancia del mes sea real.</p><button class="btn pri" data-act="nuevoGasto">Cargar gasto</button></div>'}
  </div>`;
};
R.clientes = function(){
  const q = norm(U.q); const ft = U.fCli||'';
  const arr = Object.values(S.clientes).filter(c=>(!q||norm(c.nombre+' '+(c.telefono||'')).includes(q)) && (!ft || (ft==='debe' ? false : (c.tipo||'Particular')===ft) || ft==='debe'))
    .map(c=>{ const ps=pedidosArr().filter(p=>p.clienteId===c.id && p.estado!=='cancelado'); return {c, n:ps.length, total:sum(ps,p=>totPedido(p).total), debe:sum(ps,p=>Math.max(0,totPedido(p).saldo))}; })
    .filter(x=>ft!=='debe' || x.debe>0.5)
    .sort((a,b)=>b.debe-a.debe || (a.c.nombre||'').localeCompare(b.c.nombre||''));
  const chip = (v,l) => '<button class="chip" data-act="fCli" data-v="'+v+'" aria-pressed="'+(ft===v)+'">'+l+'</button>';
  const deudaCC = sum(arr.filter(x=>x.c.tipo==='Cuenta corriente'), x=>x.debe);
  return `<div class="stack">
    <div class="row between"><a href="#mas" class="muted">‹ Más</a><button class="btn pri sm" data-act="nuevoCliente">${svg('plus')}Cliente</button></div>
    <h1>Clientes</h1>
    <div class="search">${svg('search')}<input class="f" id="qcli" placeholder="Buscar por nombre o teléfono" value="${esc(U.q)}" data-bind="q"></div>
    <div class="chips">${chip('','Todos')}${chip('Cuenta corriente','Cuenta corriente')}${chip('debe','Deben plata')}${chip('Particular','Particulares')}${chip('Mayorista','Mayoristas')}</div>
    ${ft==='Cuenta corriente'?'<div class="note">Cuentas corrientes: deben en total <b>'+$(deudaCC)+'</b>. Tocá una persona para cobrarle en el momento.</div>':''}
    <p class="muted" style="margin:0;font-size:13px">${arr.length.toLocaleString('es-AR')} cliente${arr.length!==1?'s':''}</p>
    ${arr.length? '<div class="list">'+arr.slice(0, U.cliLim||200).map(x=>'<button class="item" data-act="verCliente" data-id="'+x.c.id+'"><div class="main"><span class="t">'+esc(x.c.nombre)+'</span><span class="s">'+esc(x.c.tipo||'Particular')+(x.c.telefono?' · '+esc(x.c.telefono):'')+' · '+x.n+' pedido'+(x.n!==1?'s':'')+'</span></div><div class="end">'+(x.debe>0.5?'<span class="pill p-warn">Debe '+$(x.debe)+'</span>':(x.c.tipo==='Cuenta corriente'?'<span class="pill p-ok">Al día</span>':''))+'</div></button>').join('')+'</div>'+(arr.length>(U.cliLim||200)?'<button class="btn" data-act="masCli">Ver más</button>':'')
      : '<div class="card empty"><p>No hay clientes acá. Se crean solos cuando cargás un pedido con un teléfono o nombre nuevo.</p></div>'}
  </div>`;
};
/* Doughy no trae tildes ni ñ: en los títulos se muestran sin tilde (Más → Mas), todo en Doughy */
const CON_TILDE = /[À-ſ]/;
function arreglarDoughy(root){
  (root||document).querySelectorAll('h1, h2, .hero .big').forEach(el=>{
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let nd;
    while((nd=tw.nextNode())){ if(CON_TILDE.test(nd.nodeValue)) nd.nodeValue = nd.nodeValue.normalize('NFD').replace(/[̀-ͯ]/g,''); }
  });
}
let _ndPend=false;
new MutationObserver(()=>{ if(_ndPend) return; _ndPend=true; requestAnimationFrame(()=>{ _ndPend=false; arreglarDoughy(document); }); }).observe(document.documentElement, {childList:true, subtree:true, characterData:true});
/* ===== ESTADÍSTICAS ===== */
function canalStat(p){ if(p.canal==='Mayorista') return 'Mayoristas'; if(p.canal==='Fecha especial') return 'Fecha especial'; if(p.origen==='bistrosoft') return 'Mostrador (Bistrosoft)';
  if(p.canal==='Local') return 'Local'; if(p.canal==='WhatsApp') return 'WhatsApp'; if(p.canal==='Cuenta corriente') return 'Cuenta corriente'; return 'Pedidos de planilla (sin canal)'; }
const CANAL_ORDEN = ['Local','WhatsApp','Cuenta corriente','Mayoristas','Fecha especial','Mostrador (Bistrosoft)','Pedidos de planilla (sin canal)'];
function statsLocal(){
  const mes = U.mes; const meses = []; for(let i=5;i>=0;i--){ const d=new Date(mes+'-15T12:00:00'); d.setMonth(d.getMonth()-i); meses.push(d.toISOString().slice(0,7)); }
  const K = ['Local','WhatsApp','Cuenta corriente']; const agg = {};
  pedidosArr().forEach(p=>{ const m=(p.entrega||'').slice(0,7); if(!meses.includes(m) || p.estado==='cancelado' || esVentaDia(p)) return; const k=canalStat(p); if(!K.includes(k)) return; const a=agg[m]||(agg[m]={}); a[k]=(a[k]||0)+1; });
  const tot = m => { const a=agg[m]||{}; return K.reduce((n,k)=>n+(a[k]||0),0); };
  const pc = (m,k) => tot(m)? Math.round((agg[m][k]||0)/tot(m)*100)+'%' : '—';
  const t = tot(mes);
  return `<div class="stack">
    <a href="#mas" class="muted">‹ Más</a>
    <div class="monthbar"><button class="btn" data-act="mes" data-n="-1" aria-label="Mes anterior">‹</button><div style="text-align:center"><div class="eyebrow">Pedidos por canal</div><h1>${esc(mesLabel(mes))}</h1></div><button class="btn" data-act="mes" data-n="1" aria-label="Mes siguiente">›</button></div>
    <div class="card"><table class="stat-t"><thead><tr><th>Canal</th><th>%</th><th style="width:50%"></th></tr></thead><tbody>
      ${t? K.map(k=>'<tr><td>'+k+'</td><td class="num"><b>'+pc(mes,k)+'</b></td><td><div class="sbar"><i style="width:'+((agg[mes][k]||0)/t*100)+'%"></i></div></td></tr>').join('') : '<tr><td colspan="3" class="muted">Todavía no hay pedidos minoristas este mes.</td></tr>'}
    </tbody></table></div>
    <h3>Últimos 6 meses</h3>
    <div class="card tbl-wrap"><table class="stat-t"><thead><tr><th>Canal</th>${meses.map(m=>'<th>'+esc(mesLabel(m).replace(/ de /,' ').slice(0,3)+' '+m.slice(2,4))+'</th>').join('')}</tr></thead><tbody>
      ${K.map(k=>'<tr><td>'+k+'</td>'+meses.map(m=>'<td class="num">'+pc(m,k)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>
    <div class="note">Porcentaje de pedidos minoristas que entraron por el local, por WhatsApp y por cuenta corriente, según la fecha de entrega.</div>
  </div>`;
}
R.estadisticas = function(){
  if(!verPlata()) return statsLocal();
  const mes = U.mes; const meses = []; for(let i=5;i>=0;i--){ const d=new Date(mes+'-15T12:00:00'); d.setMonth(d.getMonth()-i); meses.push(d.toISOString().slice(0,7)); }
  const agg = {}; pedidosArr().forEach(p=>{ const m=(p.entrega||'').slice(0,7); if(!meses.includes(m) || p.estado==='cancelado') return; const k=canalStat(p); const a=agg[k]||(agg[k]={}); const x=a[m]||(a[m]={n:0,t:0}); x.n++; x.t+=totPedido(p).total; });
  const filas = CANAL_ORDEN.filter(k=>agg[k]);
  const totMes = m => sum(filas, k=>(agg[k][m]||{t:0}).t);
  const tm = totMes(mes);
  const cur = filas.map(k=>({k, n:(agg[k][mes]||{n:0}).n, t:(agg[k][mes]||{t:0}).t})).sort((a,b)=>b.t-a.t);
  return `<div class="stack">
    <a href="#mas" class="muted">‹ Más</a>
    <div class="monthbar"><button class="btn" data-act="mes" data-n="-1" aria-label="Mes anterior">‹</button><div style="text-align:center"><div class="eyebrow">Ventas por canal</div><h1>${esc(mesLabel(mes))}</h1></div><button class="btn" data-act="mes" data-n="1" aria-label="Mes siguiente">›</button></div>
    <div class="card"><table class="stat-t"><thead><tr><th>Canal</th><th>Pedidos</th><th>Vendido</th><th>%</th><th style="width:28%"></th></tr></thead><tbody>
      ${cur.length? cur.map(x=>'<tr><td>'+esc(x.k)+'</td><td class="num">'+x.n.toLocaleString('es-AR')+'</td><td class="num">'+$(x.t)+'</td><td class="num">'+(tm?pct(x.t/tm):'')+'</td><td><div class="sbar"><i style="width:'+(tm?x.t/tm*100:0)+'%"></i></div></td></tr>').join('')+'<tr><td><b>Total</b></td><td class="num"><b>'+sum(cur,x=>x.n).toLocaleString('es-AR')+'</b></td><td class="num"><b>'+$(tm)+'</b></td><td></td><td></td></tr>' : '<tr><td colspan="5" class="muted">Sin ventas este mes.</td></tr>'}
    </tbody></table></div>
    <h3>Últimos 6 meses</h3>
    <div class="card tbl-wrap"><table class="stat-t"><thead><tr><th>Canal</th>${meses.map(m=>'<th>'+esc(mesLabel(m).replace(/ de /,' ').slice(0,3)+' '+m.slice(2,4))+'</th>').join('')}</tr></thead><tbody>
      ${filas.map(k=>'<tr><td>'+esc(k)+'</td>'+meses.map(m=>'<td class="num">'+((agg[k][m]||{}).t?$((agg[k][m]).t):'—')+'</td>').join('')+'</tr>').join('')}
      <tr><td><b>Total</b></td>${meses.map(m=>'<td class="num"><b>'+$(totMes(m))+'</b></td>').join('')}</tr></tbody></table></div>
    <div class="note">Se cuentan los pedidos por su fecha de entrega, sin envíos ni IVA. "Pedidos de planilla" son los importados de antes, que no tenían canal.</div>
  </div>`;
};
R.catalogo = function(){
  const cats = [...new Set(catalogo().map(p=>p.cat||'Varios'))];
  const q = norm(U.qCat);
  const arr = catalogo().filter(p=>(!U.fCat||p.cat===U.fCat)&&(!q||norm(p.nombre).includes(q)));
  return `<div class="stack">
    <div class="row between"><a href="#mas" class="muted">‹ Más</a>${verPlata()?`<div class="row"><button class="btn sm" data-act="ajustePrecios">Ajustar precios %</button><button class="btn pri sm" data-act="nuevoProd">${svg('plus')}Producto</button></div>`:''}</div>
    <h1>Catálogo y precios</h1>
    <div class="search">${svg('search')}<input class="f" id="qcat" placeholder="Buscar producto" value="${esc(U.qCat)}" data-bind="qCat"></div>
    <select class="f" id="fcat" data-bind="fCat" aria-label="Categoría"><option value="">Todas las categorías (${catalogo().length})</option>${cats.map(c=>'<option'+(U.fCat===c?' selected':'')+'>'+esc(c)+'</option>').join('')}</select>
    ${arr.length? '<div class="list">'+arr.slice(0,300).map(p=>{ const c = verPlata() && p.recetaId&&S.recetas[p.recetaId] ? costoProducto(p) : null; const mg = c&&p.precio? (p.precio-c.costo)/p.precio : null;
      return '<button class="item" data-act="editProd" data-id="'+p.id+'"><div class="main"><span class="t">'+esc(p.nombre)+'</span><span class="s">'+esc(p.cat||'')+(c?' · costo '+$(c.costo):'')+'</span></div><div class="end">'+(p.precio?'<span class="num" style="font-weight:700">'+$(p.precio)+'</span>':'<span class="pill p-neu">A cotizar</span>')+(mg!=null?'<span class="pill '+(mg<.5?'p-warn':'p-ok')+'">'+pct(mg)+'</span>':'')+'</div></button>'; }).join('')+'</div>'+(arr.length>300?'<p class="muted">Mostrando 300 de '+arr.length+'. Buscá para filtrar.</p>':'')
      : '<div class="card empty"><p>No hay productos con ese filtro.</p></div>'}
  </div>`;
};
R.stock = function(){
  const arr = Object.values(S.insumos);
  const conStock = arr.filter(i=>i.stock!=null && i.stock!=='' || i.minimo>0);
  const q = norm(U.qIns);
  const list = (q? arr.filter(i=>norm(i.nombre).includes(q)) : conStock).sort((a,b)=>estadoStock(a)[2]-estadoStock(b)[2] || (a.nombre||'').localeCompare(b.nombre||''));
  return `<div class="stack">
    <div class="row between"><a href="#mas" class="muted">‹ Más</a></div>
    <h1>Stock de mercadería</h1>
    <p class="muted" style="margin:0">Anotá lo que entra y lo que sale. Cuando un insumo llega al mínimo aparece en Inicio.</p>
    <div class="search">${svg('search')}<input class="f" id="qstock" placeholder="Buscar insumo para cargar stock" value="${esc(U.qIns)}" data-bind="qIns"></div>
    ${list.length? '<div class="list">'+list.slice(0,200).map(i=>{ const e=estadoStock(i); return '<button class="item" data-act="stockMov" data-id="'+i.id+'"><div class="main"><span class="t">'+esc(i.nombre)+'</span><span class="s">'+esc(i.cat||'')+(i.minimo>0?' · avisar con '+fmtCant(i.minimo,i.unidad):'')+'</span></div><div class="end"><span class="num" style="font-weight:700">'+(i.stock!=null&&i.stock!==''?fmtCant(i.stock,i.unidad):'—')+'</span><span class="pill '+e[1]+'">'+e[0]+'</span></div></button>'; }).join('')+'</div>'
      : '<div class="card empty"><p>Buscá un insumo arriba y cargá cuánto tenés. Los que tengan stock o mínimo quedan en esta lista.</p></div>'}
  </div>`;
};
function estadoStock(i){ if(i.stock==null||i.stock==='') return ['Sin cargar','p-neu',3]; const s=num(i.stock); if(s<0) return ['Revisar','p-neu',0]; if(s<=0) return ['Sin stock','p-bad',0]; if(i.minimo>0 && s<=num(i.minimo)) return ['Poco stock','p-warn',1]; return ['OK','p-ok',2]; }
R.ajustes = function(){
  const n = neg();
  const f = (k,l,t,extra) => '<label class="lb">'+l+'<input class="f" id="aj-'+k+'" data-neg="'+k+'" type="'+(t||'text')+'" '+(t==='number'?'inputmode="decimal" step="any"':'')+' value="'+esc(n[k])+'" '+(extra||'')+'></label>';
  return `<div class="stack">
    <div class="row between"><a href="#mas" class="muted">‹ Más</a></div>
    <h1>Ajustes</h1>
    <div class="card stack"><h3>Datos del local</h3><p class="muted" style="margin:0;font-size:13px">Salen en el encabezado y al pie de cada presupuesto.</p>
      <div class="grid2">${f('nombre','Nombre')}${f('subtitulo','Bajada')}</div>
      <div class="grid2">${f('telefono','Teléfono')}${f('instagram','Instagram')}</div>${f('direccion','Dirección')}</div>
    <div class="card stack"><h3>Costos y precios</h3>
      <div class="grid2">${f('costoHora','Costo de la hora de trabajo ($)','number')}${f('multiplicador','Multiplicador para precio sugerido','number')}</div>
      ${f('costoDefault','Costo estimado para productos sin receta (% del precio)','number')}
      <p class="muted" style="margin:0;font-size:13px">La hora de trabajo se suma a cada receta según los minutos que lleva. Con multiplicador 3, un producto que cuesta $1.000 se sugiere a $3.000.</p></div>
    <div class="card stack"><h3>Presupuestos</h3>
      <div class="grid2">${f('validez','Validez (días)','number')}${f('proxPresupuesto','Próximo número','number')}</div>
      <label class="lb">Observaciones por defecto<textarea class="f" id="aj-obs" data-neg="obsPresupuesto">${esc(n.obsPresupuesto)}</textarea></label></div>
    <button class="btn pri" data-act="guardarAjustes" ${readOnly?'disabled':''}>Guardar ajustes</button>
    <p class="muted" style="font-size:12.5px">Los datos se guardan en línea y los ve todo el equipo que tenga acceso a esta app. ${mode==='local'?'Ahora estás en modo de prueba: lo que cargues queda solo en este dispositivo.':''}</p>
  </div>`;
};

/* ===== PRODUCCIÓN Y STOCK DE PRODUCTO TERMINADO ===== */
function progresoPill(p){ const its=p.items||[]; if(!its.length || p.estado==='entregado' || p.estado==='cancelado') return ''; const l=its.filter(x=>x.listo).length; if(!l) return ''; return '<span class="pill '+(l===its.length?'p-ok':'p-pis')+'">'+l+'/'+its.length+' listos</span>'; }
function estadoPT(i){ const s=num(i.stock); if(s<=0) return ['Sin stock','p-bad',0]; if(num(i.minimo)>0 && s<=num(i.minimo)) return ['Bajo mínimo','p-warn',1]; return ['OK','p-ok',2]; }
function faltantesPT(){ return Object.values(S.stockpt).filter(i=>num(i.minimo)>0 && num(i.stock)<=num(i.minimo)).map(i=>{ const meta = num(i.objetivo)>num(i.minimo) ? num(i.objetivo) : num(i.minimo)*2; return {stockId:i.id, nombre:i.nombre, cant: Math.max(1, Math.ceil(meta-num(i.stock))), listo:false}; }); }
const check = (on, act, attrs) => '<button class="ck'+(on?' on':'')+'" data-act="'+act+'" '+attrs+' aria-pressed="'+(!!on)+'" aria-label="'+(on?'Marcar como pendiente':'Marcar como listo')+'">'+(on?'✓':'')+'</button>';
R.produccion = function(){
  const peds = pedidosArr().filter(p=>['pendiente','produccion','listo'].includes(p.estado||'pendiente') && (p.entrega||'') <= addDays(today(),2)).sort(byEntrega);
  const ords = Object.values(S.produccion).filter(o=>!o.archivada).sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||'') || (a.creado||'').localeCompare(b.creado||''));
  const falt = faltantesPT().length;
  const pedCard = p => { const its=p.items||[]; const l=its.filter(x=>x.listo).length;
    return '<div class="card stack" style="gap:8px"><div class="row between" style="align-items:flex-start"><div><h3>'+esc(p.clienteNombre||'Sin nombre')+'</h3><span class="muted" style="font-size:12.5px">'+(p.entrega===today()?'Hoy':fdateShort(p.entrega))+(p.hora?' · '+esc(p.hora):'')+' · '+esc(p.canal||'Pedido')+'</span></div><span class="pill '+(l===its.length&&its.length?'p-ok':l?'p-pis':'p-neu')+'">'+l+'/'+its.length+'</span></div>'+
      '<div class="bar"><i style="width:'+(its.length?l/its.length*100:0)+'%"></i></div>'+
      '<div class="cklist">'+its.map((x,i)=>'<div class="ckrow'+(x.listo?' done':'')+'">'+check(x.listo,'tglPed','data-id="'+p.id+'" data-i="'+i+'"')+'<span class="ckn"><b class="num">'+esc(x.cant)+'</b> '+esc(x.nombre)+'</span></div>').join('')+'</div>'+
      (p.notas?'<div class="note">'+esc(p.notas)+'</div>':'')+'</div>'; };
  const ordCard = o => { const its=o.items||[]; const l=its.filter(x=>x.listo).length; const done = its.length && l===its.length;
    return '<div class="card stack" style="gap:8px"><div class="row between" style="align-items:flex-start"><div><h3>Producción '+(o.fecha===today()?'de hoy':fdateShort(o.fecha))+'</h3><span class="muted" style="font-size:12.5px">'+(o.origen==='stock'?'Faltantes del stock':'Orden manual')+(o.armadaPor?' · armó '+esc(o.armadaPor):'')+'</span></div><span class="pill '+(done?'p-ok':l?'p-pis':'p-neu')+'">'+l+'/'+its.length+'</span></div>'+
      '<div class="bar"><i style="width:'+(its.length?l/its.length*100:0)+'%"></i></div>'+
      '<div class="cklist">'+its.map((x,i)=>'<div class="ckrow'+(x.listo?' done':'')+'">'+check(x.listo,'tglProd','data-id="'+o.id+'" data-i="'+i+'"')+'<span class="ckn"><b class="num">'+esc(x.cant)+'</b> '+esc(x.nombre)+'</span></div>').join('')+'</div>'+
      (o.nota?'<div class="note">'+esc(o.nota)+'</div>':'')+
      '<div class="row" style="justify-content:flex-end">'+(SECTOR!=='cocina'?'<button class="btn sm ghost" data-act="editOrden" data-id="'+o.id+'">Editar</button>':'')+(done?'<button class="btn sm" data-act="archivarOrden" data-id="'+o.id+'">Archivar</button>':'')+'</div></div>'; };
  return `<div class="stack">
    <div class="row between"><h1>Producción</h1>${SECTOR!=='cocina'?`<div class="row"><button class="btn sm" data-act="ordenManual">${svg('plus')}Orden</button><button class="btn pri sm" data-act="armarProd">Armar con faltantes${falt?' ('+falt+')':''}</button></div>`:''}</div>
    <p class="muted" style="margin:0">${SECTOR==='cocina'?'Tildá cada cosa cuando esté lista. El local lo ve al instante.':'La cocina tilda lo que va terminando. Al tildar una producción para stock, se suma sola al stock de producto terminado.'}</p>
    <div class="sec" style="margin-top:6px"><div class="sec-h"><h2>Pedidos a preparar</h2><span class="muted" style="font-size:12.5px">hasta ${fdateShort(addDays(today(),2))}</span></div>
      ${peds.length? '<div class="stack">'+peds.map(pedCard).join('')+'</div>' : '<div class="card empty"><p>No hay pedidos para hoy ni los próximos dos días.</p></div>'}</div>
    <div class="sec"><div class="sec-h"><h2>Producción para stock</h2></div>
      ${ords.length? '<div class="stack">'+ords.map(ordCard).join('')+'</div>' : '<div class="card empty"><p>No hay órdenes de producción abiertas.'+(SECTOR!=='cocina'?' Cuando el local cuenta el stock, “Armar con faltantes” arma la orden sola.':'')+'</p></div>'}</div>
  </div>`;
};
R.stockpt = function(){
  const q = norm(U.qPT||''); const f = U.fPT||'';
  let arr = Object.values(S.stockpt).filter(i=>(!f || (f==='alerta'? estadoPT(i)[2]<2 && num(i.minimo)>0 : i.sector===f)) && (!q || norm(i.nombre+' '+i.grupo).includes(q)));
  const groups = {}; arr.forEach(i=>{ const k=(i.sector||'')+' · '+(i.grupo||'Otros'); (groups[k]=groups[k]||[]).push(i); });
  const falt = faltantesPT().length; const sinMin = Object.values(S.stockpt).filter(i=>!num(i.minimo)).length;
  const chip = (k,l) => '<button class="chip" data-act="fPT" data-v="'+k+'" aria-pressed="'+(f===k)+'">'+l+'</button>';
  return `<div class="stack">
    <div class="row between"><h1>Stock de producto terminado</h1><div class="row"><button class="btn sm" data-act="nuevoPT">${svg('plus')}Producto</button>${SECTOR!=='cocina'?`<button class="btn pri sm" data-act="armarProd">Armar producción${falt?' ('+falt+')':''}</button>`:''}</div></div>
    <p class="muted" style="margin:0">Usá − y + para ajustar lo que hay. Cada producto con mínimo que llega a ese número entra solo en la próxima orden de producción.</p>
    ${sinMin===Object.keys(S.stockpt).length && sinMin? '<div class="note">Todavía ningún producto tiene mínimo cargado. Tocá un producto y poné “mínimo” y “cantidad ideal” para que la producción se arme sola.</div>':''}
    <div class="search">${svg('search')}<input class="f" id="qpt" placeholder="Buscar producto" value="${esc(U.qPT||'')}" data-bind="qPT"></div>
    <div class="chips">${chip('','Todos')}${chip('alerta','Bajo mínimo')}${chip('Cocina','Cocina')}${chip('Local','Local')}</div>
    ${Object.keys(groups).length? Object.entries(groups).map(([g,its])=>'<div class="group-h">'+esc(g)+'</div><div class="list">'+its.map(i=>{ const e=estadoPT(i); return '<div class="item" style="cursor:default"><button class="main" data-act="editPT" data-id="'+i.id+'" style="border:0;background:none;text-align:left;padding:0;cursor:pointer"><span class="t">'+esc(i.nombre)+'</span><span class="s">'+(num(i.minimo)?'mín. '+num(i.minimo)+(num(i.objetivo)?' · ideal '+num(i.objetivo):''):'sin mínimo')+(i.nota?' · '+esc(i.nota):'')+'</span><span><span class="pill '+e[1]+'">'+e[0]+'</span></span></button><div class="stepper"><button data-act="ptAdj" data-id="'+i.id+'" data-d="-1" aria-label="Restar uno">−</button><b class="num">'+(Math.round(num(i.stock)*100)/100).toLocaleString('es-AR')+'</b><button data-act="ptAdj" data-id="'+i.id+'" data-d="1" aria-label="Sumar uno">+</button></div></div>'; }).join('')+'</div>').join('') : '<div class="card empty"><p>No hay productos con ese filtro.</p></div>'}
  </div>`;
};

/* ---------- hojas (formularios) ---------- */
let SH = null; // {type, draft, ...}
function openSheet(type, draft, extra){ SH = Object.assign({type, draft, confirmDel:false, q:''}, extra||{}); renderSheet(); }
function closeSheet(){ SH=null; document.getElementById('sheet').innerHTML=''; }
function renderSheet(){
  const host = document.getElementById('sheet'); if(!SH){ host.innerHTML=''; return; }
  const scrollEl = host.querySelector('.sheet-b'); const st = scrollEl? scrollEl.scrollTop : 0;
  const ae = document.activeElement; const keep = ae && ae.id && host.contains(ae) ? {id:ae.id, s:ae.selectionStart, e:ae.selectionEnd} : null;
  const r = SHEETS[SH.type]();
  host.innerHTML = '<div class="sheet-bg" data-act="bgclose"><div class="sheet'+(SH._visto?' still':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(r.title)+'"><div class="sheet-h"><h2>'+esc(r.title)+'</h2><button class="x" data-act="close" aria-label="Cerrar">×</button></div><div class="sheet-b">'+r.body+'</div>'+(r.foot?'<div class="sheet-f">'+r.foot+'</div>':'')+'</div></div>';
  SH._visto = true;
  const nb = host.querySelector('.sheet-b'); if(nb) nb.scrollTop = st;
  if(keep){ const el=document.getElementById(keep.id); if(el){ el.focus(); try{ el.setSelectionRange(keep.s,keep.e); }catch(e){} } }
}
const fld = (path,label,val,type,attrs) => '<label class="lb">'+label+'<input class="f" id="d-'+path.replace(/\./g,'-')+'" data-d="'+path+'" type="'+(type||'text')+'"'+(type==='number'?' inputmode="decimal" step="any"':'')+' value="'+esc(val==null?'':val)+'" '+(attrs||'')+'></label>';
const sel = (path,label,val,opts) => '<label class="lb">'+label+'<select class="f" id="d-'+path.replace(/\./g,'-')+'" data-d="'+path+'">'+opts.map(o=>{ const [v,l]=Array.isArray(o)?o:[o,o]; return '<option value="'+esc(v)+'"'+(String(val)===String(v)?' selected':'')+'>'+esc(l)+'</option>'; }).join('')+'</select></label>';
const delBlock = (what) => SH.confirmDel ? '<div class="confirm">¿Borrar '+what+'? No se puede deshacer.<span style="flex:1"></span><button class="btn sm" data-act="delNo">No</button><button class="btn sm pri" data-act="delSi" style="background:var(--bad);border-color:var(--bad)">Sí, borrar</button></div>' : '';

/* Buscador de productos de pedidos: por palabras sueltas, sin importar el orden ni los acentos. */
const CAT_ALIAS = {'Tatanes':'torta tatan','Tortas':'torta','Tortas especiales':'torta','Marquise':'torta','Tartas dulces':'tarta','Tartas saladas':'tarta','Porciones y muffins':'porcion','Budines enteros':'budin','Facturas, alfajores y boxes':'factura alfajor box'};
function buscarProductos(q, modo){
  const toks = norm(q).replace(/[^a-z0-9ñ ]/g,' ').split(/\s+/).filter(Boolean); if(!toks.length) return [];
  const base = modo==='may' ? catalogo().filter(p=>num(p.precioMay)>0) : catalogo().filter(p=>p.cat!=='Mayorista' && !/\(mc\)\s*$/i.test(p.nombre||''));
  const out = [];
  base.forEach(p => { const nom = norm(p.nombre).replace(/[^a-z0-9ñ ]/g,' '); const extra = norm((p.cat||'')+' '+(CAT_ALIAS[p.cat]||''));
    const pal = (nom+' '+extra).split(/\s+/).filter(Boolean);
    let hit=0, enNom=0; toks.forEach(t => { const ok = pal.some(w=>w.startsWith(t)) || (t.length>=4 && nom.includes(t)); if(ok){ hit++; if(nom.split(/\s+/).some(w=>w.startsWith(t))) enNom++; } });
    const frase = norm(q).replace(/[^a-z0-9ñ ]/g,' ').replace(/\s+/g,' ').trim();
    const pos = nom.replace(/\s+/g,' ').trim().indexOf(frase);
    if(hit) out.push({p, hit, enNom, pos: pos<0?999:pos, len:nom.length}); });
  const todos = out.filter(x=>x.hit===toks.length);
  const lista = (todos.length ? todos : out.filter(x=>x.hit>=Math.max(1,toks.length-1)));
  return lista.sort((a,b)=> b.hit-a.hit || b.enNom-a.enNom || a.pos-b.pos || a.len-b.len || (a.p.nombre||'').localeCompare(b.p.nombre||'')).slice(0,12).map(x=>x.p);
}
/* "5 pan dulce" o "5x pan dulce": el número del principio es la cantidad */
function partirCant(q){ const m = String(q||'').match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:x|×|u|un|unid\.?|unidades)?\s+(.+)$/i); return m ? {cant: num(m[1].replace(',','.')), q: m[2]} : {cant: 1, q: String(q||'')}; }
function prodResultsHTML(){
  const pc = partirCant(SH.q); const q = pc.q; if(norm(q).trim().length<2) return '';
  const may = SH.type==='pedMay'; const res = buscarProductos(q, may?'may':'min');
  const sel = Math.min(SH.sel||0, Math.max(0,res.length-1));
  return (res.length ? '<div class="results" role="listbox">'+res.map((p,i)=>'<button data-act="addItem" data-pid="'+p.id+'" role="option" class="'+(i===sel?'on':'')+'" aria-selected="'+(i===sel)+'"><span>'+(pc.cant!==1?'<b>'+pc.cant.toLocaleString('es-AR')+' × </b>':'')+esc(p.nombre)+'</span><span class="num muted">'+(may?$(p.precioMay):(p.precio?$(p.precio):'a cotizar'))+'</span></button>').join('')+'</div>' : '<div class="muted" style="font-size:13px">No encontré ese producto en la lista'+(may?' mayorista':'')+'.</div>')+
    '<button class="btn sm ghost" data-act="addFree">+ Agregar '+(pc.cant!==1?pc.cant.toLocaleString('es-AR')+' × ':'')+'“'+esc(q)+'” como ítem libre</button>';
}
function pintarResultados(){ const c=document.getElementById('itq-res'); if(c) c.innerHTML = prodResultsHTML(); }
function machete(d){
  if(SH.pegar) return '<div class="card stack" style="gap:8px"><b>Pegá el pedido como te llegó</b><textarea class="f" id="pegtxt" rows="7" placeholder="Pegá acá el mensaje del cliente">'+esc(d.mensaje||'')+'</textarea><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn sm ghost" data-act="pegarTexto">Cancelar</button><button class="btn sm pri" data-act="aplicarTexto">Dejar a la vista</button></div><span class="muted" style="font-size:12.5px">Queda arriba como ayuda para cargar cada producto con el nombre correcto de la lista. No se carga solo.</span></div>';
  if(d.mensaje) return '<div class="machete"><div class="row between"><b>Mensaje del cliente</b><div class="row" style="gap:6px"><button class="btn sm ghost" data-act="pegarTexto">Editar</button><button class="btn sm ghost" data-act="quitarMachete">Quitar</button></div></div><div class="mtxt">'+esc(d.mensaje)+'</div></div>';
  return '<button class="btn sm" data-act="pegarTexto">Pegar pedido de WhatsApp</button>';
}
function buscadorProductos(placeholder){
  return '<div class="search">'+svg('search')+'<input class="f" id="itq" data-sq="1" placeholder="'+placeholder+'" value="'+esc(SH.q||'')+'" autocomplete="off" autocorrect="off" spellcheck="false"></div><div id="itq-res" class="stack" style="gap:8px">'+prodResultsHTML()+'</div>';
}
function itemsEditor(items){
  return '<div class="stack" style="gap:8px"><h3>Productos</h3>'+
    buscadorProductos('Cantidad y producto, ej: 5 pan dulce · ↑ ↓ y Enter')+
    '<div class="lines">'+
    (items.length? items.map((l,i)=>'<div class="line"><div class="nm">'+esc(l.nombre)+(l.pid?'':'<small>ítem libre</small>')+'</div><input class="f num" id="it-c-'+i+'" data-it="'+i+'" data-k="cant" type="number" inputmode="decimal" step="any" value="'+esc(l.cant)+'" aria-label="Cantidad"><input class="f num" id="it-p-'+i+'" data-it="'+i+'" data-k="precio" type="number" inputmode="decimal" step="any" value="'+esc(l.precio)+'" aria-label="Precio unitario"><button class="rm" data-act="rmItem" data-i="'+i+'" aria-label="Quitar">×</button></div>').join('') : '<div class="muted" style="font-size:13px">Todavía no agregaste productos.</div>')+
    '</div>'+(items.length?'<div class="row muted" style="font-size:11.5px;justify-content:flex-end;gap:4px;padding-right:44px"><span style="width:64px;text-align:center">cant.</span><span style="width:96px;text-align:center">precio unit.</span></div>':'')+'</div>';
}
const telKey = t => { const x=String(t||'').replace(/\D/g,''); return x.length>=8 ? x.slice(-8) : ''; };
function clientePorTel(tel){ const k=telKey(tel); if(!k) return null; return Object.values(S.clientes).find(c=>telKey(c.telefono)===k) || null; }
const esCC = d => d.canal==='Cuenta corriente' || (d.canal==='Fecha especial' && !!d.cuentaCorriente);
function clienteFields(d){
  const cc = esCC(d);
  const opts = Object.values(S.clientes).filter(c=>!cc || c.tipo==='Cuenta corriente').map(c=>'<option value="'+esc(c.nombre)+'">').join('');
  const cEx = cc && Object.values(S.clientes).find(c=>norm(c.nombre)===norm(d.clienteNombre||''));
  const conocido = d.telefono && clientePorTel(d.telefono);
  return '<datalist id="dl-cli">'+opts+'</datalist><div class="grid2">'+fld('telefono','Teléfono',d.telefono,'tel','placeholder="Ej: 223 555 1234"')+fld('clienteNombre','Cliente',d.clienteNombre,'text','list="dl-cli" autocomplete="off"')+'</div>'+
    (conocido?'<div class="muted" style="font-size:12.5px;margin-top:-6px">Cliente ya cargado con ese teléfono.</div>':'')+
    (cc ? '<div class="note">Va a la cuenta corriente'+(cEx?' de <b>'+esc(cEx.nombre)+'</b>, que hoy debe <b>'+$(saldoCliente(cEx.id))+'</b>':'')+'. No hace falta cargar el pago: se cobra después desde Más → Clientes.</div>' : '')+
    (SH.type==='pedido' && d.canal==='Fecha especial' ? '<label class="ckline"><input type="checkbox" data-act="tglCC" '+(d.cuentaCorriente?'checked':'')+'> Cuenta corriente</label>' : '')+
    (SH.type==='pedido' ? '<label class="ckline"><input type="checkbox" data-act="tglRetira" '+(d.retiraOtro?'checked':'')+'> Retira otra persona</label>'+(d.retiraOtro?fld('retiraNombre','Nombre de quien retira',d.retiraNombre||'','text','autocomplete="off"'):'') : '');
}
function findOrCreateCliente(d){
  const nombre = (d.clienteNombre||'').trim(); if(!nombre) return null;
  const hacerCC = c => { if(esCC(d) && c.tipo!=='Cuenta corriente') save('clientes', Object.assign({}, c, {tipo:'Cuenta corriente'})); return c.id; };
  const porTel = clientePorTel(d.telefono); if(porTel) return hacerCC(porTel);
  let c = Object.values(S.clientes).find(x=>norm(x.nombre)===norm(nombre) && (!telKey(x.telefono) || !telKey(d.telefono)));
  if(c){ if(d.telefono && !c.telefono) c = Object.assign({}, c, {telefono:d.telefono}); if(esCC(d) && c.tipo!=='Cuenta corriente') c = Object.assign({}, c, {tipo:'Cuenta corriente'}); if(c!==S.clientes[c.id]) save('clientes', c); return c.id; }
  const id = uid(); save('clientes', {id, nombre, telefono:d.telefono||'', tipo: d.canal==='Mayorista'?'Mayorista':esCC(d)?'Cuenta corriente':d.canal==='Empresa'?'Empresa':'Particular', creado: today()});
  return id;
}
function waLink(tel, text){ let t = String(tel||'').replace(/\D/g,''); if(!t) return ''; if(!t.startsWith('54')){ t = t.replace(/^0/,''); t='549'+t; } return 'https://wa.me/'+t+'?text='+encodeURIComponent(text); }
function copy(text){
  const ok = () => toast('Copiado. Pegalo en WhatsApp.');
  try{ navigator.clipboard.writeText(text).then(ok, ()=>fallbackCopy(text)); }catch(e){ fallbackCopy(text); }
}
function fallbackCopy(text){ openSheet('texto', {text}); }

/* Bloque común de pedido minorista y presupuesto: WhatsApp, productos, descuento, envío, pagos, totales y notas */
function bloquePedido(d, o){
  const t = totPedido(d); const costo = sum(d.items||[], l=>lineaCosto(l).costo);
  const pays = (d.pagos||[]).map((x,i)=>'<div class="pay"><input class="f pf" id="pg-f-'+i+'" type="date" data-pg="'+i+'" data-k="f" value="'+esc(x.f)+'" aria-label="Fecha"><input class="f num" id="pg-m-'+i+'" type="number" inputmode="decimal" step="any" data-pg="'+i+'" data-k="monto" value="'+esc(x.monto)+'" aria-label="Monto"><select class="f" id="pg-x-'+i+'" data-pg="'+i+'" data-k="medio" aria-label="Medio">'+MEDIOS.map(m=>'<option'+(x.medio===m?' selected':'')+'>'+m+'</option>').join('')+'</select><button class="rm" data-act="rmPago" data-i="'+i+'" aria-label="Quitar pago" style="border:0;background:none;font-size:18px;color:var(--muted);cursor:pointer">×</button></div>').join('');
  return machete(d)+
    itemsEditor(d.items||[])+
    '<div class="stack" style="gap:6px"><span class="lb" style="margin:0">Descuento</span><div class="subtabs">'+[0,10,15,20].map(v=>'<button data-act="pedDesc" data-v="'+v+'" aria-pressed="'+(num(d.descPct)===v && !(v===0 && num(d.descuento)))+'">'+(v?v+'%':'Sin descuento')+'</button>').join('')+'</div></div>'+
    '<div class="grid2">'+(num(d.descPct)?'<div class="tile"><span class="k">Descuento '+num(d.descPct)+'%</span><span class="v num" style="font-size:18px">−'+$(t.desc)+'</span></div>':fld('descuento','Otro descuento ($)',d.descuento||'','number'))+fld('envio','Envío ($, va aparte)',d.envio||'','number')+'</div>'+
    '<div class="stack" style="gap:8px"><div class="row between"><h3>Pagos y señas</h3><div class="row"><button class="btn sm" data-act="addPago" data-tipo="sena">Seña 50%</button><button class="btn sm" data-act="addPago" data-tipo="saldo">Saldo completo</button><button class="btn sm ghost" data-act="addPago" data-tipo="otro">+ Pago</button></div></div><div class="pays">'+(pays||'<div class="muted" style="font-size:13px">Sin pagos registrados.</div>')+'</div></div>'+
    '<div class="totals num"><div class="r"><span>Productos</span><span>'+$(t.sub)+'</span></div>'+(t.desc?'<div class="r"><span>Descuento'+(num(d.descPct)?' '+num(d.descPct)+'%':'')+'</span><span>−'+$(t.desc)+'</span></div>':'')+(t.envio?'<div class="r"><span>Envío</span><span>'+$(t.envio)+'</span></div>':'')+'<div class="r big"><span>Total a cobrar</span><span>'+$(t.aCobrar)+'</span></div><div class="r"><span>Pagado</span><span>'+$(t.pagado)+'</span></div><div class="r" style="font-weight:700;color:'+(t.saldo>0.5?'var(--bad)':'var(--ok)')+'"><span>Saldo</span><span>'+$(t.saldo)+'</span></div>'+
    (verPlata()?'<div class="r muted" style="font-size:12.5px;border-top:1px dashed var(--line);padding-top:6px;margin-top:3px"><span>Costo estimado · ganancia del pedido</span><span>'+$(costo)+' · '+$(t.total-costo)+'</span></div>':'')+(o.extraTot||'')+'</div>'+
    '<label class="lb">'+o.notasLbl+'<textarea class="f" id="d-'+o.notas+'" data-d="'+o.notas+'">'+esc(d[o.notas]||'')+'</textarea></label>';
}
const SHEETS = {};
SHEETS.pedido = function(){
  const d = SH.draft; const n = neg();
  const body = clienteFields(d)+
    '<div class="grid3">'+sel('canal','Canal',d.canal,(CANALES_MIN.includes(d.canal)||d.canal==='Fecha especial'&&false)?CANALES_MIN:CANALES_MIN.concat(d.canal?[d.canal]:[]))+fld('entrega','Fecha de entrega',d.entrega,'date')+fld('hora','Hora',d.hora,'time')+'</div>'+
    sel('estado','Estado',d.estado,Object.entries(ESTADOS).map(([k,v])=>[k,v[0]]))+
    bloquePedido(d, {notas:'notas', notasLbl:'Notas (sabores, deco, dirección de entrega)'})+
    delBlock('este pedido');
  const wa = waLink(d.telefono, resumenPedido(d));
  const foot = (d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button><button class="btn sm" data-act="dupPedido">Duplicar</button>':'')+'<button class="btn sm" data-act="copyPedido">Copiar resumen</button>'+(wa?'<a class="btn sm" href="'+esc(wa)+'" target="_blank" rel="noopener">WhatsApp</a>':'')+'<span class="grow"></span><button class="btn pri" data-act="savePedido" '+(readOnly?'disabled':'')+'>Guardar</button>';
  return { title: d.id ? 'Pedido de '+(d.clienteNombre||'—') : (d.canal==='Fecha especial'?'Nuevo pedido fecha especial':'Nuevo pedido'), body, foot };
};
/* ===== PEDIDO MAYORISTA ===== */
function clientesMay(){
  const ids = new Set(pedidosArr().filter(p=>p.canal==='Mayorista').map(p=>p.clienteId).filter(Boolean));
  return Object.values(S.clientes).filter(c=>c.tipo==='Mayorista' || ids.has(c.id)).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
}
function proxRemito(){ const n = Math.max(0, ...pedidosArr().map(p=>parseInt(String(p.remito||'').replace(/\D/g,''),10)||0)); return n ? String(n+1) : ''; }
function listaMayorista(){ return catalogo().filter(p=>num(p.precioMay)>0); }
SHEETS.pedMay = function(){
  const d = SH.draft; const t = totPedido(d);
  const lista = listaMayorista();
  const cli = '<datalist id="dl-climay">'+clientesMay().map(c=>'<option value="'+esc(c.nombre)+'">').join('')+'</datalist>';
  const lineas = (d.items||[]).map((l,i)=>'<div class="line may"><input class="f num" id="it-c-'+i+'" data-it="'+i+'" data-k="cant" type="number" inputmode="decimal" step="any" value="'+esc(l.cant)+'" aria-label="Cantidad"><div class="nm">'+esc(l.nombre)+(l.pid?'':'<small>ítem libre</small>')+'</div><input class="f num" id="it-p-'+i+'" data-it="'+i+'" data-k="precio" type="number" inputmode="decimal" step="any" value="'+esc(l.precio)+'" aria-label="Valor unitario"><span class="num imp">'+$(num(l.cant)*num(l.precio))+'</span><button class="rm" data-act="rmItem" data-i="'+i+'" aria-label="Quitar">×</button></div>').join('');
  const body = cli+
    '<div class="grid2">'+fld('clienteNombre','Cliente',d.clienteNombre,'text','list="dl-climay" autocomplete="off" placeholder="Elegí o escribí el cliente"')+fld('remito','N° de remito',d.remito||'','text','inputmode="numeric" placeholder="Completalo cuando hagas el remito"')+'</div>'+
    '<div class="grid3">'+fld('entrega','Fecha de entrega',d.entrega,'date')+fld('factura','N° de factura (opcional)',d.factura||'','text','inputmode="numeric"')+sel('estado','Estado',d.estado,Object.entries(ESTADOS).map(([k,v])=>[k,v[0]]))+'</div>'+
    '<div class="stack" style="gap:6px"><span class="lb" style="margin:0">IVA</span><div class="subtabs"><button data-act="pedIva" data-v="0" aria-pressed="'+(!d.iva)+'">Sin IVA</button><button data-act="pedIva" data-v="1" aria-pressed="'+(!!d.iva)+'">Con IVA (+'+IVA_PCT+'%)</button></div></div>'+
    machete(d)+
    '<div class="stack" style="gap:8px"><h3>Productos</h3>'+
      buscadorProductos('Cantidad y producto, ej: 10 pan integral · ↑ ↓ y Enter')+
      (lineas ? '<div class="row muted may-h"><span>Cant.</span><span>Producto</span><span>Valor unit.</span><span>Importe</span><span></span></div><div class="lines">'+lineas+'</div>' : '<div class="muted" style="font-size:13px">Todavía no agregaste productos.</div>')+
      (!lista.length ? '<div class="note">Todavía no hay lista de precios mayorista. Se carga importando PEDIDOS MAYORISTAS (hoja "Lista de precios").</div>' : '')+
    '</div>'+
    fld('envio','Envío ($, lo ponés a mano según el cliente)',d.envio||'','number')+
    '<div class="totals num"><div class="r"><span>Subtotal productos</span><span>'+$(t.sub)+'</span></div>'+(num(d.descuento)?'<div class="r"><span>Descuento</span><span>−'+$(num(d.descuento))+'</span></div>':'')+
      (d.iva?'<div class="r"><span>IVA '+IVA_PCT+'%</span><span>'+$(t.iva)+'</span></div>':'')+'<div class="r"><span>Envío</span><span>'+$(t.envio)+'</span></div>'+
      '<div class="r big"><span>Total'+(d.iva?' con IVA':' sin IVA')+'</span><span>'+$(t.aCobrar)+'</span></div>'+(t.pagado?'<div class="r"><span>Pagado</span><span>'+$(t.pagado)+'</span></div><div class="r" style="font-weight:700;color:'+(t.saldo>0.5?'var(--bad)':'var(--ok)')+'"><span>Saldo</span><span>'+$(t.saldo)+'</span></div>':'')+'</div>'+
    '<label class="lb">Notas<textarea class="f" id="d-notas" data-d="notas">'+esc(d.notas||'')+'</textarea></label>'+
    delBlock('este pedido');
  const foot = (d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button><button class="btn sm" data-act="dupPedido">Duplicar</button>':'')+'<button class="btn sm" data-act="copyPedido">Copiar remito</button><span class="grow"></span><button class="btn pri" data-act="savePedido" '+(readOnly?'disabled':'')+'>Guardar</button>';
  return { title: d.id ? 'Mayorista · '+(d.clienteNombre||'—')+(d.remito?' · Rto '+d.remito:'') : 'Nuevo pedido mayorista', body, foot };
};
function resumenPedido(d){
  const t = totPedido(d); const n = neg();
  return [n.nombre+' · '+(d.canal==='Mayorista'?'Remito'+(d.remito?' N° '+d.remito:''):'Pedido'), d.clienteNombre?'Cliente: '+d.clienteNombre:'', d.retiraOtro&&d.retiraNombre?'Retira: '+d.retiraNombre:'', d.entrega?'Entrega: '+fdateShort(d.entrega)+(d.hora?' '+d.hora:''):'', '',
    ...(d.items||[]).map(l=>'• '+l.cant+' × '+l.nombre+' — '+$(num(l.cant)*num(l.precio))),
    t.desc?'Descuento'+(num(d.descPct)?' '+num(d.descPct)+'%':'')+': −'+$(t.desc):'', t.iva?'Subtotal: '+$(t.total):'', t.iva?'IVA '+IVA_PCT+'%: '+$(t.iva):'', t.envio?'Envío: '+$(t.envio):'', 'Total'+(d.canal==='Mayorista'?(d.iva?' con IVA':' sin IVA'):'')+': '+$(t.aCobrar), t.pagado?'Pagado: '+$(t.pagado):'', t.pagado&&t.saldo>0.5?'Saldo a abonar: '+$(t.saldo):'', d.notas?'\nNotas: '+d.notas:''].filter(x=>x!=='').join('\n').replace(/\n\n+/g,'\n\n');
}
SHEETS.presu = function(){
  const d = SH.draft;
  const bocados = d.invitados? sum((d.items||[]).filter(l=>{ const p=l.pid&&prodById(l.pid); return p && p.cat==='Eventos'; }), l=>num(l.cant))/num(d.invitados) : 0;
  const body = clienteFields(d)+
    '<div class="grid2">'+fld('evento','Evento / ocasión',d.evento)+fld('invitados','Invitados',d.invitados||'','number')+'</div>'+
    '<div class="grid3">'+fld('fechaEvento','Fecha del evento',d.fechaEvento,'date')+fld('emision','Emitido',d.emision,'date')+fld('validoHasta','Válido hasta',d.validoHasta,'date')+'</div>'+
    sel('estado','Estado',d.estado||'enviado',[['enviado','Enviado'],['aceptado','Aceptado'],['rechazado','Rechazado']])+
    bloquePedido(d, {notas:'obs', notasLbl:'Observaciones (salen en el presupuesto)', extraTot: d.invitados?'<div class="r muted" style="font-size:12.5px"><span>Por invitado</span><span>'+$(totPedido(d).total/num(d.invitados))+(bocados?' · '+(Math.round(bocados*10)/10).toLocaleString('es-AR')+' bocados de evento c/u':'')+'</span></div>':''})+
    (d.pedidoId?'<div class="note">Ya se pasó a pedido. <button class="btn sm" data-act="abrirPedido" data-id="'+esc(d.pedidoId)+'">Ver pedido</button></div>':'')+
    delBlock('este presupuesto');
  const foot = (d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<button class="btn sm" data-act="verDoc">Ver presupuesto</button>'+(d.pedidoId?'':'<button class="btn sm" data-act="presuAPedido">Pasar a pedido</button>')+'<span class="grow"></span><button class="btn pri" data-act="savePresu" '+(readOnly?'disabled':'')+'>Guardar</button>';
  return { title: 'Presupuesto N° '+pad(d.numero||0), body, foot };
};
function textoPresu(d){
  const n = neg(); const t = totPedido(d);
  return [n.nombre+' · Presupuesto N° '+pad(d.numero||0), d.clienteNombre?'Cliente: '+d.clienteNombre:'', d.evento?'Evento: '+d.evento+(d.invitados?' ('+d.invitados+' invitados)':''):'', d.fechaEvento?'Fecha del evento: '+fdate(d.fechaEvento):'', '',
    ...(d.items||[]).map(l=>'• '+l.cant+' × '+l.nombre+' ('+$(l.precio)+' c/u) — '+$(num(l.cant)*num(l.precio))),
    t.desc?'Descuento'+(num(d.descPct)?' '+num(d.descPct)+'%':'')+': −'+$(t.desc):'', t.envio?'Envío: '+$(t.envio):'', '', 'TOTAL: '+$(t.aCobrar), t.pagado?'Seña recibida: '+$(t.pagado):'', t.pagado&&t.saldo>0.5?'Saldo: '+$(t.saldo):'', d.validoHasta?'Válido hasta el '+fdate(d.validoHasta):'', d.obs||''].filter((x,i,a)=>!(x===''&&a[i-1]==='')).join('\n');
}
SHEETS.doc = function(){
  const d = SH.draft; const n = neg(); const t = totPedido(d);
  const body = '<div class="doc"><div class="dh"><div class="dn"><img src="logo-tatan.png" alt="'+esc(n.nombre||'Tatan')+'"></div><div class="dt"><b>Presupuesto</b>N° '+pad(d.numero||0)+'<br>Emitido '+fdate(d.emision)+'</div></div>'+
    '<div class="meta"><div><span>Cliente</span>'+esc(d.clienteNombre||'—')+'</div><div><span>Contacto</span>'+esc(d.telefono||'—')+'</div><div><span>Evento</span>'+esc(d.evento||'—')+'</div><div><span>Fecha del evento</span>'+fdate(d.fechaEvento)+'</div><div><span>Invitados</span>'+esc(d.invitados||'—')+'</div><div><span>Válido hasta</span>'+fdate(d.validoHasta)+'</div></div>'+
    '<table><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Unitario</th><th class="r">Total</th></tr></thead><tbody>'+(d.items||[]).map(l=>'<tr><td>'+esc(l.nombre)+'</td><td class="r">'+esc(l.cant)+'</td><td class="r">'+$(l.precio)+'</td><td class="r">'+$(num(l.cant)*num(l.precio))+'</td></tr>').join('')+(t.desc?'<tr><td colspan="3">Descuento'+(num(d.descPct)?' '+num(d.descPct)+'%':'')+'</td><td class="r">−'+$(t.desc)+'</td></tr>':'')+(t.envio?'<tr><td colspan="3">Envío</td><td class="r">'+$(t.envio)+'</td></tr>':'')+'</tbody></table>'+
    '<div class="tot"><span>Total</span><span>'+$(t.aCobrar)+'</span></div>'+(t.pagado?'<div class="obs" style="text-align:right;margin-top:4px">Seña recibida '+$(t.pagado)+' · Saldo '+$(t.saldo)+'</div>':'')+(d.obs?'<div class="obs">'+esc(d.obs)+'</div>':'')+
    '<div class="foot">¡Gracias por elegirnos! · '+[n.telefono,n.instagram,n.direccion].filter(Boolean).map(esc).join(' · ')+'</div></div><p class="muted" style="font-size:12.5px;margin:0">Descargalo como imagen para mandárselo al cliente.</p>';
  return { title:'Presupuesto para enviar', body, foot:'<button class="btn sm" data-act="backPresu">‹ Volver</button><span class="grow"></span><button class="btn sm" data-act="copyPresu">Copiar texto</button><button class="btn pri sm" data-act="jpgPresu">Descargar JPG</button>'+(waLink(d.telefono,'x')?'<a class="btn pri sm" target="_blank" rel="noopener" href="'+esc(waLink(d.telefono,textoPresu(d)))+'">Enviar por WhatsApp</a>':'') };
};
/* Presupuesto como imagen JPG, con la identidad de Tatan */
let LOGO_IMG = null;
function cargarLogo(){ return LOGO_IMG ? Promise.resolve(LOGO_IMG) : new Promise(res=>{ const i=new Image(); i.onload=()=>{LOGO_IMG=i;res(i);}; i.onerror=()=>res(null); i.src='logo-tatan.png'; }); }
async function presuJPG(d){
  const n = neg(); const tp = totPedido(d); const total = tp.aCobrar;
  const extras = [tp.desc?['Descuento'+(num(d.descPct)?' '+num(d.descPct)+'%':''),'−'+$(tp.desc)]:null, tp.envio?['Envío',$(tp.envio)]:null].filter(Boolean);
  try{ await Promise.all(['400 20px Nunito','700 20px Nunito','800 20px Nunito','400 20px Doughy'].map(f=>document.fonts.load(f))); }catch(e){}
  const logo = await cargarLogo();
  const W=1080, M=72, V='#703260', B='#FCEFD9', INK='#241B1F', MU='#7A6F74', LN='#E6E1DD';
  const c=document.createElement('canvas'); const x=c.getContext('2d');
  const F=(w,sz,fam)=>(w+' '+sz+'px '+(fam||'Nunito, sans-serif'));
  const wrap=(t,maxW,font)=>{ x.font=font; const out=[]; String(t||'').split('\n').forEach(par=>{ let line=''; par.split(' ').forEach(w=>{ const tst=line?line+' '+w:w; if(x.measureText(tst).width>maxW && line){ out.push(line); line=w; } else line=tst; }); out.push(line); }); return out; };
  // Medir alto
  const colP=W-2*M-500; const filas=(d.items||[]).map(l=>({l, lines:wrap(l.nombre,colP,F(400,28))}));
  const obsL = d.obs? wrap(d.obs,W-2*M,F(400,26)) : [];
  let H = M+150+40+ 3*86 + 30 + 60 + filas.reduce((a,f)=>a+f.lines.length*38+26,0) + extras.length*64 + (tp.pagado?50:0) + 40 + 110 + (obsL.length? obsL.length*36+40:0) + 150;
  c.width=W; c.height=H;
  x.fillStyle='#FFFFFF'; x.fillRect(0,0,W,H);
  x.fillStyle=V; x.fillRect(0,0,W,14);
  let y=M;
  if(logo){ const lh=110, lw=logo.width*lh/logo.height; x.drawImage(logo,M,y,lw,lh); } else { x.fillStyle=V; x.font=F(400,80,'Doughy, sans-serif'); x.textBaseline='top'; x.fillText(n.nombre||'Tatan',M,y); }
  x.textAlign='right'; x.textBaseline='top';
  x.fillStyle=V; x.font=F(400,46,'Doughy, Nunito, sans-serif'); x.fillText('PRESUPUESTO',W-M,y+4);
  x.fillStyle=MU; x.font=F(600,26); x.fillText('N° '+pad(d.numero||0)+'  ·  Emitido '+fdate(d.emision),W-M,y+66);
  x.textAlign='left'; y+=150;
  x.fillStyle=V; x.fillRect(M,y,W-2*M,4); y+=40;
  const meta=[['Cliente',d.clienteNombre],['Contacto',d.telefono],['Evento',d.evento],['Fecha del evento',d.fechaEvento?fdate(d.fechaEvento):''],['Invitados',d.invitados],['Válido hasta',d.validoHasta?fdate(d.validoHasta):'']];
  meta.forEach((m,i)=>{ const cx = M + (i%2)*((W-2*M)/2), cy = y + Math.floor(i/2)*86;
    x.fillStyle=MU; x.font=F(800,19); x.fillText(m[0].toUpperCase(),cx,cy); x.fillStyle=INK; x.font=F(600,29); x.fillText(String(m[1]||'—').slice(0,34),cx,cy+28); });
  y += 3*86 + 30;
  // Tabla
  x.fillStyle=B; x.beginPath(); x.roundRect? x.roundRect(M,y,W-2*M,56,14) : x.rect(M,y,W-2*M,56); x.fill();
  x.fillStyle=V; x.font=F(800,20); const cC=W-M-410, cU=W-M-215, cT=W-M-20;
  x.fillText('PRODUCTO',M+20,y+18); x.textAlign='right'; x.fillText('CANT.',cC,y+18); x.fillText('UNITARIO',cU,y+18); x.fillText('TOTAL',cT,y+18); x.textAlign='left';
  y+=60;
  filas.forEach(f=>{ const l=f.l; let yy=y+14; x.fillStyle=INK; x.font=F(400,28); f.lines.forEach(t=>{ x.fillText(t,M+20,yy); yy+=38; });
    x.textAlign='right'; x.font=F(600,28); x.fillText(String(l.cant||''),cC,y+14); x.fillText($(l.precio),cU,y+14); x.font=F(700,28); x.fillText($(num(l.cant)*num(l.precio)),cT,y+14); x.textAlign='left';
    y += f.lines.length*38+26; x.fillStyle=LN; x.fillRect(M,y-6,W-2*M,2); });
  extras.forEach(e=>{ x.fillStyle=INK; x.font=F(600,28); x.fillText(e[0],M+20,y+14); x.textAlign='right'; x.fillText(e[1],cT,y+14); x.textAlign='left'; y+=64; });
  y+=40;
  // Total
  const tw=520, th=90; x.fillStyle=V; x.beginPath(); x.roundRect? x.roundRect(W-M-tw,y,tw,th,45) : x.rect(W-M-tw,y,tw,th); x.fill();
  x.fillStyle=B; x.textBaseline='middle'; x.font=F(700,30); x.fillText('Total',W-M-tw+40,y+th/2); x.textAlign='right'; x.font=F(800,42); x.fillText($(total),W-M-40,y+th/2); x.textAlign='left'; x.textBaseline='top';
  y+=th+20;
  if(tp.pagado){ x.textAlign='right'; x.fillStyle=MU; x.font=F(600,24); x.fillText('Seña recibida '+$(tp.pagado)+'  ·  Saldo '+$(tp.saldo),W-M,y); x.textAlign='left'; y+=50; }
  if(obsL.length){ y+=20; x.fillStyle='#5E5458'; x.font=F(400,26); obsL.forEach(t=>{ x.fillText(t,M,y); y+=36; }); }
  // Pie
  const fy=H-110; x.fillStyle=LN; x.fillRect(M,fy,W-2*M,2);
  x.textAlign='center'; x.fillStyle=V; x.font=F(700,26); x.fillText('¡Gracias por elegirnos!',W/2,fy+26);
  const datos=[n.telefono,n.instagram,n.direccion].filter(Boolean).join('  ·  '); if(datos){ x.fillStyle=MU; x.font=F(600,22); x.fillText(datos,W/2,fy+62); }
  x.textAlign='left';
  return new Promise(res=>c.toBlob(res,'image/jpeg',0.92));
}
async function bajarPresuJPG(d){
  toast('Armando la imagen…');
  const blob = await presuJPG(d); if(!blob){ toast('No se pudo armar la imagen'); return; }
  const nombre = ('Presupuesto '+pad(d.numero||0)+(d.clienteNombre?' - '+d.clienteNombre:'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w .-]/g,'').trim()+'.jpg';
  const file = (typeof File==='function') ? new File([blob], nombre, {type:'image/jpeg'}) : null;
  const tactil = matchMedia('(pointer:coarse)').matches;
  if(tactil && file && navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file], title:nombre}); return; }catch(e){ if(e && e.name==='AbortError') return; } }
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=nombre; document.body.appendChild(a); a.click(); setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); }, 4000);
  toast('Presupuesto descargado');
}
SHEETS.entConf = function(){
  const p = S.pedidos[SH.draft.id]; if(!p) return { title:'Pedido', body:'<p class="muted">Este pedido ya no está.</p>', foot:'<span class="grow"></span><button class="btn" data-act="close">Cerrar</button>' };
  const t = totPedido(p); const res = (p.items||[]).map(l=>(num(l.cant)!==1?l.cant+'× ':'')+esc(l.nombre)).join(', ');
  return { title:'¿Se entregó el pedido?', body:'<p style="margin:0;font-size:16px">¿El pedido de <b>'+esc(p.clienteNombre||'Sin nombre')+'</b> fue entregado?</p><div class="card" style="font-size:14px">'+res+'<div class="muted" style="margin-top:6px">'+fdateShort(p.entrega)+' · '+$(t.aCobrar)+'</div></div>'+
      (t.saldo>0.5?'<div class="note">Ojo: todavía tiene saldo pendiente de <b>'+$(t.saldo)+'</b>.</div>':''),
    foot:'<button class="btn" data-act="close">No</button><span class="grow"></span><button class="btn pri" data-act="entSi" data-id="'+esc(p.id)+'">Sí, fue entregado</button>' };
};
SHEETS.texto = function(){ return { title:'Copiá este texto', body:'<p class="muted" style="margin:0">No se pudo copiar solo. Mantené apretado el texto para seleccionarlo.</p><textarea class="f" id="txtcopy" style="min-height:300px" readonly>'+esc(SH.draft.text)+'</textarea>', foot:'<span class="grow"></span><button class="btn pri" data-act="close">Listo</button>' }; };
SHEETS.gasto = function(){
  const d = SH.draft;
  const body = fld('concepto','Concepto',d.concepto,'text','placeholder="Ej: Alquiler, verdulería, sueldo Meli"')+
    '<div class="grid2">'+fld('monto','Monto ($)',d.monto||'','number')+fld('fecha','Fecha',d.fecha,'date')+'</div>'+
    '<div class="grid2">'+sel('tipo','Tipo',d.tipo,[['fijo','Fijo (todos los meses)'],['variable','Variable']])+fld('cat','Tipo de gasto',d.cat,'text','list="gcats"')+'<datalist id="gcats">'+[...new Set(['Alquiler','Agua','Abl','Alarma Monitoreada','Basura','Cargas Sociales','Claro','Control Plagas','Facturador','Autonomos','Monotributo','Seguros','Iva','Arba','Limpieza','Sueldos','Mantenimiento','Publicidad','Otros'].concat(Object.values(S.gastos).map(g=>g.cat).filter(Boolean)))].sort().map(c=>'<option value="'+esc(c)+'">').join('')+'</datalist>'+'</div>'+delBlock('este gasto');
  return { title: d.id?'Editar gasto':'Nuevo gasto', body, foot:(d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveGasto" '+(readOnly?'disabled':'')+'>Guardar</button>' };
};
function pendientesCliente(cid){ return pedidosArr().filter(p=>p.clienteId===cid && p.estado!=='cancelado' && totPedido(p).saldo>0.5).sort(byEntrega); }
function ccBox(d){
  const debe = saldoCliente(d.id); if(d.tipo!=='Cuenta corriente' && debe<=0.5) return '';
  const pend = pendientesCliente(d.id);
  return '<div class="ccbox"><div class="row between"><h3 style="margin:0">Cuenta corriente</h3><span class="pill '+(debe>0.5?'p-warn':'p-ok')+'">'+(debe>0.5?'Debe '+$(debe):'Al día')+'</span></div>'+
    (pend.length?'<div class="muted" style="font-size:13px">'+pend.map(p=>fdateShort(p.entrega)+' · '+$(totPedido(p).saldo)).join(' · ')+'</div>':'')+
    (debe>0.5?'<div class="grid3"><label class="lb">Paga ahora ($)<input class="f num" id="cc-monto" type="number" inputmode="decimal" step="any" value="'+esc(SH.ccMonto!=null?SH.ccMonto:Math.round(debe))+'"></label><label class="lb">Medio<select class="f" id="cc-medio">'+MEDIOS.filter(m=>m!=='Cuenta corriente').map(m=>'<option>'+m+'</option>').join('')+'</select></label><div style="display:flex;align-items:flex-end"><button class="btn pri" style="width:100%" data-act="cobrarCC">Registrar pago</button></div></div><div class="row" style="gap:8px"><button class="btn sm" data-act="copiarCC">Copiar resumen de cuenta</button></div>':'')+'</div>';
}
SHEETS.cliente = function(){
  const d = SH.draft; const ps = d.id? pedidosArr().filter(p=>p.clienteId===d.id).sort(byEntrega).reverse() : [];
  const body = '<div class="grid2">'+fld('nombre','Nombre',d.nombre)+fld('telefono','Teléfono',d.telefono,'tel')+'</div>'+sel('tipo','Tipo',d.tipo||'Particular',['Particular','Mayorista','Empresa','Cuenta corriente'])+
    '<label class="lb">Notas (gustos, alergias, cumpleaños)<textarea class="f" id="d-notas" data-d="notas">'+esc(d.notas||'')+'</textarea></label>'+
    (d.id? '<div class="tiles" style="grid-template-columns:repeat(3,1fr)"><div class="tile"><span class="k">Pedidos</span><span class="v num">'+ps.filter(p=>p.estado!=='cancelado').length+'</span></div><div class="tile"><span class="k">Comprado</span><span class="v num">'+$(sum(ps.filter(p=>p.estado!=='cancelado'),p=>totPedido(p).total))+'</span></div><div class="tile"><span class="k">Debe</span><span class="v num">'+$(saldoCliente(d.id))+'</span></div></div>'+
      ccBox(d)+
      '<div class="row between"><h3>Historial</h3><button class="btn sm" data-act="pedidoParaCliente">Nuevo pedido</button></div>'+(ps.length?'<div class="list">'+ps.map(pedidoItem).join('')+'</div>':'<p class="muted">Sin pedidos todavía.</p>') : '')+delBlock('este cliente (sus pedidos quedan)');
  return { title: d.id? d.nombre : 'Nuevo cliente', body, foot:(d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveCliente" '+(readOnly?'disabled':'')+'>Guardar</button>' };
};
SHEETS.receta = function(){
  const d = SH.draft; const c = recetaCosto(d); const n = neg(); const mult = num(n.multiplicador)||3;
  const q = norm(SH.q); const res = q.length>=2 ? Object.values(S.insumos).filter(i=>norm(i.nombre).includes(q)).slice(0,8) : [];
  const linked = d.id ? catalogo().filter(p=>p.recetaId===d.id) : [];
  const pq = norm(SH.pq||''); const pres = pq.length>=2 ? catalogo().filter(p=>norm(p.nombre).includes(pq) && p.recetaId!==d.id).slice(0,6) : [];
  const body = '<div class="grid3">'+'<div style="grid-column:1/-1">'+fld('nombre','Nombre de la receta',d.nombre)+'</div>'+fld('rinde','Rinde',d.rinde||'','number')+fld('unidadRinde','Unidad',d.unidadRinde||'unidades','text','placeholder="porciones, cuadrados…"')+fld('minutos','Minutos de trabajo',d.minutos||'','number')+'</div>'+
    '<div class="stack" style="gap:8px"><h3>Ingredientes</h3><div class="lines">'+((d.ingredientes||[]).map((l,i)=>{ const ins=S.insumos[l.insumoId]; const cu=insumoCU(ins);
      return '<div class="line" style="grid-template-columns:1fr 80px 84px 30px"><div class="nm">'+esc(ins?ins.nombre:'Insumo borrado')+'<small>'+(cu!=null?'$ '+cu.toLocaleString('es-AR',{maximumFractionDigits:2})+' /'+unidadLabel(ins.unidad):'<span style="color:var(--warn)">sin precio</span>')+'</small></div><input class="f num" id="ing-'+i+'" data-ing="'+i+'" type="number" inputmode="decimal" step="any" value="'+esc(l.cant)+'" aria-label="Cantidad en '+(ins?unidadLabel(ins.unidad):'')+'"><span class="num" style="text-align:right;font-size:13px">'+(cu!=null?$(cu*num(l.cant)):'—')+'<br><span class="muted" style="font-size:11px">'+(ins?unidadLabel(ins.unidad):'')+'</span></span><button class="rm" data-act="rmIng" data-i="'+i+'" aria-label="Quitar">×</button></div>'; }).join('') || '<div class="muted" style="font-size:13px">Buscá insumos abajo. Las cantidades van en gramos, mililitros o unidades.</div>')+'</div>'+
    '<div class="search">'+svg('search')+'<input class="f" id="ingq" data-sq="1" placeholder="Agregar insumo: escribí 2 letras" value="'+esc(SH.q)+'" autocomplete="off"></div>'+
    (res.length?'<div class="results">'+res.map(i=>'<button data-act="addIng" data-id="'+i.id+'"><span>'+esc(i.nombre)+'</span><span class="muted">'+(insumoCU(i)!=null?'$ '+insumoCU(i).toLocaleString('es-AR',{maximumFractionDigits:2})+'/'+unidadLabel(i.unidad):'sin precio')+'</span></button>').join('')+'</div>':'')+'</div>'+
    fld('extra','Otros costos de la tanda: packaging, gas, etc. ($)',d.extra||'','number')+
    '<div class="totals num"><div class="r"><span>Ingredientes</span><span>'+$(c.ing)+'</span></div><div class="r"><span>Mano de obra ('+num(d.minutos)+' min a '+$(n.costoHora)+'/h)</span><span>'+$(c.mo)+'</span></div>'+(c.extra?'<div class="r"><span>Otros</span><span>'+$(c.extra)+'</span></div>':'')+'<div class="r big"><span>Costo de la tanda</span><span>'+$(c.total)+'</span></div><div class="r" style="font-weight:700"><span>Costo por '+esc(singular(d.unidadRinde))+'</span><span>'+$(c.unit)+'</span></div><div class="r muted"><span>Precio sugerido (× '+mult+')</span><span>'+$(Math.ceil(c.unit*mult/100)*100)+'</span></div>'+(c.faltan?'<div class="r" style="color:var(--warn);font-size:13px"><span>Falta el precio de '+c.faltan+' insumo'+(c.faltan>1?'s':'')+'. El costo está incompleto.</span></div>':'')+'</div>'+
    '<div class="stack" style="gap:8px"><h3>Productos que salen de esta receta</h3>'+(d.id?'':'<p class="muted" style="margin:0;font-size:13px">Guardá la receta para vincularla a productos del catálogo.</p>')+
    (linked.length?'<div class="list">'+linked.map(p=>{ const pc=costoProducto(p)||{costo:0}; const mg=p.precio?(p.precio-pc.costo)/p.precio:null; return '<div class="item" style="cursor:default"><div class="main"><span class="t">'+esc(p.nombre)+'</span><span class="s">usa '+(num(p.factor)||1)+' '+esc(d.unidadRinde||'u')+' · costo '+$(pc.costo)+' · precio '+$(p.precio)+'</span></div><div class="end">'+(mg!=null?'<span class="pill '+(mg<.5?'p-warn':'p-ok')+'">'+pct(mg)+'</span>':'')+'<button class="btn sm ghost" data-act="unlinkProd" data-id="'+p.id+'">Quitar</button></div></div>'; }).join('')+'</div>':'')+
    (d.id?'<div class="search">'+svg('search')+'<input class="f" id="prodq" data-pq="1" placeholder="Vincular producto del catálogo" value="'+esc(SH.pq||'')+'" autocomplete="off"></div>'+(pres.length?'<div class="results">'+pres.map(p=>'<button data-act="linkProd" data-id="'+p.id+'"><span>'+esc(p.nombre)+'</span><span class="num muted">'+$(p.precio)+'</span></button>').join('')+'</div>':''):'')+'</div>'+
    '<label class="lb">Procedimiento y notas<textarea class="f" id="d-notas" data-d="notas" style="min-height:110px">'+esc(d.notas||'')+'</textarea></label>'+delBlock('esta receta');
  return { title: d.id? d.nombre||'Receta' : 'Nueva receta', body, foot:(d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveReceta" '+(readOnly?'disabled':'')+'>Guardar</button>' };
};
SHEETS.insumo = function(){
  const d = SH.draft; const cu = insumoCU(d);
  const cats = [...new Set(Object.values(S.insumos).map(i=>i.cat).filter(Boolean))].sort();
  const body = fld('nombre','Nombre',d.nombre)+
    '<div class="grid3">'+fld('precio','Precio de compra ($)',d.precio||'','number')+fld('presentacion','Cantidad que trae',d.presentacion||'','number')+sel('unidad','Unidad',d.unidad||'g',[['g','gramos'],['ml','mililitros'],['u','unidades']])+'</div>'+
    '<div class="note">'+(cu!=null?'Costo: <b class="num">$ '+cu.toLocaleString('es-AR',{maximumFractionDigits:3})+'</b> por '+unidadLabel(d.unidad)+(d.unidad!=='u'?' · <span class="num">'+$(cu*1000)+'</span> por '+(d.unidad==='g'?'kg':'litro'):''):'Cargá precio y cantidad. Ej: bolsa de harina $26.300 que trae 25000 g.')+(SH.orig&&SH.orig.precio&&num(d.precio)!==SH.orig.precio?'<br>Precio anterior: '+$(SH.orig.precio):'')+'</div>'+
    '<datalist id="dl-icat">'+cats.map(c=>'<option value="'+esc(c)+'">').join('')+'</datalist>'+
    '<div class="grid2">'+fld('cat','Categoría',d.cat,'text','list="dl-icat"')+fld('nota','Proveedor / código / nota',d.nota)+'</div>'+delBlock('este insumo');
  return { title: d.id? d.nombre : 'Nuevo insumo', body, foot:(d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveInsumo" '+(readOnly?'disabled':'')+'>Guardar</button>' };
};
SHEETS.stock = function(){
  const d = SH.draft; const big = d.unidad==='g'?'kg':d.unidad==='ml'?'lt':'u'; const f = d.unidad==='u'?1:1000;
  const body = '<div class="tiles" style="grid-template-columns:1fr 1fr"><div class="tile"><span class="k">Stock actual</span><span class="v num">'+(d.stock!=null&&d.stock!==''?fmtCant(d.stock,d.unidad):'Sin cargar')+'</span></div><div class="tile"><span class="k">Estado</span><span><span class="pill '+estadoStock(d)[1]+'">'+estadoStock(d)[0]+'</span></span></div></div>'+
    '<label class="lb">Cantidad ('+big+')<input class="f num" id="mov-q" type="number" inputmode="decimal" step="any" placeholder="Ej: 2,5"></label>'+
    '<div class="grid3"><button class="btn" data-act="mov" data-t="in">+ Entró</button><button class="btn" data-act="mov" data-t="out">− Salió</button><button class="btn" data-act="mov" data-t="set">Fijar stock</button></div>'+
    '<label class="lb">Avisar cuando queden ('+big+') o menos<input class="f num" id="min-q" type="number" inputmode="decimal" step="any" value="'+(d.minimo?num(d.minimo)/f:'')+'"></label>'+
    (d.ultimoMov?'<p class="muted" style="font-size:12.5px;margin:0">Último movimiento: '+esc(d.ultimoMov)+'</p>':'');
  return { title: d.nombre, body, foot:'<span class="grow"></span><button class="btn pri" data-act="saveMin" '+(readOnly?'disabled':'')+'>Guardar mínimo</button>' };
};
SHEETS.prod = function(){
  const d = SH.draft; const cats = [...new Set(catalogo().map(p=>p.cat))];
  const recetas = Object.values(S.recetas).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  const c = d.recetaId&&S.recetas[d.recetaId] ? costoProducto(d) : null;
  const body = fld('nombre','Nombre',d.nombre)+'<div class="grid2">'+fld('precio','Precio ($)',d.precio==null?'':d.precio,'number')+'<label class="lb">Categoría<input class="f" id="d-cat" data-d="cat" list="dl-cat" value="'+esc(d.cat||'')+'"></label></div><datalist id="dl-cat">'+cats.map(x=>'<option value="'+esc(x)+'">').join('')+'</datalist>'+
    '<div class="card stack" style="gap:10px"><h3>Costo</h3>'+sel('recetaId','Receta',d.recetaId||'',[['','Sin receta (costo estimado al '+num(neg().costoDefault)+'%)'],...recetas.map(r=>[r.id,r.nombre])])+
    (d.recetaId?'<div class="grid2">'+fld('factor','Unidades de receta que lleva',d.factor||1,'number')+fld('packaging','Packaging extra ($)',d.packaging||'','number')+'</div>':'')+
    (c?'<div class="note">Costo <b class="num">'+$(c.costo)+'</b>'+(d.precio?' · margen <b>'+pct((num(d.precio)-c.costo)/num(d.precio))+'</b>':'')+' · sugerido '+$(Math.ceil(c.costo*(num(neg().multiplicador)||3)/100)*100)+'</div>':'')+'</div>'+delBlock('este producto');
  return { title: d.id? 'Producto' : 'Nuevo producto', body, foot:(d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveProd" '+(readOnly?'disabled':'')+'>Guardar</button>' };
};
SHEETS.ajuste = function(){
  const d = SH.draft; const cats = [...new Set(catalogo().map(p=>p.cat))];
  const afect = catalogo().filter(p=>p.precio && (!d.cat||p.cat===d.cat));
  const nuevo = p => Math.round(p.precio*(1+num(d.pct)/100)/num(d.redondeo||1))*num(d.redondeo||1);
  const ej = afect.slice(0,4);
  const body = '<p class="muted" style="margin:0">Subí (o bajá) los precios de una categoría o de todo el catálogo de una vez.</p>'+
    sel('cat','Categoría',d.cat||'',[['','Todo el catálogo'],...cats])+'<div class="grid2">'+fld('pct','Porcentaje (%)',d.pct||'','number','placeholder="Ej: 8"')+sel('redondeo','Redondear a',d.redondeo||100,[[1,'Sin redondeo'],[10,'$ 10'],[100,'$ 100'],[500,'$ 500']])+'</div>'+
    (num(d.pct)? '<div class="note">Se actualizan <b>'+afect.length+'</b> productos. Ejemplos:<br>'+ej.map(p=>esc(p.nombre)+': '+$(p.precio)+' → <b>'+$(nuevo(p))+'</b>').join('<br>')+'</div>' : '');
  return { title:'Ajustar precios', body, foot:'<span class="grow"></span><button class="btn pri" data-act="aplicarAjuste" '+(!num(d.pct)||readOnly?'disabled':'')+'>Aplicar a '+afect.length+' productos</button>' };
};

SHEETS.orden = function(){
  const d = SH.draft; const q = norm(SH.q);
  const res = q.length>=2 ? Object.values(S.stockpt).filter(i=>norm(i.nombre).includes(q)).slice(0,8) : [];
  const body = '<div class="grid2">'+fld('fecha','Fecha',d.fecha,'date')+fld('armadaPor','La armó',d.armadaPor||'','text','placeholder="Ej: Martina"')+'</div>'+
    '<div class="stack" style="gap:8px"><h3>Qué producir</h3><div class="lines">'+((d.items||[]).map((x,i)=>'<div class="line" style="grid-template-columns:1fr 80px 30px"><div class="nm">'+esc(x.nombre)+(x.stockId&&S.stockpt[x.stockId]?'<small>hay '+num(S.stockpt[x.stockId].stock)+' · suma al stock al tildar</small>':'<small>no suma al stock</small>')+'</div><input class="f num" id="oi-'+i+'" data-oi="'+i+'" type="number" inputmode="decimal" step="any" value="'+esc(x.cant)+'" aria-label="Cantidad"><button class="rm" data-act="rmOrdItem" data-i="'+i+'" aria-label="Quitar">×</button></div>').join('') || '<div class="muted" style="font-size:13px">No hay nada para producir. Buscá productos abajo.</div>')+'</div>'+
    '<div class="search">'+svg('search')+'<input class="f" id="ordq" data-sq="1" placeholder="Agregar producto del stock: escribí 2 letras" value="'+esc(SH.q)+'" autocomplete="off"></div>'+
    (res.length?'<div class="results">'+res.map(i=>'<button data-act="addOrdItem" data-id="'+i.id+'"><span>'+esc(i.nombre)+'</span><span class="muted num">hay '+num(i.stock)+'</span></button>').join('')+'</div>':'')+
    (q.length>=2?'<button class="btn sm ghost" data-act="addOrdFree">+ Agregar “'+esc(SH.q)+'” como ítem libre</button>':'')+'</div>'+
    '<label class="lb">Nota para la cocina<textarea class="f" id="d-nota" data-d="nota">'+esc(d.nota||'')+'</textarea></label>'+delBlock('esta orden');
  return { title: d.id?'Orden de producción':'Nueva orden de producción', body, foot:(d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveOrden" '+(readOnly?'disabled':'')+'>'+(d.id?'Guardar':'Enviar a cocina')+'</button>' };
};
SHEETS.pt = function(){
  const d = SH.draft; const grupos=[...new Set(Object.values(S.stockpt).map(i=>i.grupo).filter(Boolean))];
  const body = fld('nombre','Producto',d.nombre)+'<datalist id="dl-grp">'+grupos.map(g=>'<option value="'+esc(g)+'">').join('')+'</datalist>'+
    '<div class="grid2">'+fld('grupo','Grupo',d.grupo,'text','list="dl-grp"')+sel('sector','Dónde está',d.sector||'Cocina',['Cocina','Local'])+'</div>'+
    '<div class="grid3">'+fld('stock','Hay ahora',d.stock,'number')+fld('minimo','Mínimo',d.minimo||'','number')+fld('objetivo','Cantidad ideal',d.objetivo||'','number')+'</div>'+
    '<p class="muted" style="margin:0;font-size:13px">Cuando “hay ahora” llega al mínimo, la producción pide lo que falta para llegar a la cantidad ideal.</p>'+
    fld('nota','Nota',d.nota)+delBlock('este producto del stock');
  return { title: d.id? d.nombre : 'Nuevo producto en stock', body, foot:(d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="savePT" '+(readOnly?'disabled':'')+'>Guardar</button>' };
};
SHEETS.emp = function(){
  const d = SH.draft;
  if(SH.edit){
    const body = fld('nombre','Nombre y apellido',d.nombre)+'<div class="grid2">'+fld('cuil','CUIL',d.cuil,'text','inputmode="numeric"')+fld('puesto','Puesto',d.puesto)+'</div>'+
      '<div class="grid2">'+fld('horario','Horario',d.horario,'text','placeholder="Ej: 09:00 a 13:00"')+fld('inicio','Fecha de ingreso',d.inicio,'date')+'</div>'+
      '<div class="grid2">'+fld('tarifa','Valor hora ($)',d.tarifa||'','number')+fld('telefono','Teléfono',d.telefono,'tel')+'</div>'+
      '<div class="grid2">'+fld('cbu','CBU o alias',d.cbu)+fld('libreta','Libreta sanitaria vence',d.libreta,'date')+'</div>'+
      sel('activo','Estado',d.activo===false?'no':'si',[['si','Trabaja con nosotras'],['no','Ya no trabaja']])+
      '<label class="lb">Notas<textarea class="f" data-d="nota" id="d-nota" rows="2">'+esc(d.nota||'')+'</textarea></label>'+delBlock('este empleado (las horas quedan)');
    return { title: d.nombre||'Nuevo empleado', body, foot:(d.creado?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveEmp">Guardar</button>' };
  }
  const k = d.id; const mes = U.mes;
  const hs = Object.values(S.horas).filter(h=>empKey(h.empleado)===k && (h.fecha||'').startsWith(mes)).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')||(b.ingreso||'').localeCompare(a.ingreso||''));
  const nov = Object.values(S.novedades).filter(n=>empKey(n.empleado)===k).sort((a,b)=>(b.desde||'').localeCompare(a.desde||'')).slice(0,20);
  const x = cuentasEmp(mes).find(c=>c.id===k) || {horas:0, importe:0, desc:0};
  const dato = (kk,l) => d[kk] ? '<div class="row between" style="font-size:13.5px"><span class="muted">'+l+'</span><span class="num" style="text-align:right">'+esc(kk==='inicio'||kk==='libreta'?fdate(d[kk]):d[kk])+'</span></div>' : '';
  const body = '<div class="tiles" style="grid-template-columns:repeat(3,1fr)"><div class="tile"><span class="k">Horas '+esc(MESES[+mes.slice(5)-1])+'</span><span class="v num">'+hhmm(x.horas)+'</span></div><div class="tile"><span class="k">A pagar</span><span class="v num">'+$(x.importe)+'</span></div><div class="tile"><span class="k">A descontar</span><span class="v num">'+$(x.desc)+'</span></div></div>'+
    '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm pri" data-act="nuevoTurno" data-emp="'+esc(d.nombre)+'">'+svg('plus')+'Horas</button><button class="btn sm" data-act="nuevaNov" data-emp="'+esc(d.nombre)+'">Novedad</button><button class="btn sm" data-act="copyLiq">Copiar liquidación</button><button class="btn sm ghost" data-act="editEmpDatos">Datos</button></div>'+
    ((d.cuil||d.puesto||d.horario||d.tarifa)?'<div class="card stack" style="gap:6px">'+dato('puesto','Puesto')+dato('cuil','CUIL')+dato('horario','Horario')+dato('inicio','Ingreso')+(d.tarifa?'<div class="row between" style="font-size:13.5px"><span class="muted">Valor hora</span><span class="num">'+$(d.tarifa)+'</span></div>':'')+dato('cbu','CBU / alias')+dato('libreta','Libreta sanitaria vence')+'</div>':'')+
    (nov.length?'<h3 style="margin:4px 0 0">Novedades</h3><div class="list">'+nov.map(n=>'<button class="item" data-act="editNov" data-id="'+n.id+'"><div class="main"><span class="t">'+esc(n.tipo)+'</span><span class="s">'+fdate(n.desde)+(n.hasta&&n.hasta!==n.desde?' al '+fdate(n.hasta):'')+(n.nota?' · '+esc(n.nota):'')+'</span></div>'+(num(n.monto)?'<div class="end"><span class="num">'+$(n.monto)+'</span></div>':'')+'</button>').join('')+'</div>':'')+
    '<h3 style="margin:4px 0 0">Horas de '+esc(mesLabel(mes))+'</h3>'+
    (hs.length?'<div class="list">'+hs.map(h=>'<button class="item" data-act="editTurno" data-id="'+h.id+'"><div class="main"><span class="t">'+fdateShort(h.fecha)+' · '+esc(h.ingreso||'')+(h.egreso?' a '+esc(h.egreso):'')+'</span><span class="s">'+hhmm(h.horas)+' h'+(h.tarifa?' × '+$(h.tarifa):'')+(h.obs?' · '+esc(h.obs):'')+'</span></div><div class="end"><span class="num" style="font-weight:700">'+$(h.importe)+'</span></div></button>').join('')+'</div>':'<p class="muted">Sin horas cargadas este mes.</p>');
  return { title: titulo(d.nombre)||'Empleado', body };
};
SHEETS.turno = function(){
  const d = SH.draft;
  const emps = [...new Set(Object.values(S.empleados).filter(e=>e.activo!==false).map(e=>e.nombre).concat(Object.values(S.horas).filter(h=>(h.fecha||'')>=addDays(today(),-60)).map(h=>h.empleado)).filter(Boolean))].sort();
  const hs = horasTurno(d); const imp = Math.round(hs*num(d.tarifa));
  const body = fld('empleado','Empleado',d.empleado,'text','list="emps" autocomplete="off"')+'<datalist id="emps">'+emps.map(e=>'<option value="'+esc(e)+'">').join('')+'</datalist>'+
    '<div class="grid3">'+fld('fecha','Fecha',d.fecha,'date')+fld('ingreso','Entró',d.ingreso,'time')+fld('egreso','Salió',d.egreso,'time')+'</div>'+
    '<div class="grid2">'+fld('tarifa','Valor hora ($)',d.tarifa||'','number')+fld('rubro','Tarea',d.rubro)+'</div>'+
    '<div class="tiles" style="grid-template-columns:1fr 1fr"><div class="tile"><span class="k">Horas</span><span class="v num">'+hhmm(hs)+'</span></div><div class="tile"><span class="k">Importe</span><span class="v num">'+$(imp)+'</span></div></div>'+
    fld('obs','Observación',d.obs)+delBlock('estas horas');
  return { title: d.id&&d.creado?'Editar horas':'Cargar horas', body, foot:(d.id&&d.creado?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveTurno">Guardar</button>' };
};
function horasTurno(d){ if(!d.ingreso||!d.egreso) return num(d.horas); let h = aHoras(d.egreso)-aHoras(d.ingreso); if(h<0) h+=24; return Math.round(h*100)/100; }
SHEETS.nov = function(){
  const d = SH.draft;
  const emps = [...new Set(Object.values(S.empleados).filter(e=>e.activo!==false).map(e=>e.nombre).filter(Boolean))].sort();
  const plata = ['Adelanto','Consumo en cuenta corriente','Aguinaldo','Aumento','Uniforme'].includes(d.tipo);
  const body = fld('empleado','Empleado',d.empleado,'text','list="emps2" autocomplete="off"')+'<datalist id="emps2">'+emps.map(e=>'<option value="'+esc(e)+'">').join('')+'</datalist>'+
    sel('tipo','Tipo',d.tipo,NOV_TIPOS)+'<div class="grid2">'+fld('desde','Fecha'+(plata?'':' desde'),d.desde,'date')+(plata?fld('monto','Monto ($)',d.monto||'','number'):fld('hasta','Hasta',d.hasta,'date'))+'</div>'+
    '<label class="lb">Detalle<textarea class="f" data-d="nota" id="d-nota" rows="2" placeholder="Ej: certificado médico, parentesco, período de vacaciones">'+esc(d.nota||'')+'</textarea></label>'+delBlock('esta novedad');
  return { title: d.id?'Novedad':'Nueva novedad', body, foot:(d.id?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveNov">Guardar</button>' };
};
SHEETS.prov = function(){
  const d = SH.draft; const x = cuentasProv().find(c=>c.id===d.id) || {saldo:0};
  const movs = movsArr().filter(m=>'pv-'+provKey(m)===d.id || (d.nombre && provKey(m)===slug(d.nombre))).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')||(b.updatedAt||'').localeCompare(a.updatedAt||''));
  const lim = SH.lim||40;
  if(SH.edit) {
    const body = fld('nombre','Nombre (como lo llaman)',d.nombre)+fld('razonSocial','Razón social',d.razonSocial)+'<div class="grid2">'+fld('cuit','CUIT',d.cuit,'text','inputmode="numeric"')+fld('rubro','Rubro',d.rubro,'text','list="rubros"')+'</div>'+
      '<datalist id="rubros">'+RUBROS_DEF().map(r=>'<option value="'+esc(r)+'">').join('')+'</datalist>'+
      '<div class="grid2">'+fld('banco','Banco',d.banco)+fld('alias','Alias',d.alias)+'</div>'+fld('cbu','CBU',d.cbu,'text','inputmode="numeric"')+fld('telefono','Teléfono / WhatsApp',d.telefono,'tel')+fld('domicilio','Domicilio',d.domicilio)+fld('productos','Qué le compramos',d.productos)+delBlock('este proveedor (los comprobantes quedan)');
    return { title: d.nombre||'Nuevo proveedor', body, foot:(d.creado?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveProv">Guardar</button>' };
  }
  const dato = (k,l) => d[k] ? '<div class="row between" style="font-size:13.5px"><span class="muted">'+l+'</span><span class="num" style="text-align:right;overflow-wrap:anywhere">'+esc(d[k])+'</span></div>' : '';
  const body = '<div class="tiles" style="grid-template-columns:1fr 1fr"><div class="tile"><span class="k">Saldo</span><span class="v num"'+(x.saldo>0.5?' style="color:var(--bad)"':'')+'>'+$(x.saldo)+'</span></div><div class="tile"><span class="k">Comprobantes</span><span class="v num">'+movs.length+'</span></div></div>'+
    '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm pri" data-act="nuevoMov" data-prov="'+esc(d.nombre)+'">'+svg('plus')+'Comprobante</button><button class="btn sm" data-act="nuevoMov" data-prov="'+esc(d.nombre)+'" data-tipo="PAGO">Registrar pago</button>'+((d.cbu||d.alias)?'<button class="btn sm" data-act="copyCBU">Copiar CBU/alias</button>':'')+'<button class="btn sm ghost" data-act="editProvDatos">Datos</button></div>'+
    ((d.razonSocial||d.cuit||d.cbu||d.alias)?'<div class="card stack" style="gap:6px">'+dato('razonSocial','Razón social')+dato('cuit','CUIT')+dato('banco','Banco')+dato('cbu','CBU')+dato('alias','Alias')+dato('productos','Le compramos')+'</div>':'')+
    (movs.length? '<div class="list">'+movs.slice(0,lim).map(m=>'<button class="item" data-act="editMov" data-id="'+m.id+'"><div class="main"><span class="t">'+esc(TIPO_LBL[m.tipo]||m.tipo)+(m.numero?' '+esc(m.numero):'')+'</span><span class="s">'+fdate(m.fecha)+(m.descripcion?' · '+esc(m.descripcion):'')+'</span></div><div class="end"><span class="num" style="font-weight:700'+(signoMov(m.tipo)<0?';color:var(--ok)':'')+'">'+(signoMov(m.tipo)<0?'− ':'')+$(m.total)+'</span></div></button>').join('')+'</div>'+(movs.length>lim?'<button class="btn" data-act="masMovs">Ver más ('+(movs.length-lim)+')</button>':'') : '<p class="muted">Sin comprobantes todavía.</p>');
  return { title: d.nombre||'Proveedor', body };
};
SHEETS.mov = function(){
  const d = SH.draft; const local = SECTOR==='local';
  const provs = [...new Set(Object.values(S.proveedores).map(p=>p.nombre).concat(movsArr().map(m=>m.proveedor)).filter(Boolean))].sort();
  const autoTot = num(d.neto)+num(d.iva)+num(d.percepciones);
  const body = '<div class="chips">'+TIPOS_MOV.filter(t=>!local||t==='FACTURA'||t==='REMITO').map(t=>'<button class="chip" data-act="movTipo" data-v="'+t+'" aria-pressed="'+(d.tipo===t)+'">'+TIPO_LBL[t]+'</button>').join('')+'</div>'+
    fld('proveedor','Proveedor',d.proveedor,'text','list="provs" autocomplete="off"')+'<datalist id="provs">'+provs.map(p=>'<option value="'+esc(p)+'">').join('')+'</datalist>'+
    '<div class="grid2">'+fld('fecha','Fecha',d.fecha,'date')+fld('numero',d.tipo==='PAGO'?'Referencia':'N° de comprobante',d.numero,'text',d.tipo==='PAGO'?'placeholder="Ej: a cuenta, transferencia"':'')+'</div>'+
    (d.tipo==='PAGO' ? fld('total','Importe pagado ($)',d.total||'','number') :
      '<div class="grid3">'+fld('neto','Neto ($)',d.neto||'','number')+fld('iva','IVA ($)',d.iva||'','number')+fld('percepciones','Percep. ($)',d.percepciones||'','number')+'</div>'+
      fld('total','Total ($)',d.total||'','number','placeholder="'+(autoTot?esc(String(autoTot)):'Si lo dejás vacío, suma neto + IVA + percepciones')+'"'))+
    fld('rubro','Rubro',d.rubro,'text','list="rubros2"')+'<datalist id="rubros2">'+RUBROS_DEF().map(r=>'<option value="'+esc(r)+'">').join('')+'</datalist>'+
    '<label class="lb">Detalle<textarea class="f" data-d="descripcion" id="d-descripcion" rows="2" placeholder="Qué vino, observaciones">'+esc(d.descripcion||'')+'</textarea></label>'+
    (local?'<div class="note">Queda guardado para administración. Después de guardar no lo vas a ver desde el local.</div>':'')+delBlock('este comprobante');
  return { title: d.id&&d.creado ? (TIPO_LBL[d.tipo]||'Comprobante') : 'Nuevo comprobante', body, foot:(d.id&&d.creado&&!local?'<button class="btn danger sm" data-act="delAsk">Borrar</button>':'')+'<span class="grow"></span><button class="btn pri" data-act="saveMov">Guardar</button>' };
};
SHEETS.importar = function(){
  const d = SH.draft;
  let body = '<p class="muted" style="margin:0">En Google Sheets abrí la planilla y elegí Archivo → Descargar → Microsoft Excel (.xlsx). Después elegí el archivo acá. Podés importar COCINA MAYORISTAS, PEDIDOS MINORISTAS, PEDIDOS MAYORISTAS, PROVEEDORES, GASTOS y EMPLEADOS, de a uno. Si importás el mismo archivo dos veces no se duplica nada.</p>'+
    '<label class="lb">Archivo de la planilla<input class="f" type="file" id="impfile" accept=".xlsx,.xls" data-chg="leerPlanilla"></label>';
  if(d.leyendo) body += '<p>Leyendo el archivo…</p>';
  if(d.res){ const r=d.res;
    body += '<div class="card stack" style="gap:6px"><b>'+esc(d.archivo||'')+'</b>'+
      (r.movprov.length?'<div class="row between"><span>Comprobantes de proveedores</span><b class="num">'+r.movprov.length.toLocaleString('es-AR')+'</b></div>':'')+
      (r.proveedores.length?'<div class="row between"><span>Proveedores con datos (CUIT, CBU…)</span><b class="num">'+r.proveedores.length+'</b></div>':'')+
      (r.pedidos.length?'<div class="row between"><span>Pedidos'+(r.pedidos.some(p=>p.origen==='fechaespecial')?' (meses con ventas de fecha especial)':r.pedidos.some(p=>p.origen==='bistrosoft')?' (días de venta del local)':r.pedidos.some(p=>p.origen==='cocina')?' de la semana (cocina)':r.pedidos.some(p=>p.canal==='Mayorista')?' mayoristas':' minoristas')+'</span><b class="num">'+r.pedidos.length.toLocaleString('es-AR')+'</b></div><div class="row between"><span class="muted">Clientes</span><b class="num">'+r.clientes.length.toLocaleString('es-AR')+'</b></div>':'')+
      (r.listaMay.length?'<div class="row between"><span>Lista de precios mayorista</span><b class="num">'+r.listaMay.length+'</b></div>':'')+
      (r.empleados.length?'<div class="row between"><span>Empleados (nómina)</span><b class="num">'+r.empleados.length+'</b></div>':'')+
      (r.horas.length?'<div class="row between"><span>Turnos y horas trabajadas</span><b class="num">'+r.horas.length.toLocaleString('es-AR')+'</b></div>':'')+
      (r.gastos.length?'<div class="row between"><span>Gastos</span><b class="num">'+r.gastos.length.toLocaleString('es-AR')+'</b></div>':'')+
      (r.desde?'<div class="row between"><span class="muted">Desde – hasta</span><span>'+fdate(r.desde)+' – '+fdate(r.hasta)+'</span></div>':'')+
      (r.omitidas?'<div class="muted" style="font-size:12.5px">'+r.omitidas+' filas sin fecha o sin importe quedaron afuera.</div>':'')+
      (!r.pedidos.length&&!r.listaMay.length&&!r.movprov.length&&!r.proveedores.length&&!r.gastos.length&&!r.empleados.length&&!r.horas.length?'<p class="err" style="margin:0">No encontré hojas que pueda leer en este archivo (LISTADO DE PEDIDOS, DETALLE, Datos Proveedores, CBU Proveedores, NOMINA EMPLEADOS o BD - VTAS de Bistrosoft).</p>':'')+'</div>';
  }
  if(d.prog) body += '<p class="num">Guardando… '+esc(d.prog)+'</p>';
  if(d.listo) body += '<div class="note">Listo. '+esc(d.listo)+'</div>';
  const can = d.res && (d.res.pedidos.length||d.res.listaMay.length||d.res.movprov.length||d.res.proveedores.length||d.res.gastos.length||d.res.empleados.length||d.res.horas.length) && !d.prog && !d.listo;
  return { title:'Importar desde planillas', body, foot:'<span class="grow"></span>'+(d.listo?'<button class="btn pri" data-act="close">Cerrar</button>':'<button class="btn pri" data-act="importarYa" '+(can?'':'disabled')+'>Importar</button>') };
};
SHEETS.cuenta = function(){
  return { title: (PERFIL&&PERFIL.nombre)||'Mi cuenta', body:
    '<div class="tile"><span class="k">Sector</span><span class="v" style="font-size:18px">'+esc(SECTORES[SECTOR]||SECTOR)+'</span></div>'+
    '<p class="muted" style="margin:0;font-size:13.5px">Entraste como '+esc(USER_EMAIL)+'. Lo que ves depende de tu sector; lo asignan las dueñas o administración en Más → Equipo y usuarios.</p>'+
    '<div class="note">Para tenerla como app: en el iPhone o iPad abrí esta página en Safari, tocá Compartir y elegí "Agregar a inicio".</div>',
    foot:'<button class="lnk" data-act="salirTodos">Cerrar en todos los dispositivos</button><span class="grow"></span><button class="btn danger" data-act="salir">Cerrar sesión</button>' };
};

/* ---------- acciones ---------- */
async function cargarXLSX(){
  if(window.XLSX) return true;
  await new Promise(ok => { const sc=document.createElement('script'); sc.src='vendor/xlsx.full.min.js'; sc.onload=ok; sc.onerror=ok; document.head.appendChild(sc); });
  return !!window.XLSX;
}
function aFecha(v){
  if(v instanceof Date && !isNaN(v)) return isoDate(new Date(v.getTime()+12*3600e3));
  if(typeof v==='number' && v>20000 && v<80000){ const d=new Date(Date.UTC(1899,11,30)+v*864e5); return d.toISOString().slice(0,10); }
  const m = String(v||'').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if(!m) return '';
  const y = m[3].length===2 ? '20'+m[3] : m[3]; return y+'-'+pad(+m[2])+'-'+pad(+m[1]);
}
function aPlata(v){ if(typeof v==='number') return v; let t=String(v==null?'':v).replace(/[$\s]/g,''); if(!t) return 0; const neg=/^-|^\(/.test(t); t=t.replace(/[()\-]/g,'');
  if(t.includes(',')) t=t.replace(/\./g,'').replace(',','.'); else if(/^\d{1,3}(\.\d{3})+$/.test(t)) t=t.replace(/\./g,''); const n=parseFloat(t); return isNaN(n)?0:(neg?-n:n); }
function hashTxt(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
const titulo = s => String(s||'').toLowerCase().replace(/(^|\s)\S/g, c=>c.toUpperCase()).replace(/ (De|Del|La|Las|Los|Y|En|Por|A) /g, m=>m.toLowerCase());
const FIJOS = ['ALQUILER','AGUA','ABL','ALARMA MONITOREADA','BASURA','CLARO','CONTROL PLAGAS','FACTURADOR','AUTONOMOS','MONOTRIBUTO','SEGUROS','CARGAS SOCIALES','TASA RESIDUOS'];
function aCant(t){ t=String(t).trim().replace(',','.'); let m=t.match(/^(\d+)\s+(\d+)\/(\d+)$/); if(m) return +m[1]+(+m[2])/(+m[3]); m=t.match(/^(\d+)\/(\d+)$/); if(m) return (+m[1])/(+m[2]); return parseFloat(t)||0; }
function buscarProd(nombre){ const n=norm(nombre).replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); if(!n) return null; const cat=catalogo();
  return cat.find(p=>norm(p.nombre).trim()===n) || cat.find(p=>norm(p.nombre).replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()===n) || (n.length>=5 ? cat.find(p=>norm(p.nombre).startsWith(n)) : null) || null; }
function parsearPedido(txt, mayorista){
  const out = {cliente:'', hora:'', items:[], notas:[]};
  String(txt||'').split(/\r?\n/).forEach((raw, idx) => {
    let l = raw.replace(/[⁠​ ]/g,' ').replace(/^\s*[-•*·–]+\s*/,'').trim(); if(!l) return;
    let cant=0, nombre='';
    let m = l.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(?:x\s+)?(.+)$/i);
    if(m && !/^\d{1,2}[.:]\d{2}\s*(hs)?$/i.test(l)){ cant=aCant(m[1]); nombre=m[2]; }
    else { m = l.match(/^(.+?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\b\s*(.*)$/i); if(m){ cant=aCant(m[2]); nombre=(m[1]+' '+m[3]).trim(); } }
    if(cant>0 && nombre){ nombre = nombre.replace(/^de\s+/i,'').trim(); const p = buscarProd(nombre.replace(/\(.*?\)/g,'').trim());
      out.items.push({pid:p?p.id:'', nombre: p? p.nombre : nombre, cant, precio: p ? ((mayorista && p.precioMay) ? p.precioMay : (p.precio||0)) : 0, ...(p && norm(p.nombre)!==norm(nombre) ? {detalle:nombre} : {})});
      return; }
    const hm = l.match(/(\d{1,2})(?:[.:](\d{2}))?\s*hs/i);
    if(!out.cliente && !out.items.length && idx < 3){ if(hm){ out.hora = pad(+hm[1])+':'+(hm[2]||'00'); l = l.replace(hm[0],'').trim(); } out.cliente = l.replace(/\s+/g,' ').trim(); return; }
    out.notas.push(l);
  });
  return out;
}
function leerSemana(filas, nombreHoja, out, marcar){
  let hd=-1; for(let i=0;i<Math.min(filas.length,6);i++){ const up=filas[i].map(c=>norm(c).toUpperCase().trim()); if(up.includes('LUNES') && up.includes('MARTES')){ hd=i; break; } }
  if(hd<0) return false;
  const fechas = filas[hd+1] || []; const base = today(); const cols = [];
  filas[hd].forEach((c,j)=>{ const f = String(fechas[j]||'').trim(); const m = f.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/); let iso='';
    if(m){ let y = m[3] ? (m[3].length===2?'20'+m[3]:m[3]) : base.slice(0,4); iso = y+'-'+pad(+m[2])+'-'+pad(+m[1]); if(!m[3] && iso < addDays(base,-200)) iso = (+y+1)+iso.slice(4); }
    else if(fechas[j] instanceof Date) iso = aFecha(fechas[j]);
    if(iso && /LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO/.test(norm(c).toUpperCase())) cols.push({j, iso}); });
  const may = /MAYOR/i.test(nombreHoja); const vistos={};
  filas.slice(hd+2).forEach(f => cols.forEach(({j, iso}) => { const txt = String(f[j]||'').trim(); if(!txt) return;
    const res = parsearPedido(txt, may); if(!res.items.length && !res.cliente) return;
    if(!res.items.length && res.cliente && !res.notas.length){ return; }
    const p = {clienteNombre: res.cliente || 'Sin nombre', canal: may?'Mayorista':'Pedido particular', entrega: iso, hora: res.hora, estado: iso < today() ? 'entregado' : 'pendiente', items: res.items, descuento:'', envio:'', pagos:[], notas: res.notas.join('\n'), creado: today(), origen:'cocina'};
    const b='pk-'+hashTxt([iso,p.clienteNombre,txt].join('|')); vistos[b]=(vistos[b]||0)+1; p.id=b+(vistos[b]>1?'-'+vistos[b]:'');
    out.pedidos.push(p); marcar(iso); }));
  return true;
}
function leerPedidos(filas, out, marcar){
  let h=-1, cols=null;
  for(let i=0;i<Math.min(filas.length,15);i++){ const up=filas[i].map(c=>norm(c).toUpperCase().trim()); if(up.includes('FECHA') && up.includes('PRODUCTO')){ h=i; cols=up; break; } }
  if(h<0) return;
  const ix = n => cols.findIndex(c=>c===n);
  const iF=ix('FECHA'), iN=ix('NOMBRE'), iTel=ix('CELULAR'), iHs=ix('HS'), iRem=ix('REMITO'), iFac=ix('FACTURA'), iC=ix('CANT.'), iP=ix('PRODUCTO'), iO=ix('OBS'), iU=ix('$ UNITARIO'), iI=ix('IMPORTE'), iT=ix('TOTAL');
  const iSe = ix('SENA')>=0 ? ix('SENA') : ix('PAGO');
  const formas = cols.map((c,i)=>c.startsWith('FORMA')?i:-1).filter(i=>i>=0);
  const iFp1 = formas[0]!=null?formas[0]:-1, iFp2 = formas[1]!=null?formas[1]:-1, iSa=ix('SALDO'), iFpago=ix('FECHA PAGO');
  const mayorista = iRem>=0;
  const cat = catalogo(); const porNombre = {}; cat.forEach(p=>{ porNombre[norm(p.nombre).trim()] = p; });
  const clientes = {}; let cur=null; const vistos={};
  const cerrar = () => { if(!cur) return; const p=cur; cur=null;
    if(!p.items.length && !p.envio) return;
    const base='pd-'+hashTxt([p.entrega,p.clienteNombre,p.remito||'',p.items.map(i=>i.cant+'x'+i.nombre+'@'+i.precio).join(';')].join('|')); vistos[base]=(vistos[base]||0)+1; p.id=base+(vistos[base]>1?'-'+vistos[base]:'');
    const tot = totPedido(p); if(p._total && Math.abs(p._total - tot.aCobrar) > 1 && !p.items.length){ p.items.push({pid:'', nombre:'Pedido', cant:1, precio:p._total}); }
    delete p._total; out.pedidos.push(p); marcar(p.entrega); };
  filas.slice(h+1).forEach(f => {
    const fecha = aFecha(f[iF]); const nom = String(iN>=0?f[iN]:'').trim(); const prod = String(iP>=0?f[iP]:'').trim(); const rem = String(iRem>=0?f[iRem]:'').trim();
    if(!fecha && !nom && !prod){ return; }
    if(!fecha || !nom){ out.omitidas++; return; }
    const nuevo = !cur || cur.entrega!==fecha || norm(cur.clienteNombre)!==norm(nom) || (mayorista && rem && rem!==cur.remito) || (!mayorista && aPlata(iT>=0?f[iT]:'')>0 && cur.items.length>0);
    if(nuevo){ cerrar();
      const ck='cl-'+slug(nom); if(!clientes[ck]) clientes[ck]={id:ck, nombre:nom, telefono:String(iTel>=0?f[iTel]:'').trim(), tipo: mayorista?'Mayorista':'Particular', origen:'planilla'};
      cur = {clienteNombre:nom, clienteId:ck, telefono:String(iTel>=0?f[iTel]:'').trim(), canal: mayorista?'Mayorista':'Pedido particular', entrega:fecha, hora:aHora(iHs>=0?f[iHs]:''), estado: fecha < today() ? 'entregado' : 'pendiente', items:[], descuento:'', envio:'', pagos:[], notas:'', creado:fecha, origen:'planilla', remito:rem, factura:String(iFac>=0?f[iFac]:'').trim(), _total: aPlata(iT>=0?f[iT]:'')};
      const sena = aPlata(iSe>=0?f[iSe]:''); const saldo = iSa>=0 && String(f[iSa]).trim()!=='' ? aPlata(f[iSa]) : null;
      const fpago = iFpago>=0 ? (aFecha(f[iFpago])||fecha) : fecha;
      if(sena) cur.pagos.push({f: fpago, monto: sena, medio: titulo(iFp1>=0?f[iFp1]:'') || ''});
      const fp2 = titulo(iFp2>=0?f[iFp2]:''); if(!mayorista && (saldo===0 || fp2) && cur._total > sena) cur.pagos.push({f: fecha, monto: cur._total - sena, medio: titulo(iFp2>=0?f[iFp2]:'') || titulo(iFp1>=0?f[iFp1]:'')});
    }
    const cant = num(String(iC>=0?f[iC]:'').replace(',','.')) || 1; let precio = aPlata(iU>=0?f[iU]:''); const imp = aPlata(iI>=0?f[iI]:'');
    if(!precio && imp) precio = imp/cant;
    if(/^env[ií]o/i.test(norm(prod))){ cur.envio = num(cur.envio) + (imp || precio*cant); return; }
    if(!prod && !imp) return;
    const p = porNombre[norm(prod).trim()];
    cur.items.push({pid: p?p.id:'', nombre: prod || 'Sin detalle', cant, precio: Math.round(precio*100)/100, listo: cur.estado==='entregado'});
    const obs = String(iO>=0?f[iO]:'').trim(); if(obs) cur.notas = (cur.notas?cur.notas+' · ':'') + obs;
  });
  cerrar();
  // si en mayoristas hay saldo cero en la fila de total, el pago puede venir sin monto: se respeta lo de la planilla
  out.clientes = out.clientes.concat(Object.values(clientes));
}
function leerListaMay(filas, out){
  let h=-1, iP=-1, iM=-1;
  for(let i=0;i<Math.min(filas.length,10);i++){ const up=filas[i].map(c=>norm(c).toUpperCase().trim()); const a=up.indexOf('PRODUCTOS'); const b=up.findIndex(c=>/PRECIO MAY/.test(c)); if(a>=0 && b>=0){ h=i; iP=a; iM=b; break; } }
  if(h<0) return;
  filas.slice(h+1).forEach(f => { const n=String(f[iP]||'').trim(); const pr=aPlata(f[iM]); if(n && pr) out.listaMay.push({nombre:n, precioMay:pr, grupo:String(f[0]||'').trim()}); });
}
function leerBistrosoft(filas, out, marcar){
  // Exportación de caja de Bistrosoft: Monto | Movimiento | Fecha | Hora | Descripción | Medio de Pago | ...
  // Se suman las comandas de cada día (sin las anuladas ni "Otros", que son consumos internos) y queda una venta por día.
  let h=-1, cols=null;
  for(let i=0;i<Math.min(filas.length,5);i++){ const up=filas[i].map(c=>norm(c).toUpperCase().trim()); if(up.includes('MONTO') && up.includes('MOVIMIENTO') && up.includes('MEDIO DE PAGO')){ h=i; cols=up; break; } }
  if(h<0) return false;
  const iM=cols.indexOf('MONTO'), iMov=cols.indexOf('MOVIMIENTO'), iF=cols.indexOf('FECHA'), iP=cols.indexOf('MEDIO DE PAGO');
  const dias = {};
  filas.slice(h+1).forEach(f => { if(norm(f[iMov]).trim()!=='comanda') return; const medio=String(f[iP]||'').trim()||'Efectivo'; if(/^otros$/i.test(medio)) return;
    const fecha=aFecha(f[iF]); const m=aPlata(f[iM]); if(!fecha || !m){ out.omitidas++; return; }
    const d = dias[fecha] || (dias[fecha] = {total:0, n:0, medios:{}}); d.total+=m; d.n++; d.medios[medio]=(d.medios[medio]||0)+m; });
  Object.keys(dias).sort().forEach(fecha => { const d=dias[fecha]; const r2=x=>Math.round(x*100)/100;
    out.pedidos.push({id:'bs-'+fecha, clienteNombre:'Mostrador', canal:'Local', entrega:fecha, hora:'', estado:'entregado', items:[{pid:'', nombre:'Ventas del local (Bistrosoft)', cant:1, precio:r2(d.total)}], descuento:'', envio:'',
      pagos:Object.entries(d.medios).map(([medio,monto])=>({f:fecha, monto:r2(monto), medio})), notas:d.n+' comandas del día en Bistrosoft', creado:fecha, origen:'bistrosoft'});
    marcar(fecha); });
  return true;
}
function leerEstadoResultado(filas, nombreHoja, out, marcar){
  // RESUMEN VENTAS → "ESTADO DE RESULTADO …": se toma solo la fila FECHA ESPECIAL (Día de la Madre, Navidad, etc.), que no está en otra planilla.
  if(!/^estado de resultado/i.test(nombreHoja.trim())) return false;
  const MES={ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,sept:9,set:9,oct:10,nov:11,dic:12};
  const aMes = v => { if(typeof v==='number' || v instanceof Date){ const f=aFecha(v); return f?f.slice(0,7):''; }
    const m=norm(v).trim().match(/^([a-z]+)[\s\-\/.]*(\d{2,4})$/); if(!m||!MES[m[1]]) return ''; const y=m[2].length===2?'20'+m[2]:m[2]; return y+'-'+pad(MES[m[1]]); };
  let cab=null; filas.slice(0,6).forEach(f=>{ if(!cab && f.filter(c=>aMes(c)).length>=3) cab=f; });
  const fila = filas.find(f=>/^fecha especial$/i.test(norm(f[0]).trim()));
  if(!cab || !fila) return true;
  cab.forEach((c,j)=>{ const mes=aMes(c); const monto=aPlata(fila[j]); if(!mes||!monto) return;
    const [y,m]=mes.split('-').map(Number); const fecha=mes+'-'+pad(new Date(y,m,0).getDate());
    out.pedidos.push({id:'fe-'+mes, clienteNombre:'Fechas especiales', canal:'Fecha especial', entrega:fecha, hora:'', estado:'entregado', items:[{pid:'', nombre:'Ventas de fecha especial', cant:1, precio:Math.round(monto*100)/100}], descuento:'', envio:'',
      pagos:[{f:fecha, monto:Math.round(monto*100)/100, medio:'Varios'}], notas:'Total del mes según Estado de Resultado (RESUMEN VENTAS)', creado:fecha, origen:'fechaespecial'}); marcar(fecha); });
  return true;
}
function leerLibro(wb){
  const out = {pedidos:[], clientes:[], listaMay:[], movprov:[], proveedores:[], gastos:[], empleados:[], horas:[], omitidas:0, desde:'', hasta:''};
  const vistos = {}; const provs = {};
  const marcar = f => { if(!f) return; if(!out.desde||f<out.desde) out.desde=f; if(!out.hasta||f>out.hasta) out.hasta=f; };
  wb.SheetNames.forEach(nombre => {
    if(/^ingres(o|ar)$/i.test(nombre.trim())) return;
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombre], {header:1, raw:true, defval:''});
    if(/^listado de pedidos$/i.test(nombre.trim())){ leerPedidos(filas, out, marcar); return; }
    if(leerBistrosoft(filas, out, marcar)) return;
    if(leerEstadoResultado(filas, nombre, out, marcar)) return;
    if(leerSemana(filas, nombre, out, marcar)) return;
    if(/^lista de precios$/i.test(nombre.trim())){ leerListaMay(filas, out); return; }
    let h=-1, cols=null;
    for(let i=0;i<Math.min(filas.length,15);i++){ const up=filas[i].map(c=>norm(c).toUpperCase().trim()); if((up.includes('FECHA')&&up.includes('TIPO')) || (up.includes('PROVEEDORES')&&up.includes('CUIT'))){ h=i; cols=up; break; } }
    if(h<0){ for(let i=0;i<Math.min(filas.length,15);i++){ const up=filas[i].map(c=>norm(c).toUpperCase().trim()); if(up.includes('EMPLEADO') && (up.includes('FECHA')||up.includes('CUIL'))){ h=i; cols=up; break; } } }
    if(h<0) return;
    const ix = n => cols.findIndex(c=>c===n || c.startsWith(n));
    const iF=ix('FECHA'), iT=ix('TIPO'), iN=ix('N° RTO/FC')>=0?ix('N° RTO/FC'):cols.findIndex(c=>/^N.?\s?RTO/.test(c)), iR=ix('RUBRO'), iP=ix('PROVEEDOR'), iD=ix('DESCRIPCION'), iNe=ix('IMPORTE NETO'), iIva=ix('IVA'), iPe=ix('PERCEPCIONES'), iTo=ix('TOTAL'), iI=ix('IMPORTE');
    const iCuit=ix('CUIT');
    const iE=ix('EMPLEADO');
    if(iE>=0 && ix('CUIL')>=0){ // nómina
      const iCl=ix('CUIL'), iPu=ix('PUESTO'), iHo=ix('HORARIO'), iIn=ix('FECHA INICIO');
      // La nómina termina donde empiezan otras listas (libretas sanitarias, turnos por día): ahí no hay CUIL sino DNI.
      let corte=false; const vistos=new Set();
      filas.slice(h+1).forEach(f => { const n=String(f[iE]||'').trim(); if(corte) return; if(/^(LIBRETAS|NOMBRE Y APELLIDO)/i.test(norm(n))){ corte=true; return; }
        if(!n || /^(EMPLEADO|EFECTIVOS|EVENTUALES|TEMPORAL(ES)?|MONOTRIBUTO|CONTRATADOS?)$/i.test(norm(n))) return; const id=empKey(n); if(vistos.has(id)) return; vistos.add(id);
        const cl=String(f[iCl]||'').replace(/\D/g,'');
        out.empleados.push(Object.assign({id, nombre:n, activo:true, origen:'planilla'}, cl.length===11?{cuil:cl}:{}, iPu>=0&&f[iPu]?{puesto:String(f[iPu]).trim()}:{}, iHo>=0&&f[iHo]?{horario:String(f[iHo]).trim()}:{}, iIn>=0&&aFecha(f[iIn])?{inicio:aFecha(f[iIn])}:{})); });
      return;
    }
    if(iE>=0 && iF>=0 && ix('CANT. HORAS')>=0){ // horas trabajadas
      const iRu=ix('RUBRO'), iHi=ix('HR INGRESO'), iHe=ix('HR EGRESO'), iCh=ix('CANT. HORAS'), iTa=ix('TARIFA'), iIm=ix('IMPORTE TOTAL'), iOb=ix('OBS');
      filas.slice(h+1).forEach(f => { const fecha=aFecha(f[iF]); const n=String(f[iE]||'').trim(); const horas=Math.round(aHoras(f[iCh])*100)/100; const importe=aPlata(iIm>=0?f[iIm]:'');
        if(!fecha || !n || (!horas && !importe)){ if(fecha||n) out.omitidas++; return; }
        const t = {fecha, empleado:n, rubro:titulo(iRu>=0?f[iRu]:''), ingreso:aHora(iHi>=0?f[iHi]:''), egreso:aHora(iHe>=0?f[iHe]:''), horas, tarifa:aPlata(iTa>=0?f[iTa]:''), importe, obs:String(iOb>=0?f[iOb]:'').trim(), origen:'planilla', creado:today()};
        // Un número fuera de lugar (ej. el valor hora en "HS RECIBO") da importes absurdos: ahí se recalcula con horas × tarifa.
        if(Math.abs(importe) > 10000000 && horas && t.tarifa){ t.importe = Math.round(horas*t.tarifa); out.corregidas = (out.corregidas||0)+1; }
        const base='hs-'+hashTxt([fecha,n,t.ingreso,t.egreso,horas,importe].join('|')); vistos[base]=(vistos[base]||0)+1; t.id=base+(vistos[base]>1?'-'+vistos[base]:'');
        t._hoja = nombre; out.horas.push(t); marcar(fecha); });
      return;
    }
    if(iCuit>=0 && iP>=0 && iF<0){ // datos de proveedores
      const iRS=ix('RAZON SOCIAL'), iB=ix('BANCO'), iC=ix('CBU'), iA=ix('ALIAS'), iDo=ix('DOMICILIO'), iPr=ix('PRODUCTOS'), iCu=ix('CUENTA');
      filas.slice(h+1).forEach(f => { const n=String(f[iP]||'').trim(); if(!n) return; const id='pv-'+slug(n); const p = provs[id] || (provs[id]={id, nombre:n});
        const put=(k,i)=>{ if(i>=0 && String(f[i]).trim()) p[k]=String(f[i]).trim(); };
        put('cuit',iCuit); put('razonSocial',iRS); put('banco',iB); put('cbu',iC); put('alias',iA); put('domicilio',iDo); put('productos',iPr); put('cuenta',iCu); });
      return;
    }
    if(iF<0 || iT<0) return;
    filas.slice(h+1).forEach(f => {
      const fecha = aFecha(f[iF]);
      if(iP>=0){ // comprobantes de proveedores
        const total = aPlata(f[iTo>=0?iTo:iNe]) || (aPlata(f[iNe])+aPlata(f[iIva])+aPlata(f[iPe])); const prov=String(f[iP]||'').trim();
        if(!fecha || !total || !prov){ if(fecha||total||prov) out.omitidas++; return; }
        let tipo = norm(f[iT]).toUpperCase().trim(); if(/^FAC/.test(tipo)) tipo='FACTURA'; else if(/^REM|^RTO/.test(tipo)) tipo='REMITO'; else if(/^PAG/.test(tipo)) tipo='PAGO'; else if(/^N.?\s?C|CREDITO/.test(tipo)) tipo='NC'; else if(/^N.?\s?D|DEBITO/.test(tipo)) tipo='ND'; else if(!tipo) tipo='FACTURA';
        const m = {fecha, tipo, numero:String(iN>=0?f[iN]:'').trim(), rubro:titulo(iR>=0?f[iR]:''), proveedor:prov, descripcion:String(iD>=0?f[iD]:'').trim(), neto:aPlata(iNe>=0?f[iNe]:''), iva:aPlata(iIva>=0?f[iIva]:''), percepciones:aPlata(iPe>=0?f[iPe]:''), total, origen:'planilla', creado:today()};
        const base='mv-'+hashTxt([fecha,tipo,m.numero,prov,total,m.descripcion].join('|')); vistos[base]=(vistos[base]||0)+1; m.id = base+(vistos[base]>1?'-'+vistos[base]:'');
        out.movprov.push(m); marcar(fecha);
      } else if(iI>=0){ // gastos
        const monto = aPlata(f[iI]); const tipoG = String(f[iT]||'').trim();
        if(!fecha || !monto){ if(fecha||monto||tipoG) out.omitidas++; return; }
        const g = {fecha, monto, cat:titulo(tipoG)||'Otros', concepto:String(iD>=0?f[iD]:'').trim()||titulo(tipoG), tipo: FIJOS.includes(norm(tipoG).toUpperCase().trim())?'fijo':'variable', origen:'planilla'};
        const base='gs-'+hashTxt([fecha,tipoG,monto,g.concepto].join('|')); vistos[base]=(vistos[base]||0)+1; g.id = base+(vistos[base]>1?'-'+vistos[base]:'');
        out.gastos.push(g); marcar(fecha);
      }
    });
  });
  // Las hojas auxiliares (ej. "jun jornada 30hs", "horas abril x vacaciones") repiten turnos del DETALLE: si hay DETALLE, mandan esas horas.
  if(out.horas.some(t=>/^detalle$/i.test(String(t._hoja).trim()))) out.horas = out.horas.filter(t=>/^detalle$/i.test(String(t._hoja).trim()));
  out.horas.forEach(t=>{ delete t._hoja; });
  out.proveedores = Object.values(provs);
  return out;
}
const ptTimers = {};
function savePTSoon(id){ clearTimeout(ptTimers[id]); ptTimers[id] = setTimeout(()=>{ const i=S.stockpt[id]; if(i) save('stockpt', i); }, 700); }
function nuevoPedido(extra){ return Object.assign({ clienteNombre:'', telefono:'', canal:'Pedido particular', entrega: today(), hora:'', estado:'pendiente', items:[], descuento:'', envio:'', pagos:[], notas:'', creado: today() }, extra||{}); }
function nuevoPresu(){ const n=neg(); return { numero: Math.max(num(n.proxPresupuesto), ...Object.values(S.presupuestos).map(p=>num(p.numero)+1), 1), clienteNombre:'', telefono:'', evento:'', invitados:'', fechaEvento:'', emision: today(), validoHasta: addDays(today(), num(n.validez)||15), estado:'enviado', items:[], descuento:'', obs:n.obsPresupuesto||'' }; }

const A = {
  cuentaSheet: () => openSheet('cuenta', {}),
  semNav: el => { U.semana = addDays(U.semana||lunesDe(today()), +el.dataset.n); render(); },
  semHoy: () => { U.semana = lunesDe(today()); render(); },
  fSem: el => { U.fSem = el.dataset.v; render(); },
  todoListo: async el => { const p=S.pedidos[el.dataset.id]; if(!p) return; const its=clone(p.items||[]); const pend=its.map((x,i)=>x.listo?-1:i).filter(i=>i>=0); its.forEach(x=>{ if(!x.listo){ x.listo=true; x.listoEn=new Date().toISOString(); } });
    if(SECTOR==='cocina'){ S.pedidos=Object.assign({},S.pedidos,{[p.id]:Object.assign({},p,{items:its,estado:'listo'})}); render(); for(const i of pend) await rpc('marcar_item_pedido',{p_id:p.id,p_idx:i,p_listo:true}); }
    else save('pedidos', Object.assign({},p,{items:its, estado:'listo'}));
    toast('Pedido de '+(p.clienteNombre||'')+' listo'); },
  pegarTexto: () => { SH.pegar = !SH.pegar; renderSheet(); setTimeout(()=>{ const t=document.getElementById('pegtxt'); if(t) t.focus(); },50); },
  aplicarTexto: () => { const t=document.getElementById('pegtxt'); SH.draft.mensaje = (t?t.value:'').trim(); SH.pegar=false; renderSheet(); setTimeout(()=>{ const q=document.getElementById('itq'); if(q) q.focus(); },50); },
  quitarMachete: () => { SH.draft.mensaje=''; renderSheet(); },
  masPed: () => { U.pedLim = (U.pedLim||120)+200; render(); },
  fEmp: el => { U.fEmp = el.dataset.v; render(); },
  verEmp: el => { const id=el.dataset.id; const e=S.empleados[id]; const x=cuentasEmp(U.mes).find(c=>c.id===id); openSheet('emp', e? clone(e) : {id, nombre: x?x.nombre:''}); },
  nuevoEmp: () => openSheet('emp', {id:'', nombre:'', activo:true}, {edit:true}),
  editEmpDatos: () => { SH.edit=true; renderSheet(); },
  saveEmp: () => { const d=SH.draft; if(!(d.nombre||'').trim()){ toast('Poné el nombre'); return; } d.nombre=d.nombre.trim(); d.activo = !(d.activo==='no'||d.activo===false); d.tarifa = d.tarifa===''?'':num(d.tarifa); if(!d.creado) d.creado=today(); d.id = d.id || empKey(d.nombre); save('empleados', d); SH.edit=false; SH.draft=clone(d); renderSheet(); toast('Empleado guardado'); },
  nuevoTurno: el => { const n=(el&&el.dataset&&el.dataset.emp)||''; const e=S.empleados[empKey(n)]; const ult = Object.values(S.horas).filter(h=>empKey(h.empleado)===empKey(n)).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''))[0];
    openSheet('turno', {empleado:n, fecha:today(), ingreso:'', egreso:'', tarifa:(e&&e.tarifa)||(ult&&ult.tarifa)||'', rubro:(e&&e.puesto)||(ult&&ult.rubro)||'', obs:''}, {volver: SH&&SH.type==='emp'?clone(SH.draft):null}); },
  editTurno: el => { const h=S.horas[el.dataset.id]; if(h) openSheet('turno', clone(h), {volver: SH&&SH.type==='emp'?clone(SH.draft):null}); },
  saveTurno: () => { const d=SH.draft; if(!(d.empleado||'').trim()){ toast('Elegí el empleado'); return; } d.empleado=d.empleado.trim();
    d.horas = horasTurno(d); if(!d.horas){ toast('Poné la hora de entrada y de salida'); return; } d.tarifa=num(d.tarifa); d.importe=Math.round(d.horas*d.tarifa); if(!d.creado) d.creado=today();
    const ek=empKey(d.empleado); if(!S.empleados[ek]) save('empleados', {id:ek, nombre:d.empleado, puesto:d.rubro||'', tarifa:d.tarifa, activo:true, creado:today()});
    save('horas', d); const v=SH.volver; closeSheet(); toast('Horas guardadas'); if(v) openSheet('emp', v); },
  nuevaNov: el => openSheet('nov', {empleado:(el&&el.dataset&&el.dataset.emp)||'', tipo:'Vacaciones', desde:today(), hasta:'', monto:'', nota:''}, {volver: SH&&SH.type==='emp'?clone(SH.draft):null}),
  editNov: el => { const n=S.novedades[el.dataset.id]; if(n) openSheet('nov', clone(n), {volver: SH&&SH.type==='emp'?clone(SH.draft):null}); },
  saveNov: () => { const d=SH.draft; if(!(d.empleado||'').trim()){ toast('Elegí el empleado'); return; } d.empleado=d.empleado.trim(); d.monto = d.monto===''?'':num(d.monto); save('novedades', d); const v=SH.volver; closeSheet(); toast('Novedad guardada'); if(v) openSheet('emp', v); },
  copyLiq: () => { const d=SH.draft; const x=cuentasEmp(U.mes).find(c=>c.id===d.id)||{horas:0,importe:0,desc:0};
    copy('Liquidación '+mesLabel(U.mes)+' · '+titulo(d.nombre)+'\nHoras: '+hhmm(x.horas)+'\nImporte: '+$(x.importe)+(x.desc?'\nAdelantos y consumos: −'+$(x.desc)+'\nA pagar: '+$(x.importe-x.desc):'')); },
  fProv: el => { U.fProv = el.dataset.v; render(); },
  verProv: el => { const id=el.dataset.id; const p=S.proveedores[id]; const x=cuentasProv().find(c=>c.id===id); openSheet('prov', p? clone(p) : {id, nombre: x?x.nombre:''}); },
  nuevoProv: () => openSheet('prov', {id:'', nombre:''}, {edit:true}),
  editProvDatos: () => { SH.edit=true; renderSheet(); },
  masMovs: () => { SH.lim=(SH.lim||40)+80; renderSheet(); },
  copyCBU: () => { const d=SH.draft; copy([d.razonSocial||d.nombre, d.cuit?'CUIT '+d.cuit:'', d.cbu?'CBU '+d.cbu:'', d.alias?'Alias '+d.alias:''].filter(Boolean).join('\n')); },
  saveProv: () => { const d=SH.draft; if(!(d.nombre||'').trim()){ toast('Poné el nombre'); return; } d.nombre=d.nombre.trim(); if(!d.creado) d.creado=today(); const id = d.id || ('pv-'+slug(d.nombre)); d.id=id; save('proveedores', d); SH.edit=false; SH.draft=clone(d); renderSheet(); toast('Proveedor guardado'); },
  nuevoMov: el => openSheet('mov', {tipo:(el&&el.dataset&&el.dataset.tipo)||'FACTURA', proveedor:(el&&el.dataset&&el.dataset.prov)||'', fecha:today(), numero:'', rubro:'', descripcion:'', neto:'', iva:'', percepciones:'', total:''}, {volver: SH&&SH.type==='prov' ? clone(SH.draft) : null}),
  editMov: el => { const m=S.movprov[el.dataset.id]; if(m) openSheet('mov', clone(m), {volver: SH&&SH.type==='prov' ? clone(SH.draft) : null}); },
  movTipo: el => { SH.draft.tipo = el.dataset.v; renderSheet(); },
  saveMov: () => { const d=SH.draft; if(!(d.proveedor||'').trim()){ toast('Elegí el proveedor'); return; }
    ['neto','iva','percepciones','total'].forEach(k=>{ d[k] = d[k]===''||d[k]==null ? '' : num(d[k]); });
    if(d.total==='' ) d.total = num(d.neto)+num(d.iva)+num(d.percepciones);
    if(!num(d.total)){ toast('Poné el importe'); return; }
    d.proveedor = d.proveedor.trim(); if(!d.creado) d.creado = today();
    const pk = 'pv-'+slug(d.proveedor); if(SECTOR==='todo' && !S.proveedores[pk]) save('proveedores', {id:pk, nombre:d.proveedor, rubro:d.rubro||'', creado:today()});
    save('movprov', d); const v = SH.volver; closeSheet(); toast(TIPO_LBL[d.tipo]+' guardado'+(d.tipo==='PAGO'?'':'')); if(v) openSheet('prov', v); },
  importarSheet: () => openSheet('importar', {}),
  leerPlanilla: async el => { const f = el.files && el.files[0]; if(!f) return; SH.draft = {archivo:f.name, leyendo:true}; renderSheet();
    if(!(await cargarXLSX())){ SH.draft={}; renderSheet(); toast('No se pudo preparar el lector de Excel. Revisá la conexión.'); return; }
    try{ const wb = XLSX.read(await f.arrayBuffer(), {type:'array', cellDates:true}); SH.draft = {archivo:f.name, res: leerLibro(wb)}; }
    catch(e){ console.warn(e); SH.draft={}; toast('No se pudo leer el archivo'); }
    renderSheet(); },
  importarYa: async () => { const r = SH.draft.res; const partes=[];
    const prog = (a,b) => { SH.draft.prog = a.toLocaleString('es-AR')+' de '+b.toLocaleString('es-AR'); renderSheet(); };
    if(r.proveedores.length){ const merged = r.proveedores.map(p => Object.assign({}, S.proveedores[p.id]||{}, p)); if(!(await saveMany('proveedores', merged, prog))) return; partes.push(r.proveedores.length+' proveedores'); }
    if(r.movprov.length){ const nuevosProv = {}; r.movprov.forEach(m=>{ const k='pv-'+provKey(m); if(!S.proveedores[k] && !nuevosProv[k]) nuevosProv[k]={id:k, nombre:m.proveedor, rubro:m.rubro||'', creado:today()}; });
      if(Object.keys(nuevosProv).length && !(await saveMany('proveedores', Object.values(nuevosProv)))) return;
      if(!(await saveMany('movprov', r.movprov, prog))) return; partes.push(r.movprov.length.toLocaleString('es-AR')+' comprobantes'); }
    if(r.clientes.length){ const nuevos = r.clientes.filter(c => !S.clientes[c.id] && !Object.values(S.clientes).some(x=>norm(x.nombre)===norm(c.nombre)));
      const mapa = {}; r.clientes.forEach(c => { const ex = Object.values(S.clientes).find(x=>norm(x.nombre)===norm(c.nombre)); if(ex) mapa[c.id]=ex.id; });
      r.pedidos.forEach(p => { if(mapa[p.clienteId]) p.clienteId = mapa[p.clienteId]; });
      if(nuevos.length && !(await saveMany('clientes', nuevos, prog))) return; }
    if(r.pedidos.length){ if(!(await saveMany('pedidos', r.pedidos, prog))) return; partes.push(r.pedidos.length.toLocaleString('es-AR')+' pedidos'); }
    // Una planilla de un año anterior no pisa la lista de precios mayorista actual.
    const ultMay = pedidosArr().filter(p=>p.canal==='Mayorista' && p.origen==='planilla' && !r.pedidos.some(x=>x.id===p.id)).reduce((a,p)=>p.entrega>a?p.entrega:a,'');
    if(r.listaMay.length && r.hasta && ultMay && r.hasta < ultMay){ partes.push('lista de precios no actualizada (la planilla es de un año anterior)'); r.listaMay = []; }
    if(r.listaMay.length){ const items = clone(catalogo()); const idx = {}; items.forEach(p=>{ idx[norm(p.nombre).trim()] = p; }); let nuevos=0;
      r.listaMay.forEach(l => { const p = idx[norm(l.nombre).trim()]; if(p) p.precioMay = l.precioMay; else { nuevos++; items.push({id:'pm'+hashTxt(l.nombre), nombre:l.nombre, cat:'Mayorista', precio:null, precioMay:l.precioMay}); } });
      await saveDoc('catalogo', {items}); partes.push(r.listaMay.length+' precios mayoristas'+(nuevos?' ('+nuevos+' productos nuevos)':'')); }
    if(r.empleados.length){ const merged = r.empleados.map(e => Object.assign({}, e, S.empleados[e.id]||{}, {cuil:e.cuil||(S.empleados[e.id]||{}).cuil})); if(!(await saveMany('empleados', merged, prog))) return; partes.push(r.empleados.length+' empleados'); }
    if(r.horas.length){
      // En las horas a veces el nombre está corto ("FIORELLA DARCHIVIO") y en la nómina completo ("FIORELLA CAROLINA D'ARCHIVIO"): se unen a la misma persona.
      const toks = n => norm(n).replace(/[^a-z\s]/g,'').split(/\s+/).filter(Boolean);
      const base = [...new Map([...r.empleados, ...Object.values(S.empleados)].map(e=>[e.id,e])).values()];
      const cache = {};
      const resolver = n => { if(cache[n]!==undefined) return cache[n]; const k=empKey(n); let id=k;
        if(!base.some(e=>e.id===k)){ const tk=toks(n); const cand = tk.length>=2 ? base.filter(e=>{ const et=toks(e.nombre); return tk.every(x=>et.includes(x)); }) : []; if(cand.length===1) id=cand[0]; }
        return cache[n]=id; };
      // Las horas se vinculan a la persona por el nombre: se usa el nombre de la nómina.
      r.horas.forEach(t=>{ const m = resolver(t.empleado); if(typeof m==='object'){ t.empleado = m.nombre; } t.empleadoId = empKey(t.empleado); });
      const nuevos={}; r.horas.forEach(t=>{ const k=t.empleadoId; if(!S.empleados[k] && !nuevos[k]) nuevos[k]={id:k, nombre:t.empleado, puesto:t.rubro, activo:true, origen:'planilla'}; });
      const recientes = {}; r.horas.forEach(t=>{ const k=t.empleadoId; if(!recientes[k]||t.fecha>recientes[k].fecha) recientes[k]=t; });
      Object.values(nuevos).forEach(e=>{ const t=recientes[e.id]; e.tarifa=t?t.tarifa:''; e.activo = !!(t && t.fecha >= addDays(today(),-60)); });
      if(Object.keys(nuevos).length && !(await saveMany('empleados', Object.values(nuevos)))) return;
      if(!(await saveMany('horas', r.horas, prog))) return; partes.push(r.horas.length.toLocaleString('es-AR')+' turnos');
      // La planilla manda: los turnos que vinieron de una importación anterior y ya no están en la planilla se borran (los cargados a mano no se tocan).
      const nuevosIds = new Set(r.horas.map(t=>t.id)); const viejos = Object.values(S.horas).filter(h=>h.origen==='planilla' && !nuevosIds.has(h.id)).map(h=>h.id);
      for(let i=0;i<viejos.length;i+=200){ const { error } = await sb.from('horas').delete().in('id', viejos.slice(i,i+200)); if(error){ onWriteError(error); return; } }
      if(viejos.length){ const n=Object.assign({},S.horas); viejos.forEach(id=>delete n[id]); S.horas=n; partes.push(viejos.length.toLocaleString('es-AR')+' turnos repetidos o viejos borrados'); } }
    if(r.gastos.length){ if(!(await saveMany('gastos', r.gastos, prog))) return; partes.push(r.gastos.length.toLocaleString('es-AR')+' gastos'); }
    SH.draft.prog=''; SH.draft.listo = 'Se guardaron '+partes.join(', ')+'.'; renderSheet(); },
  exportar: async () => {
    if(!window.XLSX){ toast('Preparando la copia…'); await new Promise((ok,ko)=>{ const sc=document.createElement('script'); sc.src='vendor/xlsx.full.min.js'; sc.onload=ok; sc.onerror=ko; document.head.appendChild(sc); }).catch(()=>{}); }
    if(!window.XLSX){ toast('No se pudo preparar el Excel. Revisá la conexión.'); return; }
    const wb = XLSX.utils.book_new();
    const plano = v => v==null ? '' : (typeof v==='object' ? JSON.stringify(v) : v);
    const hoja = (nombre, filas) => { const keys=[]; filas.forEach(f=>Object.keys(f).forEach(k=>{ if(!keys.includes(k)) keys.push(k); })); const ws = XLSX.utils.json_to_sheet(filas.map(f=>{ const o={}; keys.forEach(k=>o[k]=plano(f[k])); return o; }), {header:keys}); XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0,31)); };
    const NOMBRES = {pedidos:'Pedidos', presupuestos:'Presupuestos', gastos:'Gastos', clientes:'Clientes', recetas:'Recetas', insumos:'Insumos', stockpt:'Stock terminado', produccion:'Producción', proveedores:'Proveedores', movprov:'Comprobantes proveedores', empleados:'Empleados', horas:'Horas trabajadas', novedades:'Novedades empleados'};
    Object.keys(NOMBRES).forEach(c => hoja(NOMBRES[c], Object.values(S[c]||{})));
    const det = []; Object.values(S.pedidos).forEach(p => (p.items||[]).forEach(i => det.push({pedido:p.id, cliente:p.clienteNombre, entrega:p.entrega, producto:i.nombre, cantidad:i.cant, precio:i.precio, listo:i.listo?'sí':''})));
    hoja('Pedidos detalle', det);
    hoja('Lista de precios', catalogo());
    hoja('Datos del negocio', [neg()]);
    XLSX.writeFile(wb, 'Tatan copia '+today()+'.xlsx');
    toast('Copia descargada');
  },
  salir: async () => { closeSheet(); await sb.auth.signOut(); location.reload(); },
  setRol: async el => { const id=el.dataset.id; const rol=el.value; const { error } = await sb.from('perfiles').update({rol}).eq('id', id); if(error){ toast(/propio|al menos/.test(error.message||'') ? error.message : 'No se pudo cambiar el sector'); cargarEquipo(); return; } toast('Sector actualizado'); cargarEquipo(); },
  invitar: async () => {
    const nombre = (document.getElementById('inv-nombre').value||'').trim().slice(0,60);
    const email = (document.getElementById('inv-email').value||'').trim().toLowerCase();
    const rol = document.getElementById('inv-rol').value;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ toast('Revisá el mail'); return; }
    if((EQUIPO||[]).some(p=>(p.email||'')===email)){ toast('Esa persona ya tiene usuario. Cambiale el sector en la lista.'); return; }
    if(rol==='todo' && !confirm('¿Seguro? "Dueñas y administración" ve y puede cambiar TODO, incluidos costos, sueldos y usuarios.')) return;
    const { error } = await sb.from('invitaciones').upsert({ email, nombre, rol, usada:null });
    if(error){ onWriteError(error); return; }
    toast('Invitación lista. Ya puede crear su usuario con '+email); cargarEquipo();
  },
  quitarInv: async el => { const { error } = await sb.from('invitaciones').delete().eq('email', el.dataset.id); if(error){ onWriteError(error); return; } toast('Invitación quitada'); cargarEquipo(); },
  fHist: el => { HIST_F = el.dataset.id; HIST = null; render(); },
  restaurar: async el => {
    const h = (HIST||[]).find(x=>String(x.n)===el.dataset.id); if(!h || !h.antes) return;
    if(!confirm('¿Volver este registro a como estaba antes de este '+(h.accion==='borrado'?'borrado':'cambio')+'?')) return;
    const { error } = await sb.from(h.tabla).upsert({ id: h.antes.id, data: h.antes.data });
    if(error){ onWriteError(error); return; }
    toast('Recuperado'); if(fuentes()[h.tabla]) cargar(h.tabla); HIST = null; render();
  },
  salirTodos: async () => { if(!confirm('Se cierra tu sesión en todos los celulares, tablets y compus donde entraste. ¿Seguir?')) return; await sb.auth.signOut({ scope:'global' }); location.reload(); },
  fPT: el => { U.fPT = el.dataset.v; render(); },
  ptAdj: el => { const i=S.stockpt[el.dataset.id]; if(!i||readOnly) return; const n=Math.max(0, Math.round((num(i.stock)+num(el.dataset.d))*100)/100); S.stockpt=Object.assign({},S.stockpt,{[i.id]:Object.assign({},i,{stock:n, actualizado:today()})}); render(); savePTSoon(i.id); },
  editPT: el => { const i=S.stockpt[el.dataset.id]; if(i) openSheet('pt', clone(i)); },
  nuevoPT: () => openSheet('pt', {nombre:'', grupo:'', sector: SECTOR==='local'?'Local':'Cocina', stock:0, minimo:'', objetivo:'', nota:''}),
  savePT: () => { const d=SH.draft; if(!(d.nombre||'').trim()){ toast('Poné el nombre'); return; } d.stock=num(d.stock); d.minimo=num(d.minimo); d.objetivo=num(d.objetivo); d.actualizado=today(); save('stockpt', d); closeSheet(); toast('Guardado'); },
  armarProd: () => { const its=faltantesPT(); if(!its.length) toast('No hay faltantes: ningún producto llegó a su mínimo'); openSheet('orden', {fecha:today(), items:its, origen:'stock', nota:'', armadaPor:''}); },
  ordenManual: () => openSheet('orden', {fecha:today(), items:[], origen:'manual', nota:'', armadaPor:''}),
  editOrden: el => { const o=S.produccion[el.dataset.id]; if(o) openSheet('orden', clone(o)); },
  addOrdItem: el => { const i=S.stockpt[el.dataset.id]; if(!i) return; const meta = num(i.objetivo)>num(i.stock)? num(i.objetivo)-num(i.stock) : 1; SH.draft.items.push({stockId:i.id, nombre:i.nombre, cant:Math.ceil(meta), listo:false}); SH.q=''; renderSheet(); },
  addOrdFree: () => { SH.draft.items.push({stockId:'', nombre:SH.q.trim(), cant:1, listo:false}); SH.q=''; renderSheet(); },
  rmOrdItem: el => { SH.draft.items.splice(+el.dataset.i,1); renderSheet(); },
  saveOrden: () => { const d=SH.draft; if(!(d.items||[]).length){ toast('Agregá al menos un producto'); return; } d.items=d.items.map(x=>Object.assign({},x,{cant:num(x.cant)||1})); if(!d.creado) d.creado=new Date().toISOString(); const nuevo=!d.id; save('produccion', d); closeSheet(); toast(nuevo?'Orden enviada a cocina':'Orden guardada'); },
  archivarOrden: el => { const o=S.produccion[el.dataset.id]; if(o) save('produccion', Object.assign({},o,{archivada:true})); toast('Orden archivada'); },
  tglProd: el => { const o=S.produccion[el.dataset.id]; if(!o||readOnly) return; const its=clone(o.items||[]); const x=its[+el.dataset.i]; if(!x) return; x.listo=!x.listo; x.listoEn = x.listo? new Date().toISOString() : '';
    save('produccion', Object.assign({},o,{items:its}));
    if(x.stockId && S.stockpt[x.stockId]){ const s=S.stockpt[x.stockId]; save('stockpt', Object.assign({},s,{stock: Math.max(0, num(s.stock) + (x.listo?1:-1)*num(x.cant)), actualizado:today()})); } },
  tglPed: el => { const p=S.pedidos[el.dataset.id]; if(!p||readOnly) return; const its=clone(p.items||[]); const x=its[+el.dataset.i]; if(!x) return; x.listo=!x.listo;
    const l=its.filter(y=>y.listo).length; let estado=p.estado||'pendiente'; if(l===its.length) estado='listo'; else if(l>0) estado='produccion'; else if(estado==='listo'||estado==='produccion') estado='pendiente';
    if(SECTOR==='cocina'){ S.pedidos=Object.assign({},S.pedidos,{[p.id]:Object.assign({},p,{items:its,estado})}); render(); rpc('marcar_item_pedido',{p_id:p.id,p_idx:+el.dataset.i,p_listo:x.listo}); } else save('pedidos', Object.assign({},p,{items:its, estado})); if(estado==='listo' && p.estado!=='listo') toast('Pedido de '+(p.clienteNombre||'')+' listo'); },
  mes: el => { U.mes = mesShift(U.mes, +el.dataset.n); render(); },
  fPed: el => { U.fPed = el.dataset.v; U.pedLim = 120; render(); },
  costosTab: el => { U.costosTab = el.dataset.v; render(); },
  fInsCat: el => { U.fInsCat = el.dataset.v; render(); },
  close: () => closeSheet(),
  bgclose: (el, ev) => { if(ev.target===el) closeSheet(); },
  delAsk: () => { SH.confirmDel = true; renderSheet(); },
  delNo: () => { SH.confirmDel = false; renderSheet(); },
  delSi: () => { const map={emp:'empleados',turno:'horas',nov:'novedades',prov:'proveedores',mov:'movprov',pedido:'pedidos',presu:'presupuestos',gasto:'gastos',cliente:'clientes',receta:'recetas',insumo:'insumos',orden:'produccion',pt:'stockpt'}; const t=SH.type;
    if(t==='prod'){ const id=SH.draft.id; saveDoc('catalogo', {items: catalogo().filter(p=>p.id!==id)}); }
    else if(t==='receta'){ const id=SH.draft.id; if(catalogo().some(p=>p.recetaId===id)) saveDoc('catalogo',{items:catalogo().map(p=>p.recetaId===id?Object.assign({},p,{recetaId:'',factor:''}):p)}); remove('recetas', id); }
    else remove(map[t], SH.draft.id);
    closeSheet(); toast('Borrado'); },
  nuevoPedido: () => openSheet('pedido', nuevoPedido({canal:'WhatsApp'})),
  nuevoMay: () => openSheet('pedMay', nuevoPedido({canal:'Mayorista', remito:'', iva:false, entrega: today()})),
  pedTipo: el => { U.pedTipo = el.dataset.v; U.pedLim = 120; render(); },
  verCuentas: () => { U.fCli='Cuenta corriente'; U.q=''; location.hash='#clientes'; },
  fCli: el => { U.fCli = el.dataset.v; U.cliLim = 200; render(); },
  masCli: () => { U.cliLim = (U.cliLim||200)+300; render(); },
  cobrarCC: async () => { const d=SH.draft; let monto = num((document.getElementById('cc-monto')||{}).value); const medio=(document.getElementById('cc-medio')||{}).value||'Efectivo';
    if(!(monto>0)){ toast('Poné cuánto paga'); return; } const debe=saldoCliente(d.id); if(monto>debe+0.5){ toast('Paga más de lo que debe ('+$(debe)+'). Corregí el monto.'); return; }
    let resto = monto; const cambios = [];
    for(const p of pendientesCliente(d.id)){ if(resto<=0.5) break; const s=totPedido(p).saldo; const m=Math.min(s,resto); const np=clone(p); np.pagos=(np.pagos||[]).concat([{f:today(), monto:Math.round(m*100)/100, medio, cuenta:true}]); cambios.push(np); resto-=m; }
    for(const np of cambios) await save('pedidos', np);
    SH.ccMonto=null; renderSheet(); toast('Pago de '+$(monto)+' registrado'); },
  copiarCC: () => { const d=SH.draft; const n=neg(); const pend=pendientesCliente(d.id);
    copy([n.nombre+' · Resumen de cuenta', 'Cliente: '+d.nombre, '', ...pend.map(p=>'• '+fdateShort(p.entrega)+': '+(p.items||[]).map(l=>(num(l.cant)!==1?l.cant+'× ':'')+l.nombre).join(', ')+' — saldo '+$(totPedido(p).saldo)), '', 'Total a pagar: '+$(saldoCliente(d.id))].join('\n')); },
  pedDesc: el => { const v=num(el.dataset.v); SH.draft.descPct = v||''; if(v) SH.draft.descuento=''; renderSheet(); },
  tglCC: () => { SH.draft.cuentaCorriente = !SH.draft.cuentaCorriente; renderSheet(); },
  tglRetira: el => { SH.draft.retiraOtro = !SH.draft.retiraOtro; if(!SH.draft.retiraOtro) SH.draft.retiraNombre=''; renderSheet(); if(SH.draft.retiraOtro) setTimeout(()=>{ const x=document.getElementById('d-retiraNombre'); if(x) x.focus(); },30); },
  pedVista: el => { U.pedVista = el.dataset.v; render(); },
  nuevoFE: () => openSheet('pedido', nuevoPedido({canal:'Fecha especial'})),
  pedIva: el => { SH.draft.iva = el.dataset.v==='1'; renderSheet(); },
  ventaLocal: () => openSheet('pedido', nuevoPedido({canal:'Local', estado:'entregado', clienteNombre:'Mostrador'}), {venta:true}),
  entAsk: el => openSheet('entConf', {id: el.dataset.id}),
  entSi: async el => { const p=S.pedidos[el.dataset.id]; if(!p) return; closeSheet(); await save('pedidos', Object.assign({}, p, {estado:'entregado'})); toast('Pedido de '+(p.clienteNombre||'')+' marcado como entregado'); },
  editPedido: el => { const p=S.pedidos[el.dataset.id]; if(p) openSheet(p.canal==='Mayorista'?'pedMay':'pedido', clone(p)); },
  abrirPedido: el => { const p=S.pedidos[el.dataset.id]; if(p) openSheet(p.canal==='Mayorista'?'pedMay':'pedido', clone(p)); },
  dupPedido: () => { const d=clone(SH.draft); delete d.id; d.pagos=[]; d.estado='pendiente'; d.entrega=today(); delete d.origen; if(d.canal==='Mayorista'){ d.remito=''; d.factura=''; } openSheet(d.canal==='Mayorista'?'pedMay':'pedido', d); toast('Copia lista para editar'); },
  addItem: el => { const p=prodById(el.dataset.pid); if(!p) return; const it=SH.draft.items; const ex=it.find(l=>l.pid===p.id); const c=partirCant(SH.q).cant; if(ex) ex.cant=num(ex.cant)+c; else it.push({pid:p.id, nombre:p.nombre, cant:c, precio:(SH.draft.canal==='Mayorista' && p.precioMay) ? p.precioMay : (p.precio||0)}); SH.q=''; SH.sel=0; renderSheet(); const q=document.getElementById('itq'); if(q) q.focus(); },
  addFree: () => { const pc=partirCant(SH.q); SH.draft.items.push({pid:'', nombre:pc.q.trim(), cant:pc.cant, precio:0}); SH.q=''; SH.sel=0; renderSheet(); const q=document.getElementById('itq'); if(q) q.focus(); },
  rmItem: el => { SH.draft.items.splice(+el.dataset.i,1); renderSheet(); },
  addPago: el => { const d=SH.draft; const t=totPedido(d); const tipo=el.dataset.tipo; d.pagos=d.pagos||[];
    const monto = tipo==='sena' ? Math.round(t.aCobrar/2/100)*100 : tipo==='saldo' ? Math.max(0,Math.round(t.saldo)) : '';
    d.pagos.push({f:today(), monto, medio: d.canal==='Local'?'Efectivo':'Transferencia'}); renderSheet(); },
  rmPago: el => { SH.draft.pagos.splice(+el.dataset.i,1); renderSheet(); },
  copyPedido: () => copy(resumenPedido(SH.draft)),
  savePedido: async () => { const d=SH.draft; const esVenta=!!SH.venta;
    if(!(d.items||[]).length){ toast('Agregá al menos un producto'); return; }
    if(d.canal==='Mayorista' && !(d.clienteNombre||'').trim()){ toast('Elegí el cliente'); return; }
    if(d.canal==='Mayorista' && d.remito && pedidosArr().some(p=>p.id!==d.id && p.canal==='Mayorista' && String(p.remito)===String(d.remito).trim())){ const o=pedidosArr().find(p=>p.id!==d.id && p.canal==='Mayorista' && String(p.remito)===String(d.remito).trim()); toast('El remito N° '+d.remito+' ya está usado en un pedido de '+(o.clienteNombre||'otro cliente')); return; }
    if(SH.venta && !(d.pagos||[]).length){ d.pagos=[{f:d.entrega||today(), monto: totPedido(d).aCobrar, medio:'Efectivo'}]; }
    delete d._autoNom; if(d.clienteNombre && d.clienteNombre!=='Mostrador') d.clienteId = findOrCreateCliente(d);
    closeSheet(); await save('pedidos', d); toast(esVenta?'Venta registrada':'Pedido guardado'); },
  nuevoPresu: () => openSheet('presu', nuevoPresu()),
  editPresu: el => { const p=S.presupuestos[el.dataset.id]; if(p) openSheet('presu', clone(p)); },
  savePresu: async () => { const d=SH.draft; const isNew=!d.id; if(d.clienteNombre) d.clienteId=findOrCreateCliente(d); const id=await save('presupuestos', d); SH.draft.id=id;
    const n=neg(); if(isNew && num(d.numero)>=num(n.proxPresupuesto)) saveDoc('negocio', Object.assign({}, S.negocio, {proxPresupuesto:num(d.numero)+1}));
    closeSheet(); toast('Presupuesto guardado'); },
  verDoc: () => { SH.prev = 'presu'; SH.type='doc'; renderSheet(); },
  backPresu: () => { SH.type='presu'; renderSheet(); },
  copyPresu: () => copy(textoPresu(SH.draft)),
  jpgPresu: () => bajarPresuJPG(SH.draft),
  presuAPedido: async () => { const d=SH.draft; if(!(d.items||[]).length){ toast('El presupuesto no tiene productos'); return; }
    if(d.clienteNombre) d.clienteId=findOrCreateCliente(d);
    const pid = await save('pedidos', nuevoPedido({clienteNombre:d.clienteNombre, clienteId:d.clienteId||'', telefono:d.telefono, canal:'Evento', entrega:d.fechaEvento||today(), items:clone(d.items), descuento:d.descuento, descPct:d.descPct||'', envio:d.envio||'', pagos:clone(d.pagos||[]), mensaje:d.mensaje||'', notas:[d.evento, d.invitados?d.invitados+' invitados':'', 'Presupuesto N° '+pad(d.numero)].filter(Boolean).join(' · '), presupuestoId:d.id||''}));
    d.estado='aceptado'; d.pedidoId=pid; const id = await save('presupuestos', d);
    const n=neg(); if(num(d.numero)>=num(n.proxPresupuesto)) saveDoc('negocio', Object.assign({}, S.negocio, {proxPresupuesto:num(d.numero)+1}));
    openSheet('pedido', clone(S.pedidos[pid])); toast('Pasado a pedido. Cargá la seña.'); },
  nuevoGasto: () => openSheet('gasto', {concepto:'', monto:'', fecha: U.mes===today().slice(0,7)?today():U.mes+'-01', tipo:'variable', cat:'Insumos y proveedores'}),
  editGasto: el => { const g=S.gastos[el.dataset.id]; if(g) openSheet('gasto', clone(g)); },
  saveGasto: () => { const d=SH.draft; if(!num(d.monto)){ toast('Poné el monto'); return; } d.monto=num(d.monto); save('gastos', d); closeSheet(); toast('Gasto guardado'); },
  copiarFijos: async () => { const prev = Object.values(S.gastos).filter(g=>(g.fecha||'').startsWith(mesShift(U.mes,-1)) && g.tipo==='fijo');
    for(const g of prev){ const n=clone(g); delete n.id; n.fecha = U.mes + (g.fecha||'').slice(7); if(n.fecha.length<10) n.fecha=U.mes+'-01'; await save('gastos', n); }
    toast(prev.length+' gastos copiados'); },
  nuevoCliente: () => openSheet('cliente', {nombre:'', telefono:'', tipo:'Particular', notas:''}),
  verCliente: el => { const c=S.clientes[el.dataset.id]; if(c) openSheet('cliente', clone(c)); },
  saveCliente: () => { const d=SH.draft; if(!(d.nombre||'').trim()){ toast('Poné el nombre'); return; } save('clientes', d); closeSheet(); toast('Cliente guardado'); },
  pedidoParaCliente: () => { const c=SH.draft; if(c.tipo==='Mayorista'){ openSheet('pedMay', nuevoPedido({clienteNombre:c.nombre, clienteId:c.id, canal:'Mayorista', remito:'', iva:false})); return; } openSheet('pedido', nuevoPedido({clienteNombre:c.nombre, telefono:c.telefono||'', clienteId:c.id, canal: c.tipo==='Cuenta corriente'?'Cuenta corriente':'WhatsApp'})); },
  nuevaReceta: () => openSheet('receta', {nombre:'', rinde:'', unidadRinde:'unidades', minutos:'', extra:'', ingredientes:[], notas:''}),
  editReceta: el => { const r=S.recetas[el.dataset.id]; if(r) openSheet('receta', clone(r)); },
  addIng: el => { SH.draft.ingredientes = SH.draft.ingredientes||[]; SH.draft.ingredientes.push({insumoId:el.dataset.id, cant:''}); SH.q=''; renderSheet(); const i=SH.draft.ingredientes.length-1; const inp=document.getElementById('ing-'+i); if(inp) inp.focus(); },
  rmIng: el => { SH.draft.ingredientes.splice(+el.dataset.i,1); renderSheet(); },
  linkProd: el => { const id=el.dataset.id; saveDoc('catalogo', {items: catalogo().map(p=>p.id===id?Object.assign({},p,{recetaId:SH.draft.id, factor:p.factor||1}):p)}); SH.pq=''; renderSheet(); },
  unlinkProd: el => { const id=el.dataset.id; saveDoc('catalogo', {items: catalogo().map(p=>p.id===id?Object.assign({},p,{recetaId:'', factor:''}):p)}); renderSheet(); },
  saveReceta: async () => { const d=SH.draft; if(!(d.nombre||'').trim()){ toast('Poné el nombre'); return; } d.ingredientes=(d.ingredientes||[]).map(l=>({insumoId:l.insumoId, cant:num(l.cant)})); d.rinde=num(d.rinde)||1; d.minutos=num(d.minutos); d.extra=num(d.extra);
    const isNew=!d.id; const id = await save('recetas', d); if(isNew){ SH.draft.id=id; renderSheet(); toast('Receta guardada. Ahora podés vincularla a productos.'); } else { closeSheet(); toast('Receta guardada'); } },
  nuevoInsumo: () => openSheet('insumo', {nombre:'', precio:'', presentacion:'', unidad:'g', cat:'', nota:''}),
  editInsumo: el => { const i=S.insumos[el.dataset.id]; if(i) openSheet('insumo', clone(i), {orig:clone(i)}); },
  saveInsumo: () => { const d=SH.draft; if(!(d.nombre||'').trim()){ toast('Poné el nombre'); return; } d.precio=num(d.precio); d.presentacion=num(d.presentacion);
    if(SH.orig && SH.orig.precio && d.precio!==SH.orig.precio){ d.precioAnterior=SH.orig.precio; d.precioFecha=today(); } else if(!SH.orig && d.precio){ d.precioFecha=today(); }
    save('insumos', d); closeSheet(); toast('Insumo guardado'); },
  stockMov: el => { const i=S.insumos[el.dataset.id]; if(i) openSheet('stock', clone(i)); },
  mov: el => { const d=SH.draft; const f=d.unidad==='u'?1:1000; const q=num(document.getElementById('mov-q').value)*f; if(!q && el.dataset.t!=='set'){ toast('Poné una cantidad'); return; }
    const t=el.dataset.t; const prev=num(d.stock); const ns = t==='in'? prev+q : t==='out'? prev-q : q;
    const label = (t==='in'?'Entró ':t==='out'?'Salió ':'Stock fijado en ')+fmtCant(t==='set'?ns:q,d.unidad)+' · '+fdate(today());
    const body = Object.assign({}, S.insumos[d.id], {stock:Math.round(ns*1000)/1000, ultimoMov:label}); saveInsumoStock(body, {stock:body.stock, ultimoMov:label}); SH.draft=clone(body); renderSheet(); toast('Stock actualizado'); },
  saveMin: () => { const d=SH.draft; const f=d.unidad==='u'?1:1000; const m=num(document.getElementById('min-q').value)*f; saveInsumoStock(Object.assign({}, S.insumos[d.id], {minimo:m}), {minimo:m}); closeSheet(); toast('Mínimo guardado'); },
  editProd: el => { if(!verPlata()){ toast('Los precios los cambian las dueñas o administración'); return; } const p=prodById(el.dataset.id); if(p) openSheet('prod', clone(p)); },
  nuevoProd: () => openSheet('prod', {nombre:'', precio:'', cat: U.fCat||'Varios', recetaId:''}),
  saveProd: () => { const d=SH.draft; if(!(d.nombre||'').trim()){ toast('Poné el nombre'); return; } d.precio = d.precio===''||d.precio==null? null : num(d.precio); d.factor=num(d.factor)||1; d.packaging=num(d.packaging);
    let items = catalogo(); if(d.id) items = items.map(p=>p.id===d.id?d:p); else { d.id='p'+uid(); items = items.concat([d]); }
    saveDoc('catalogo', {items}); closeSheet(); toast('Producto guardado'); },
  ajustePrecios: () => openSheet('ajuste', {cat:U.fCat||'', pct:'', redondeo:100}),
  aplicarAjuste: () => { const d=SH.draft; const r=num(d.redondeo||1); let c=0;
    const items = catalogo().map(p=>{ if(!p.precio || (d.cat && p.cat!==d.cat)) return p; c++; return Object.assign({}, p, {precio: Math.round(p.precio*(1+num(d.pct)/100)/r)*r}); });
    saveDoc('catalogo', {items}); closeSheet(); toast(c+' precios actualizados'); },
  guardarAjustes: () => { const o = Object.assign({}, neg()); document.querySelectorAll('[data-neg]').forEach(el=>{ const k=el.dataset.neg; o[k] = ['costoHora','multiplicador','costoDefault','validez','proxPresupuesto'].includes(k)? num(el.value) : el.value; }); saveDoc('negocio', o); toast('Ajustes guardados'); }
};

/* ---------- eventos ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]'); if(!el) return;
  const f = A[el.dataset.act]; if(!f) return;
  if(el.dataset.act==='bgclose' && ev.target!==el) return;
  ev.preventDefault(); f(el, ev);
});
function setPath(o, path, v){ o[path]=v; }
document.addEventListener('input', ev => {
  const el = ev.target;
  if(el.dataset.bind){ U[el.dataset.bind] = el.value; render(); return; }
  if(!SH) return;
  const d = SH.draft;
  if(el.dataset.d==='telefono'){ d.telefono = el.value; const c = clientePorTel(el.value); if(c && SH.type!=='cliente'){ if(!d.clienteNombre || d._autoNom){ d.clienteNombre = c.nombre; d.clienteId = c.id; d._autoNom = true; } renderSheetSoft(); } return; }
  if(el.dataset.d==='clienteNombre'){ d._autoNom = false; if(esCC(d)) renderSheetSoft(); }
  if(el.dataset.d){ setPath(d, el.dataset.d, el.value); if(['descuento','envio','invitados','precio','presentacion','unidad','recetaId','factor','packaging','minutos','rinde','extra','pct','redondeo','cat','canal','ingreso','egreso','tarifa','neto','iva','percepciones'].includes(el.dataset.d) && el.tagName!=='TEXTAREA') renderSheetSoft(); return; }
  if(el.dataset.it!=null){ d.items[+el.dataset.it][el.dataset.k] = el.value; renderSheetSoft(); return; }
  if(el.dataset.pg!=null){ d.pagos[+el.dataset.pg][el.dataset.k] = el.value; renderSheetSoft(); return; }
  if(el.dataset.oi!=null){ d.items[+el.dataset.oi].cant = el.value; return; }
  if(el.dataset.ing!=null){ d.ingredientes[+el.dataset.ing].cant = el.value; renderSheetSoft(); return; }
  if(el.id==='cc-monto'){ SH.ccMonto = el.value; return; }
  if(el.dataset.sq){ SH.q = el.value; SH.sel = 0; if(el.id==='itq' && document.getElementById('itq-res')){ pintarResultados(); return; } renderSheet(); return; }
  if(el.dataset.pq){ SH.pq = el.value; renderSheet(); return; }
});
document.addEventListener('change', ev => { const el=ev.target; if(el.dataset && el.dataset.chg && A[el.dataset.chg]){ A[el.dataset.chg](el); return; } if(el.tagName==='SELECT'){ if(el.dataset.bind){ U[el.dataset.bind]=el.value; render(); } else if(SH && el.dataset.d){ SH.draft[el.dataset.d]=el.value; renderSheet(); } } });
let softT=null; function renderSheetSoft(){ clearTimeout(softT); softT=setTimeout(renderSheet, 450); }
document.addEventListener('keydown', ev => { if(ev.key==='Escape' && SH) closeSheet();
  if(SH && ev.target.id==='itq' && (ev.key==='ArrowDown'||ev.key==='ArrowUp')){ const n=document.querySelectorAll('#itq-res .results button').length; if(n){ ev.preventDefault(); SH.sel = ((SH.sel||0) + (ev.key==='ArrowDown'?1:-1) + n) % n; pintarResultados(); const on=document.querySelector('#itq-res .results button.on'); if(on) on.scrollIntoView({block:'nearest'}); } return; }
  if(ev.key==='Enter' && ev.target.dataset && ev.target.dataset.sq){ const b=document.querySelector('.results button.on') || document.querySelector('.results button'); if(b){ ev.preventDefault(); b.click(); } } });

route();
boot();
})();
