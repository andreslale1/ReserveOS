/*! ReserveOS widget · horario, paquetes y reservas dentro de cualquier web.
 *  Uso:  <script src="https://reserveos.app/widget.js" data-estudio="tu-gimnasio" async></script>
 *  Opciones (atributos data-*):
 *    data-modo="inline"  (por defecto) se dibuja donde está el script, o dentro de data-destino="#id"
 *    data-modo="boton"   botón flotante «Reservar» que abre el horario en un panel
 *    data-color="#2f5d8c"  color de acento (por defecto, el del estudio)
 *    data-texto="Reservar clase"  texto del botón flotante
 *  El horario es público y de solo lectura. Reservar y registrarse abre ReserveOS en una ventana propia,
 *  así la cuenta del cliente queda en la base de datos del gimnasio. */
(function () {
  var script = document.currentScript || document.querySelector('script[data-estudio]');
  if (!script) return;
  var slug = script.getAttribute('data-estudio');
  if (!slug) return console.error('[ReserveOS] Falta data-estudio');
  var origin = new URL(script.src).origin;
  var modo = script.getAttribute('data-modo') || 'inline';
  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var ORDEN = [1, 2, 3, 4, 5, 6, 0];

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) { if (k === 'class') n.className = attrs[k]; else if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function lum(h) { var c = [1, 3, 5].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  // El texto del botón es blanco: si el color del estudio es muy claro se oscurece hasta que se lea.
  function hex(c, d) {
    var h = /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : d;
    for (var i = 0; i < 14 && lum(h) > 0.22; i++) { h = '#' + [1, 3, 5].map(function (k) { return ('0' + Math.round(parseInt(h.substr(k, 2), 16) * 0.88).toString(16)).slice(-2); }).join(''); }
    return h;
  }

  var CSS = ':host{all:initial;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}*{box-sizing:border-box}'
    + '.w{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1b2530;background:#fff;border:1px solid #dcdfe3;border-radius:14px;overflow:hidden;max-width:720px;width:100%}'
    + '.h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #dcdfe3;flex-wrap:wrap}'
    + '.h b{font-size:16px}.h img{height:28px;width:auto}'
    + '.tabs{display:flex;gap:4px;overflow-x:auto;padding:10px 12px;border-bottom:1px solid #dcdfe3;background:#f5f4f1}'
    + '.tab{appearance:none;border:0;background:transparent;font:inherit;font-size:13px;font-weight:500;color:#5b6673;padding:7px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;transition:background-color .15s,color .15s}'
    + '.tab[aria-selected=true]{background:#fff;color:#1b2530;box-shadow:0 1px 2px rgba(27,37,48,.12)}'
    + '.tab:focus-visible,.btn:focus-visible{outline:2px solid var(--a);outline-offset:2px}'
    + 'ul{list-style:none;margin:0;padding:0}li{display:flex;align-items:center;gap:14px;padding:13px 18px;border-bottom:1px solid #eceef0}li:last-child{border-bottom:0}'
    + '.t{width:52px;font-weight:600;font-variant-numeric:tabular-nums}.i{flex:1;min-width:0}.i b{display:block;font-size:14px;font-weight:600}.i span{font-size:12px;color:#5b6673}'
    + '.btn{appearance:none;border:0;font:inherit;font-size:13px;font-weight:600;background:var(--a);color:#fff;padding:8px 14px;border-radius:8px;cursor:pointer;text-decoration:none;display:inline-block;transition:transform .16s cubic-bezier(.23,1,.32,1),filter .15s}'
    + '.btn:hover{filter:brightness(.92)}.btn:active{transform:scale(.97)}.btn.s{background:#fff;color:#1b2530;border:1px solid #dcdfe3}'
    + '.vacio{padding:28px 18px;color:#5b6673;font-size:14px;text-align:center}'
    + '.pk{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #eceef0}.pk b{font-size:14px}.pk span{display:block;font-size:12px;color:#5b6673}.pk em{font-style:normal;font-weight:600;font-size:16px}'
    + '.f{padding:10px 18px;font-size:11px;color:#8a929c;text-align:right;background:#fafaf9}.f a{color:inherit}'
    + '.fab{position:fixed;right:20px;bottom:20px;z-index:2147483000}.fab .btn{padding:13px 20px;border-radius:999px;font-size:14px;box-shadow:0 10px 24px -8px rgba(27,37,48,.5)}'
    + '.ov{position:fixed;inset:0;z-index:2147483001;background:rgba(27,37,48,.45);display:flex;align-items:flex-end;justify-content:center;padding:0;animation:fi .2s ease both}'
    + '.pn{max-height:88vh;overflow:auto;width:100%;max-width:720px;border-radius:16px 16px 0 0;animation:up .28s cubic-bezier(.23,1,.32,1) both}'
    + '@media(min-width:760px){.ov{align-items:center;padding:24px}.pn{border-radius:16px}}'
    + '@keyframes fi{from{opacity:0}to{opacity:1}}@keyframes up{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}'
    + '@media(prefers-reduced-motion:reduce){.ov,.pn{animation:none}.btn{transition:none}}';

  function abrir(ruta) {
    var w = window.open(origin + ruta, 'reserveos', 'width=480,height=760');
    if (!w) window.location.href = origin + ruta;
  }

  function construir(d) {
    var acento = hex(script.getAttribute('data-color'), hex(d.color, '#2f5d8c'));
    var sedes = d.sedes || [], clases = d.clases || [], paquetes = d.paquetes || [];
    var sedeId = sedes.length ? sedes[0].id : null;
    var dia = null;
    var vista = 'horario';
    var raiz = el('div', { class: 'w', style: '--a:' + acento });
    var cuerpo = el('div');

    function pintar() {
      cuerpo.innerHTML = '';
      if (vista === 'paquetes') {
        if (!paquetes.length) cuerpo.appendChild(el('p', { class: 'vacio', text: 'Aún no hay paquetes publicados.' }));
        paquetes.forEach(function (p) {
          var b = el('button', { class: 'btn', text: 'Comprar' });
          b.onclick = function () { abrir('/registro/' + slug + '?next=' + encodeURIComponent('/cuenta/paquetes')); };
          cuerpo.appendChild(el('div', { class: 'pk' }, [
            el('div', {}, [el('b', { text: p.nombre }), el('span', { text: (p.num_clases ? p.num_clases + ' clases' : 'Ilimitado') + ' · ' + p.vigencia_dias + ' días' })]),
            el('em', { text: 'Q' + Number(p.precio).toLocaleString('es-GT') }), b]));
        });
        return;
      }
      var delaSede = clases.filter(function (c) { return !sedeId || c.sede_id === sedeId; });
      var dias = ORDEN.filter(function (n) { return delaSede.some(function (c) { return c.dia === n; }); });
      if (dia === null || dias.indexOf(dia) < 0) dia = dias[0] === undefined ? null : dias[0];
      var tabsDia = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Día' });
      dias.forEach(function (n) {
        var t = el('button', { class: 'tab', role: 'tab', 'aria-selected': String(n === dia), text: DIAS[n] });
        t.onclick = function () { dia = n; pintar(); };
        tabsDia.appendChild(t);
      });
      if (dias.length) cuerpo.appendChild(tabsDia);
      var lista = el('ul');
      var delDia = delaSede.filter(function (c) { return c.dia === dia; }).sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
      if (!delDia.length) cuerpo.appendChild(el('p', { class: 'vacio', text: 'No hay clases publicadas para esta sede.' }));
      delDia.forEach(function (c) {
        var b = el('button', { class: 'btn', text: 'Reservar' });
        b.onclick = function () { abrir('/registro/' + slug + '?next=' + encodeURIComponent('/cuenta/clases')); };
        lista.appendChild(el('li', {}, [
          el('span', { class: 't', text: String(c.inicio).slice(0, 5) }),
          el('span', { class: 'i' }, [el('b', { text: c.nombre }), el('span', { text: (c.instructora ? c.instructora + ' · ' : '') + 'cupo ' + c.cupo })]), b]));
      });
      cuerpo.appendChild(lista);
    }

    var cab = el('div', { class: 'h' }, [d.logo && /^https:\/\//.test(d.logo) ? el('img', { src: d.logo, alt: d.nombre }) : el('b', { text: d.nombre })]);
    var vistas = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Sección' });
    [['horario', 'Horario'], ['paquetes', 'Paquetes']].forEach(function (v) {
      var t = el('button', { class: 'tab', role: 'tab', 'aria-selected': String(v[0] === vista), text: v[1] });
      t.onclick = function () { vista = v[0]; Array.prototype.forEach.call(vistas.children, function (x) { x.setAttribute('aria-selected', String(x === t)); }); pintar(); };
      vistas.appendChild(t);
    });
    if (sedes.length > 1) {
      var sel = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Sede' });
      sedes.forEach(function (s) {
        var t = el('button', { class: 'tab', role: 'tab', 'aria-selected': String(s.id === sedeId), text: s.nombre });
        t.onclick = function () { sedeId = s.id; Array.prototype.forEach.call(sel.children, function (x) { x.setAttribute('aria-selected', String(x === t)); }); pintar(); };
        sel.appendChild(t);
      });
      raiz.append(cab, sel, vistas, cuerpo);
    } else raiz.append(cab, vistas, cuerpo);
    raiz.appendChild(el('div', { class: 'f' }, [el('a', { href: 'https://reserveos.app', target: '_blank', rel: 'noopener', text: 'Reservas con ReserveOS' })]));
    pintar();
    return raiz;
  }

  function montar(d) {
    var host = document.createElement('div');
    var shadow = host.attachShadow({ mode: 'open' });
    shadow.appendChild(el('style', { text: CSS }));
    if (modo === 'boton') {
      var acento = hex(script.getAttribute('data-color'), hex(d.color, '#2f5d8c'));
      var fab = el('div', { class: 'fab', style: '--a:' + acento });
      var b = el('button', { class: 'btn', text: script.getAttribute('data-texto') || 'Reservar clase' });
      b.onclick = function () {
        var ov = el('div', { class: 'ov', style: '--a:' + acento, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Reservar en ' + d.nombre });
        var pn = el('div', { class: 'pn' }, [construir(d)]);
        ov.appendChild(pn);
        ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
        var cerrar = function (e) { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', cerrar); } };
        document.addEventListener('keydown', cerrar);
        shadow.appendChild(ov);
      };
      fab.appendChild(b); shadow.appendChild(fab);
      document.body.appendChild(host);
    } else {
      shadow.appendChild(construir(d));
      var dest = script.getAttribute('data-destino');
      var t = dest && document.querySelector(dest);
      if (t) t.appendChild(host); else script.parentNode.insertBefore(host, script);
    }
  }

  fetch(origin + '/api/publico/' + encodeURIComponent(slug)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(montar)
    .catch(function (e) { console.error('[ReserveOS] No se pudo cargar el estudio «' + slug + '»', e); });
})();
