/* ==========================================================================
   HF2 · buscador de fondos (nov-2026). Un solo panel para las tres pestañas:
   repositorio (con filtros de la taxonomía vigente del catálogo) y, si lo
   buscado no está, Morningstar. Reutiliza repoPickerSelect / mstLoadSelectedToCtx.
   ========================================================================== */
(function(){
  "use strict";
  var CAT_URL = "__CAT_URL__", CAT_KEY = "__CAT_KEY__";
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]; }); }
  function norm(s){ return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function dES(d){ var x = String(d || "").slice(0, 10).split("-"); return x.length === 3 ? x[2] + "/" + x[1] + "/" + x[0] : ""; }
  var ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
  var BROKER_RE = /^(myinvestor|mundo asesoramiento|renta ?4|ironia|mapfre|ebn|openbank|inversis|allfunds)$/i;

  /* ---------------- taxonomía: catálogo (fuente de verdad) + ficha del repositorio como respaldo ---------------- */
  var TAX = { state: 0, by: {} };
  var TIPO = { rv: "Renta variable", rf: "Renta fija", mixtos: "Mixtos", mixto: "Mixtos", monetario: "Monetario", "materias primas": "Materias primas", alternativos: "Alternativos", alternativo: "Alternativos" };
  var GEO = { global: "Global", acwi: "Global (ACWI)", developed: "Desarrollados", emerging: "Emergentes", emergentes: "Emergentes", europa: "Europa", europe: "Europa", espana: "España", spain: "España",
              usa: "EE. UU.", "ee uu": "EE. UU.", pacifico: "Asia-Pacífico", asia: "Asia-Pacífico", nordics: "Nórdicos" };
  var PLAZO = { cort: "Corto", medi: "Medio", larg: "Largo" };
  var ORDER = { tipo: ["Renta variable", "Renta fija", "Mixtos", "Monetario", "Alternativos", "Materias primas", "Índices", "Carteras"], clas: ["Top", "Bueno", "Medio", "Malo"], plazo: ["Corto", "Medio", "Largo"] };
  function list(v){ if (Array.isArray(v)) return v.filter(Boolean).map(String); if (!v) return []; return String(v).split(/\s*[,;]\s*/).filter(Boolean); }
  function plazos(v){ var o = []; list(v).forEach(function(x){ var p = PLAZO[norm(x).slice(0, 4)]; if (p && o.indexOf(p) < 0) o.push(p); }); return o; }
  function loadTax(){
    if (TAX.state) return; TAX.state = 1;
    var H = { apikey: CAT_KEY, Authorization: "Bearer " + CAT_KEY };
    function all(path){
      var out = [];
      function page(off){ return fetch(CAT_URL + "/rest/v1/" + path + "&limit=1000&offset=" + off, { headers: H }).then(function(r){ if (!r.ok) throw new Error("catálogo " + r.status); return r.json(); })
        .then(function(a){ out = out.concat(a); return a.length === 1000 ? page(off + 1000) : out; }); }
      return page(0);
    }
    Promise.all([ all("funds?select=isin,fund_group_id,broker_disponible,distribucion,divisa,divisa_hedge_bool,clasificacion_user&order=isin"),
                  all("fund_groups?select=fund_group_id,gestora,tipo_activo,geografia,categoria_rf,plazo,srri,caracteristicas_especiales,clasificacion_user_default&order=fund_group_id") ])
      .then(function(r){
        var g = {}; r[1].forEach(function(x){ g[x.fund_group_id] = x; });
        r[0].forEach(function(f){
          var G = g[f.fund_group_id] || {};
          TAX.by[f.isin] = { tipo: TIPO[norm(String(G.tipo_activo || "").replace(/_/g, " "))] || "", geo: GEO[norm(G.geografia)] || (G.geografia || ""), rf: G.categoria_rf || "", plazo: plazos(G.plazo),
            srri: G.srri || null, car: list(G.caracteristicas_especiales), brokers: list(f.broker_disponible), dist: f.distribucion || "", gestora: G.gestora || "",
            clas: f.clasificacion_user || G.clasificacion_user_default || "", divisa: f.divisa ? String(f.divisa).toUpperCase() + (f.divisa_hedge_bool ? " cubierta" : "") : "" };
        });
        TAX.state = 2; P.rows = null; if (P.open) render();
      }).catch(function(e){ TAX.state = 3; console.warn("[buscador] sin taxonomía del catálogo; se usa la ficha del repositorio", e); if (P.open) render(); });
  }
  function fromMeta(isin, m){
    var o = { tipo: "", geo: "", rf: "", plazo: [], car: [], brokers: [], clas: "", divisa: "", gestora: m.gestora || "", dist: "" };
    var at = String(m.tipoActivo || m.assetType || ""), n = norm(at), cat = norm(m.categoria || m.category);
    if (/^IDX_/.test(isin) || cat === "indice") o.tipo = "Índices";
    else if (/^C-/.test(isin)) o.tipo = "Carteras";
    else if (cat === "monetario") o.tipo = "Monetario";
    else if (n.indexOf("rf") === 0){ o.tipo = "Renta fija"; if (/ cp$/.test(n)) o.plazo = ["Corto"]; else if (/ mp$/.test(n)) o.plazo = ["Medio"]; else if (/ lp$/.test(n)) o.plazo = ["Largo"];
      if (/hy/.test(n)) o.car.push("High Yield"); if (/catastrofe/.test(n)) o.car.push("ILS/Catástrofe"); if (/retorno absoluto/.test(n)) o.car.push("Retorno absoluto"); }
    else o.tipo = TIPO[n] || "";
    if (cat === "indexado" && o.car.indexOf("Indexado/ETF") < 0) o.car.push("Indexado/ETF");
    o.geo = GEO[norm(m.geografia || m.geography)] || "";
    if (ORDER.clas.indexOf(m.clasificacion) >= 0) o.clas = m.clasificacion;
    if (m.myinvestor) o.brokers.push("MyInvestor"); if (m.mundo_asesoramiento) o.brokers.push("Mapfre");
    var c = String(m.divisa || m.currency || ""); o.divisa = /^euro$/i.test(c) ? "EUR" : /^eurohedge$/i.test(c) ? "EUR cubierta" : /^dolares$/i.test(c) ? "USD" : (/^[A-Z]{3}$/.test(c) ? c : "");
    if (m.issuer && /gubernamental|corporativa/i.test(m.issuer)) o.rf = m.issuer;
    return o;
  }
  function titleCase(s){ if (s !== s.toUpperCase() || s.length < 8) return s;
    return s.toLowerCase().replace(/(^|[\s\-\/(])([a-záéíóúñ])([a-záéíóúñ]*)/g, function(m, a, b, c){ var w = b + c; return a + (w.length <= 2 && !/^(de|la|el|y|en)$/.test(w) ? w.toUpperCase() : b.toUpperCase() + c); })
      .replace(/\b(Fi|Sicav|Etf|Ucits|Eur|Usd|Ra|Acc|Inc|Us|Uk|Em)\b/g, function(m){ return m.toUpperCase(); }); }
  function buildRows(){
    var store = window.__fdStore || {}, lazy = (window.__fdLazy && window.__fdLazy()) || new Map(), rows = [];
    Object.keys(store).forEach(function(isin){
      var f = store[isin] || {}, m = f.meta || {}, lz = lazy.get(isin) || {}, n = (f.rows || []).length;
      var d0 = n ? String(f.rows[0].date).slice(0, 10) : (lz.d0 || ""), d1 = n ? String(f.rows[n - 1].date).slice(0, 10) : (lz.d1 || "");
      if (!d1) return;                                         // sin serie: no se puede analizar
      var t = TAX.by[isin], b = fromMeta(isin, m), o = t ? { tipo: t.tipo || b.tipo, geo: t.geo || b.geo, rf: t.rf || b.rf, plazo: t.plazo.length ? t.plazo : b.plazo, car: t.car.length ? t.car : b.car,
        brokers: t.brokers.length ? t.brokers : b.brokers, clas: t.clas || b.clas, divisa: t.divisa || b.divisa, gestora: t.gestora || b.gestora } : b;
      if (o.tipo !== "Renta fija"){ o.rf = ""; if (o.tipo !== "Monetario") o.plazo = []; }
      var name = titleCase(String(m.name || isin).replace(/,\s*FI$/i, ""));
      var cls = String(m.className || m.clase || "").split(" · ").filter(function(x){ return x && !BROKER_RE.test(x.trim()) && !/^(eur|usd|gbp|chf)( cubierta)?$/i.test(x.trim()); }).join(" · ");
      rows.push({ isin: isin, name: name, sub: [cls, o.divisa, o.gestora].filter(Boolean).join(" · "), d0: d0, d1: d1, hay: norm(name + " " + isin + " " + o.gestora + " " + cls),
        f: { tipo: o.tipo ? [o.tipo] : [], geo: o.geo ? [o.geo] : [], rf: o.rf ? [o.rf] : [], plazo: o.plazo, clas: o.clas ? [o.clas] : [], broker: o.brokers, divisa: o.divisa ? [o.divisa] : [], car: o.car },
        clas: o.clas, tipo: o.tipo, geo: o.geo });
    });
    return rows;
  }

  /* ---------------- estado y carga ---------------- */
  var GROUPS = [["tipo", "Tipo"], ["clas", "Clasificación"], ["geo", "Geografía"], ["rf", "Renta fija"], ["plazo", "Plazo"], ["broker", "Bróker"], ["divisa", "Divisa"], ["car", "Características"]];
  var P = { open: false, ctx: null, multi: false, q: "", sel: {}, picked: [], rows: null, act: 0, more: false, limit: 80, mst: [], mstQ: "", mstState: "", busy: false, vis: [] };
  function loadedIsins(kind){
    var o = {};
    try{
      if (kind === "cmp") for (var i = 0; i < 10; i++){ var inf = window.HF && HF.slotInfo && HF.slotInfo[i]; if (inf && inf.isin) o[inf.isin] = 1; var rp = window.CMP && CMP.repoFunds && CMP.repoFunds[i]; if (rp && rp.meta && rp.meta.isin) o[rp.meta.isin] = 1; }
      if (kind === "bt") (window.BT ? BT.funds : []).forEach(function(f){ if (f && f.meta && f.meta.isin) o[f.meta.isin] = 1; });
    }catch(_){ }
    return o;
  }
  function freeSlots(ctx){
    var out = [], i;
    if (ctx.kind === "cmp"){ for (i = 0; i < 10; i++) if (!(window.HF && HF.slotSource && HF.slotSource(i))) out.push(i); }
    else if (ctx.kind === "bt"){ var arr = ctx.isBench ? BT.benchFunds : BT.funds; for (i = 0; i < arr.length; i++) if (!arr[i]) out.push(i); }
    else out.push(0);
    if (ctx.slot != null && (ctx.fixed || out.indexOf(ctx.slot) >= 0)){ out = out.filter(function(x){ return x !== ctx.slot; }); out.unshift(ctx.slot); }
    return out;
  }
  function screenOf(kind){ return kind === "cmp" ? "screen2" : kind === "bt" ? "screen3" : "screen1"; }
  function setRepoCtx(ctx, slot){ var R = window.REPO_CTX || (typeof REPO_CTX !== "undefined" ? REPO_CTX : null); if (!R) throw new Error("selector no disponible");
    R.kind = ctx.kind; R.slot = slot; R.isBench = !!ctx.isBench; R.inputId = null; R.screenId = screenOf(ctx.kind); R.role = "fund"; }
  async function loadRepoFund(ctx, slot, isin){
    var fund = (window.DATAPACK && DATAPACK.funds || []).find(function(x){ return x.isin === isin || x.key === isin; });
    if (!fund) throw new Error("no está en el repositorio");
    if (ctx.kind === "cmp"){
      var p = await repoParsedForFund(fund, "screen2", "fund"); p.meta = p.meta || {}; p.meta.isin = isin;
      if (!CMP.repoFunds) CMP.repoFunds = Array(10).fill(null);
      CMP.repoFunds[slot] = p; var fi = $("cmpFile" + (slot + 1)); if (fi) fi.value = "";
      return;
    }
    setRepoCtx(ctx, slot); await repoPickerSelect(fund);
  }
  async function loadMstFund(ctx, slot, it){
    var M = window.MST; if (!M || typeof window.mstLoadSelectedToCtx !== "function") throw new Error("Morningstar no disponible");
    M.ctx = M.ctx || {}; M.ctx.kind = ctx.kind; M.ctx.slot = slot; M.ctx.isBench = !!ctx.isBench; M.ctx.screenId = screenOf(ctx.kind); M.ctx.role = "fund"; M.ctx.inputId = null;
    M.selected = { isin: it.isin, name: it.name, baseCurrency: it.cur || "", universe: "FO", item: { isin: it.isin, name: it.name } };
    var before = ctx.kind === "screen1" ? (window.STATE && STATE.sourceKey) : null;
    await window.mstLoadSelectedToCtx();
    var ok = ctx.kind === "cmp" ? !!(CMP.repoFunds && CMP.repoFunds[slot]) || !!(HF.slotSource && HF.slotSource(slot)) : ctx.kind === "bt" ? !!((ctx.isBench ? BT.benchFunds : BT.funds)[slot]) : (window.STATE && STATE.sourceKey !== before && String(STATE.sourceKey).indexOf(it.isin) >= 0);
    if (!ok) throw new Error("Morningstar no ha devuelto la serie");
    if (typeof window.__fdAddIsin === "function") window.__fdAddIsin(it.isin, it.name, it.cur).catch(function(e){ console.warn("[buscador] no se pudo guardar en el repositorio " + it.isin, e); });
  }
  async function commit(items){
    if (P.busy || !items.length) return;
    P.busy = true; status("Cargando " + (items.length > 1 ? items.length + " fondos…" : items[0].name + "…"));
    var ctx = P.ctx, slots = freeSlots(ctx), fails = [], done = 0;
    for (var k = 0; k < items.length; k++){
      var slot = slots[k]; if (slot === undefined){ fails.push(items[k].name + " (no quedan huecos)"); continue; }
      try{ if (items[k].src === "mst") await loadMstFund(ctx, slot, items[k]); else await loadRepoFund(ctx, slot, items[k].isin); done++; }
      catch(e){ fails.push(items[k].name + " (" + ((e && e.message) || "error") + ")"); }
    }
    try{ if (ctx.kind === "cmp" && typeof cmpHandleInputs === "function") await cmpHandleInputs(); }catch(e){ console.warn(e); }
    P.busy = false;
    if (fails.length){ status("No se ha podido cargar: " + fails.join("; "), true); P.picked = []; P.rows = null; render(); }
    else close();
    if (ctx.onDone) try{ ctx.onDone(done); }catch(_){ }
  }

  /* ---------------- interfaz ---------------- */
  function mount(){
    if ($("hf2Pick")) return;
    var ov = document.createElement("div"); ov.id = "hf2Pick"; ov.className = "hf2pk"; ov.hidden = true;
    ov.innerHTML = '<div class="hf2pk__box" role="dialog" aria-modal="true" aria-label="Buscar fondos">' +
      '<div class="hf2pk__top"><input id="hf2PkQ" type="search" autocomplete="off" spellcheck="false" placeholder="Nombre, gestora o ISIN"><button type="button" id="hf2PkX" aria-label="Cerrar">×</button></div>' +
      '<div class="hf2pk__filters" id="hf2PkF"></div>' +
      '<div class="hf2pk__list" id="hf2PkL" tabindex="-1"></div>' +
      '<div class="hf2pk__foot"><span id="hf2PkS"></span><button type="button" class="hf2add" id="hf2PkGo"></button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("mousedown", function(e){ if (e.target === ov) close(); });
    $("hf2PkX").addEventListener("click", close);
    $("hf2PkGo").addEventListener("click", function(){ commit(P.picked.slice()); });
    var q = $("hf2PkQ");
    q.addEventListener("input", function(){ P.q = q.value; P.act = 0; P.limit = 80; render(); mstSoon(); });
    document.addEventListener("keydown", function(e){
      if (!P.open) return;
      if (e.key === "Escape"){ e.preventDefault(); close(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp"){ e.preventDefault(); P.act = Math.max(0, Math.min(P.vis.length - 1, P.act + (e.key === "ArrowDown" ? 1 : -1))); paintActive(true); return; }
      if (e.key === "Enter"){ e.preventDefault(); if ((e.ctrlKey || e.metaKey) && P.picked.length){ commit(P.picked.slice()); return; } var it = P.vis[P.act]; if (it) choose(it); }
    });
  }
  function status(t, bad){ var s = $("hf2PkS"); if (s){ s.textContent = t || ""; s.className = bad ? "bad" : ""; } }
  function close(){ var ov = $("hf2Pick"); if (ov) ov.hidden = true; P.open = false; document.body.classList.remove("hf2pk-open"); }
  function open(ctx){
    mount(); loadTax();
    if (!(window.DATAPACK && DATAPACK.loaded) && !(window.__fdStore && Object.keys(window.__fdStore).length)){ /* aún sin índice: se abre igual, Morningstar funciona */ }
    P.ctx = Object.assign({}, ctx); P.multi = (ctx.kind === "cmp" || ctx.kind === "bt") && !ctx.fixed && !ctx.isBench;
    P.open = true; P.q = ""; P.sel = {}; P.picked = []; P.act = 0; P.limit = 80; P.mst = []; P.mstQ = ""; P.mstState = ""; P.rows = null; P.busy = false;
    var ov = $("hf2Pick"); ov.hidden = false; document.body.classList.add("hf2pk-open");
    $("hf2PkQ").value = ""; status(""); render(); setTimeout(function(){ try{ $("hf2PkQ").focus(); }catch(_){ } }, 30);
  }
  function passes(r, skip){
    for (var i = 0; i < GROUPS.length; i++){ var g = GROUPS[i][0]; if (g === skip) continue; var s = P.sel[g]; if (!s || !s.length) continue; var ok = false; for (var k = 0; k < s.length; k++) if (r.f[g].indexOf(s[k]) >= 0){ ok = true; break; } if (!ok) return false; }
    return true;
  }
  function choose(it){
    if (P.busy || it.loaded) return;
    if (!P.multi){ commit([it]); return; }
    var k = P.picked.findIndex(function(x){ return x.isin === it.isin; });
    if (k >= 0) P.picked.splice(k, 1); else { if (P.picked.length >= freeSlots(P.ctx).length){ status("No quedan huecos libres: quita algún fondo antes.", true); return; } P.picked.push(it); status(""); }
    render(true);
  }
  function paintActive(scroll){
    var L = $("hf2PkL"); if (!L) return;
    Array.prototype.forEach.call(L.querySelectorAll(".row"), function(e){ var on = Number(e.dataset.i) === P.act; e.classList.toggle("act", on); if (on && scroll) e.scrollIntoView({ block: "nearest" }); });
  }
  function rowHtml(it, i){
    var picked = P.picked.some(function(x){ return x.isin === it.isin; });
    var badge = it.clas ? '<em class="cl cl-' + norm(it.clas) + '">' + esc(it.clas) + "</em>" : "";
    var tags = [it.tipo, it.geo].filter(Boolean).join(" · ");
    var right = it.src === "mst" ? '<span class="ms">Morningstar</span>' : (it.loaded ? '<span class="ld">Ya añadido</span>' : '<span class="dt">desde ' + esc(String(it.d0).slice(0, 4)) + " · dato " + esc(dES(it.d1).slice(0, 5)) + "</span>");
    return '<div class="row' + (picked ? " on" : "") + (it.loaded ? " dis" : "") + '" data-i="' + i + '" role="option" aria-selected="' + (picked ? "true" : "false") + '">' +
      (P.multi ? '<i class="ck" aria-hidden="true"></i>' : "") + '<div class="nm"><b>' + esc(it.name) + "</b>" + badge + "<small>" + esc([it.sub, it.isin].filter(Boolean).join(" · ")) + "</small></div>" +
      '<div class="tg">' + esc(tags) + "</div>" + right + "</div>";
  }
  function render(keepScroll){
    if (!P.open) return;
    if (!P.rows) P.rows = buildRows();
    var q = norm(P.q), toks = q ? q.split(" ") : [], loaded = loadedIsins(P.ctx.kind);
    var base = P.rows.filter(function(r){ for (var i = 0; i < toks.length; i++) if (r.hay.indexOf(toks[i]) < 0) return false; return true; });
    /* filtros con contador (cada grupo cuenta con los demás filtros aplicados) */
    var F = $("hf2PkF"), fh = "", anySel = false, shown = 0;
    GROUPS.forEach(function(g, gi){
      var key = g[0], cnt = {}, sel = P.sel[key] || [];
      base.forEach(function(r){ if (!passes(r, key)) return; r.f[key].forEach(function(v){ cnt[v] = (cnt[v] || 0) + 1; }); });
      sel.forEach(function(v){ if (!(v in cnt)) cnt[v] = 0; });
      var vals = Object.keys(cnt); if (!vals.length) return;
      if (key === "rf" || key === "plazo"){ var ts = P.sel.tipo || []; if (!sel.length && !(ts.indexOf("Renta fija") >= 0 || (key === "plazo" && ts.indexOf("Monetario") >= 0))) return; }
      var ord = ORDER[key]; vals.sort(function(a, b){ if (ord){ var x = ord.indexOf(a), y = ord.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); } return cnt[b] - cnt[a] || a.localeCompare(b); });
      if (sel.length) anySel = true;
      var extra = gi >= 3 && !(key === "rf" || key === "plazo"); if (extra && !P.more && !sel.length) return;
      if (!ord && vals.length > 9 && !P["all_" + key]){ var keep = vals.filter(function(v, i){ return i < 8 || sel.indexOf(v) >= 0; }); vals = keep.concat(["+"]); }
      shown++;
      fh += '<div class="grp"><span>' + g[1] + "</span>" + vals.map(function(v){
        if (v === "+") return '<button type="button" class="chip more" data-g="' + key + '" data-v="+">más…</button>';
        return '<button type="button" class="chip' + (sel.indexOf(v) >= 0 ? " on" : "") + '" data-g="' + key + '" data-v="' + esc(v) + '">' + esc(v) + "<u>" + cnt[v] + "</u></button>"; }).join("") + "</div>";
    });
    fh += '<div class="grp end"><button type="button" class="lnk" id="hf2PkMore">' + (P.more ? "Menos filtros" : "Más filtros") + "</button>" + (anySel ? '<button type="button" class="lnk" id="hf2PkClr">Limpiar filtros</button>' : "") +
      (TAX.state === 1 ? '<span class="ld">Cargando categorías…</span>' : "") + "</div>";
    F.innerHTML = fh;
    Array.prototype.forEach.call(F.querySelectorAll(".chip"), function(b){ b.addEventListener("click", function(){
      var g = b.dataset.g, v = b.dataset.v; if (v === "+"){ P["all_" + g] = true; render(); return; }
      var s = P.sel[g] || (P.sel[g] = []), k = s.indexOf(v); if (k >= 0) s.splice(k, 1); else s.push(v); P.act = 0; P.limit = 80; render(); }); });
    $("hf2PkMore").addEventListener("click", function(){ P.more = !P.more; render(); });
    var clr = $("hf2PkClr"); if (clr) clr.addEventListener("click", function(){ P.sel = {}; P.act = 0; render(); });
    /* resultados */
    var res = base.filter(function(r){ return passes(r, null); });
    var rank = { Top: 0, Bueno: 1, Medio: 2, "": 3, Malo: 4 };
    res.sort(function(a, b){
      if (toks.length){ var sa = norm(a.name).indexOf(toks[0]) === 0 ? 0 : 1, sb = norm(b.name).indexOf(toks[0]) === 0 ? 0 : 1; if (sa !== sb) return sa - sb; }
      var ra = rank[a.clas] === undefined ? 3 : rank[a.clas], rb = rank[b.clas] === undefined ? 3 : rank[b.clas]; return ra - rb || a.name.localeCompare(b.name); });
    var vis = res.slice(0, P.limit).map(function(r){ return { src: "repo", isin: r.isin, name: r.name, sub: r.sub, clas: r.clas, tipo: r.tipo, geo: r.geo, d0: r.d0, d1: r.d1, loaded: !!loaded[r.isin] }; });
    var L = $("hf2PkL"), top = L.scrollTop, html = "";
    if (vis.length) html += '<div class="sec">Repositorio <span>' + res.length + (res.length === 1 ? " fondo" : " fondos") + "</span></div>" + vis.map(rowHtml).join("") +
      (res.length > vis.length ? '<button type="button" class="lnk morerows" id="hf2PkAll">Ver ' + Math.min(200, res.length - vis.length) + " más</button>" : "");
    else if (!q && !anySel) html += '<div class="none">' + (P.rows.length ? "" : "Cargando el repositorio…") + "</div>";
    else html += '<div class="none">No hay fondos del repositorio con esa búsqueda.' + (anySel ? " Prueba a limpiar los filtros." : "") + "</div>";
    var inRepo = {}; P.rows.forEach(function(r){ inRepo[r.isin] = 1; });
    var ms = (P.mstQ === P.q ? P.mst : []).filter(function(x){ return !inRepo[x.isin]; });
    if (q.length >= 3){
      html += '<div class="sec">En Morningstar <span>' + (P.mstState === "busy" || P.mstQ !== P.q ? "buscando…" : P.mstState === "err" ? "no disponible ahora" : ms.length ? "fuera del repositorio" : "sin más resultados") + "</span></div>";
      var off = vis.length; ms.forEach(function(x, k){ html += rowHtml(x, off + k); }); vis = vis.concat(ms);
    }
    L.innerHTML = html; P.vis = vis; if (P.act >= vis.length) P.act = Math.max(0, vis.length - 1);
    if (keepScroll) L.scrollTop = top;
    Array.prototype.forEach.call(L.querySelectorAll(".row"), function(e){ e.addEventListener("click", function(){ P.act = Number(e.dataset.i); choose(P.vis[P.act]); }); });
    var all = $("hf2PkAll"); if (all) all.addEventListener("click", function(){ P.limit += 200; render(true); });
    paintActive(false);
    var go = $("hf2PkGo"), n = P.picked.length;
    go.style.display = P.multi ? "" : "none"; go.disabled = !n || P.busy; go.textContent = n ? "Añadir " + n + (n === 1 ? " fondo" : " fondos") : "Añadir";
    if (!P.busy && !$("hf2PkS").className) status(P.multi ? (n ? n + (n === 1 ? " seleccionado" : " seleccionados") + " · Ctrl+Enter para añadir" : "Marca uno o varios fondos") : "Enter o clic para cargar");
  }
  var mstT = null;
  function mstSoon(){
    clearTimeout(mstT); var q = P.q.trim(); if (norm(q).length < 3){ P.mst = []; P.mstQ = P.q; P.mstState = ""; return; }
    P.mstState = "busy";
    mstT = setTimeout(function(){
      var asked = P.q; if (typeof window.mstSearch !== "function"){ P.mstState = "err"; P.mstQ = asked; render(true); return; }
      Promise.race([window.mstSearch(q, 12), new Promise(function(_, rej){ setTimeout(function(){ rej(new Error("tiempo agotado")); }, 15000); })]).then(function(items){
        if (P.q !== asked) return;
        P.mst = (items || []).map(function(it){ var isin = String(it.isin || (it.fields && it.fields.isin && it.fields.isin.value) || "").toUpperCase(); var nm = it.name || (it.fields && it.fields.name && it.fields.name.value) || isin;
          var cur = (it.fields && it.fields.baseCurrency && (it.fields.baseCurrency.value || it.fields.baseCurrency)) || it.baseCurrency || ""; return { src: "mst", isin: isin, name: titleCase(String(nm)), sub: typeof cur === "string" ? cur : "", cur: typeof cur === "string" ? cur : "", clas: "", tipo: "", geo: "" }; })
          .filter(function(x){ return ISIN_RE.test(x.isin); }).slice(0, 12);
        P.mstQ = asked; P.mstState = "ok"; render(true);
      }).catch(function(e){ if (P.q !== asked) return; console.warn("[buscador] Morningstar", e); P.mst = []; P.mstQ = asked; P.mstState = "err"; render(true); });
    }, 280);
  }

  window.HF2P = { open: open, close: close, state: P, tax: TAX };
  /* cualquier «Elegir fondo» o «Morningstar» de la aplicación abre este buscador */
  function hook(){
    try{ window.repoPickerOpen = function(ctx){ open(Object.assign({ fixed: ctx && ctx.slot != null }, ctx || { kind: "screen1" })); }; }catch(_){ }
    try{ window.mstPickerOpen = function(ctx){ open(Object.assign({ fixed: ctx && ctx.slot != null }, ctx || { kind: "screen1" })); }; }catch(_){ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook); else hook();
  setTimeout(hook, 1500);
})();
