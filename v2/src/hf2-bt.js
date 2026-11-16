/* ==========================================================================
   HF2 · Backtest de cartera con el mismo lenguaje que Comparación: barra de
   control (fondos con su peso), resumen de la cartera y gráficos propios.
   La cartera la construye el motor de siempre (btBuildPortfolioSeriesRange).
   ========================================================================== */
(function(){
  "use strict";
  var L = window.HF2.lib, $ = L.$, esc = L.esc, h = L.h, pct = L.pct, num = L.num, dES = L.dES, clip = L.clip;
  var B = { sig: "", chipSig: "", per: 0, dd: "m", rm: "r", rn: 0, legacy: false, ymode: "r" };
  var REB = [["none", "Sin rebalanceo"], ["yearly", "Rebalanceo anual"], ["bands", "Rebalanceo por bandas"]];
  function BTs(){ return window.BT; }
  function loaded(){ var a = []; for (var i = 0; i < BTs().funds.length; i++) if (BTs().funds[i]) a.push(i); return a; }
  function fname(i){ var f = BTs().funds[i]; return L.nameParts(f.name || (f.meta && f.meta.name) || ("Fondo " + (i + 1))); }
  function sumW(){ return loaded().reduce(function(s, i){ return s + (Number(BTs().weights[i]) || 0); }, 0); }
  function syncClassic(){ try{ if (typeof btRenderWeightsTable === "function") btRenderWeightsTable(); if (typeof btUpdateSumUI === "function") btUpdateSumUI(); }catch(_){ } }
  function setW(i, v){ BTs().weights[i] = Math.max(0, Number(v) || 0); syncClassic(); B.sig = ""; }
  function equal(){ var ix = loaded(); if (!ix.length) return; var w = Math.floor(1000 / ix.length) / 10, rest = Math.round((100 - w * ix.length) * 10) / 10; ix.forEach(function(i, k){ BTs().weights[i] = k === 0 ? Math.round((w + rest) * 10) / 10 : w; }); syncClassic(); B.sig = ""; B.chipSig = ""; }
  function add(){ if (window.HF2P) HF2P.open({ kind: "bt", onDone: function(){
      var ix = loaded(), zeros = ix.filter(function(i){ return !(Number(BTs().weights[i]) > 0); }), rem = 100 - sumW();   // lo nuevo se reparte el peso que falte
      var nz = ix.filter(function(i){ return Number(BTs().weights[i]) > 0; }).map(function(i){ return Number(BTs().weights[i]); });
      if (zeros.length && rem <= 0.2 && nz.every(function(v){ return Math.abs(v - nz[0]) < 0.2; })) equal();     // pesos aún automáticos: se reparte por igual
      else if (zeros.length && rem > 0.2){ var w = Math.floor(rem / zeros.length * 10) / 10; zeros.forEach(function(i, k){ BTs().weights[i] = k === 0 ? Math.round((rem - w * (zeros.length - 1)) * 10) / 10 : w; }); syncClassic(); }
      B.chipSig = ""; B.sig = ""; } }); }
  function setLegacy(on){ B.legacy = on; document.body.classList.toggle("hf2-legacy", on); B.sig = "";
    if (on){ try{ if (Math.abs(sumW() - 100) <= 0.2 && typeof btRun === "function") btRun(); }catch(_){ } setTimeout(function(){ window.dispatchEvent(new Event("resize")); }, 80); } }

  function mount(){
    var s3 = $("screen3"); if (!s3 || $("hf2Bt")) return;
    var root = h("div", "hf2", ""); root.id = "hf2Bt";
    root.innerHTML = '<div class="hf2bar"><div class="hf2chips" id="hf2BChips"></div><div class="hf2ctl">' +
      '<select class="hf2sel" id="hf2BReb" title="Rebalanceo de la cartera">' + REB.map(function(o){ return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join("") + "</select>" +
      L.perMarkup("hf2B") +
      '<div class="hf2rel"><button type="button" class="hf2icon" id="hf2BMenuBtn" title="Más opciones" aria-label="Más opciones">⋯</button><div class="hf2pop" id="hf2BMenu" hidden style="right:0;top:38px"></div></div></div></div>' +
      '<div class="hf2hint" id="hf2BHint"></div><div id="hf2BBody"></div>';
    s3.insertBefore(root, s3.firstChild);
    L.perBind("hf2B", B, function(){ B.sig = ""; render(); });
    $("hf2BReb").addEventListener("change", function(){ var c = $("btRebalMode"); if (c){ c.value = this.value; c.dispatchEvent(new Event("change", { bubbles: true })); } BTs().rebalMode = this.value; B.sig = ""; });
    $("hf2BMenuBtn").addEventListener("click", function(e){
      e.stopPropagation(); var m = $("hf2BMenu"); m.innerHTML = "";
      function item(txt, fn, admin){ var b = h("button", "it" + (admin ? " hf2-admin" : ""), txt); b.type = "button"; b.addEventListener("click", function(){ m.hidden = true; fn(); }); m.appendChild(b); }
      item("Repartir los pesos por igual", equal);
      item("Exportar PDF", function(){ var b = $("s3ExportPdf"); if (b) b.click(); });
      item(B.legacy ? "Ocultar vista clásica" : "Vista clásica (índice de referencia, descargas, CSV)", function(){ setLegacy(!B.legacy); }, true);
      m.hidden = !m.hidden;
    });
    document.addEventListener("click", function(e){ var p = $("hf2BMenu"); if (p && !p.hidden && !p.contains(e.target)) p.hidden = true; });
  }
  function chips(ix, T){
    var sig = ix.map(function(i){ return i + fname(i).short; }).join("|") + T.DARK;
    var box = $("hf2BChips");
    if (sig !== B.chipSig){
      B.chipSig = sig; box.innerHTML = "";
      ix.forEach(function(i){
        var c = h("span", "hf2chip w", '<i style="background:' + T.PAL[i % T.PAL.length] + '"></i><span title="' + esc(fname(i).short) + '">' + esc(fname(i).short) + '</span><input type="number" min="0" max="100" step="1" inputmode="decimal" aria-label="Peso de ' + esc(fname(i).short) + '" data-i="' + i + '"><em>%</em><b title="Quitar" aria-label="Quitar">×</b>');
        c.querySelector("input").addEventListener("input", function(){ setW(i, this.value); });
        c.querySelector("b").addEventListener("click", function(){ if (typeof repoSlotClear === "function") Promise.resolve(repoSlotClear({ kind: "bt", slot: i, isBench: false, screenId: "screen3", role: "fund" })).then(function(){ BTs().funds[i] = null; BTs().weights[i] = 0; syncClassic(); B.chipSig = ""; B.sig = ""; }); });
        box.appendChild(c);
      });
      if (ix.length && ix.length < BTs().funds.length){ var ad = h("button", "hf2add ghost", "+ Añadir fondo"); ad.type = "button"; ad.addEventListener("click", add); box.appendChild(ad); }
      if (ix.length){ var s = h("span", "hf2sum-w", ""); s.id = "hf2BSum"; box.appendChild(s); }
    }
    Array.prototype.forEach.call(box.querySelectorAll("input"), function(inp){ if (document.activeElement === inp) return; var v = Number(BTs().weights[Number(inp.dataset.i)]) || 0, t = String(Math.round(v * 10) / 10); if (inp.value !== t) inp.value = t; });
    var sm = $("hf2BSum"); if (sm){ var s2 = sumW(), ok = Math.abs(s2 - 100) <= 0.2; sm.className = "hf2sum-w" + (ok ? " ok" : " bad");
      sm.innerHTML = ok ? "Suma 100 %" : "Suma " + num(s2, 1) + " % · " + (s2 < 100 ? "faltan " + num(100 - s2, 1) : "sobran " + num(s2 - 100, 1)) + ' <button type="button" id="hf2BEq">Repartir</button>'; var eq = $("hf2BEq"); if (eq) eq.addEventListener("click", equal); }
  }
  function heat(items, isV, T){
    items.forEach(function(it){ it.yv = isV ? L.yearsVol(it.series) : L.years(it.series); });
    var allY = {}; items.forEach(function(it){ it.yv.forEach(function(y){ allY[y.y] = allY[y.y] || y; if (y.ytd) allY[y.y] = y; }); });
    var yl = Object.keys(allY).map(Number).sort().slice(-9);
    var ht = '<table class="hf2heat"><thead><tr><th></th>' + yl.map(function(y){ var o = allY[y]; return "<th" + (o.ytd ? ' class="ytd"' : "") + ">" + y + (o.ytd ? "*" : "") + "</th>"; }).join("") + "</tr></thead><tbody>";
    items.forEach(function(it, k){
      var m = {}; it.yv.forEach(function(y){ m[y.y] = y; });
      ht += "<tr" + (k === 0 ? ' class="tot"' : "") + "><td title='" + esc(it.short) + "'><i style='background:" + it.color + "'></i>" + esc(clip(it.short, 26)) + "</td>" + yl.map(function(y){
        var o = m[y]; if (!o) return '<td class="na">–</td>';
        var a = Math.min(0.5, 0.07 + Math.abs(o.r) / 0.30 * 0.43) * (T.DARK ? 1.25 : 1);
        return '<td style="background:' + (isV ? L.rgba(T.PAL[0], (a * 0.8).toFixed(2)) : L.rgba(o.r >= 0 ? T.POS : T.NEG, a.toFixed(2))) + '">' + pct(o.r, 1) + "</td>"; }).join("") + "</tr>";
    });
    var ytd = yl.map(function(y){ return allY[y]; }).filter(function(o){ return o.ytd; })[0];
    return ht + "</tbody></table>" + (ytd && !isV ? '<div class="hf2foot">* ' + ytd.y + " hasta el " + dES(ytd.t) + "</div>" : "");
  }
  function render(){
    var s3 = $("screen3"); if (!s3 || s3.classList.contains("hidden") || !window.BT) return;
    mount();
    var T = L.th(), ix = loaded(), body = $("hf2BBody"), per = $("hf2BPer"), hint = $("hf2BHint"), reb = $("hf2BReb");
    chips(ix, T);
    var mode = BTs().rebalMode || ($("btRebalMode") && $("btRebalMode").value) || "none"; if (reb.value !== mode) reb.value = mode;
    var sig = ix.map(function(i){ return i + ":" + (Number(BTs().weights[i]) || 0) + ":" + L.ser(BTs().funds[i]).length; }).join("|") + "#" + mode + L.perSig(B) + B.dd + B.rm + B.rn + B.ymode + T.DARK + "#" + (window.HF2I ? HF2I.ver + "|" + HF2I.bt : "") + "#" + (body ? body.clientWidth : 0);
    if (sig === B.sig) return; B.sig = sig;
    var ctl = [per, reb, $("hf2BDatesBtn").parentElement, $("hf2BMenuBtn").parentElement];
    if (!ix.length){
      ctl.forEach(function(e){ e.style.display = "none"; }); hint.innerHTML = "";
      body.innerHTML = '<div class="hf2empty"><h2>Simula una cartera</h2><button type="button" class="hf2add" id="hf2BEmptyAdd">+ Añadir fondos</button></div>';
      $("hf2BEmptyAdd").addEventListener("click", add); return;
    }
    ctl.forEach(function(e){ e.style.display = ""; });
    var act = ix.filter(function(i){ return (Number(BTs().weights[i]) || 0) > 0; });
    if (!act.length || Math.abs(sumW() - 100) > 0.2){ per.innerHTML = ""; hint.innerHTML = ""; body.innerHTML = '<div class="hf2card"><div class="hf2msg">Ajusta los pesos hasta sumar 100 % para ver la cartera.</div></div>'; return; }
    var cr = null; try{ cr = btComputeCommonRange(); }catch(e){ cr = null; }
    if (!cr){ body.innerHTML = '<div class="hf2card"><div class="hf2msg">No hay periodo común entre los fondos.</div></div>'; return; }
    var tS = +cr.start, tE = +cr.end, rg = L.perRender("hf2B", B, tS, tE, function(){ B.sig = ""; render(); }), isFull = rg[0] === tS && rg[1] === tE, port, full;
    /* la cartera se simula de verdad en el periodo elegido: empieza con los pesos objetivo en «Desde» */
    try{ port = btBuildPortfolioSeriesRange(new Date(rg[0]), new Date(rg[1]), mode, Number(BTs().bandX) || 5); full = isFull ? port : btBuildPortfolioSeriesRange(cr.start, cr.end, mode, Number(BTs().bandX) || 5); }
    catch(e){ body.innerHTML = '<div class="hf2card"><div class="hf2msg">' + esc((e && e.message) || "No se ha podido calcular la cartera.") + "</div></div>"; return; }
    var p = L.pts(port, -Infinity, Infinity), pAll = L.pts(full, -Infinity, Infinity), st = L.stats(p), t0 = p[0][0], t1 = p[p.length - 1][0];
    var lim = (act.length >= 2 && (+cr.start - +cr.startNoLim) / 864e5 / 365.25 >= 0.5) ? cr.limIdx : null;
    hint.innerHTML = "<span><b>" + dES(t0) + " – " + dES(t1) + "</b> · " + (st.days >= 365 ? num(st.days / 365.25, 1) + " años" : Math.round(st.days / 30.44) + " meses") + "</span>" +
      (lim != null ? "<span>·</span><span>El periodo lo limita <b>" + esc(fname(lim).short) + "</b>; sin él empezaría el " + dES(+cr.startNoLim) + ".</span>" : "");
    if (!$("hf2BEvo")){
      body.innerHTML = '<div class="hf2head"><div><h1>Cartera</h1><p id="hf2BSub"></p><div class="hf2idxrow" id="hf2BIdx"></div></div><div class="hf2kpis" id="hf2BKpis"></div></div>' +
        '<div class="hf2card"><h3>Evolución <small id="hf2BEvoS"></small></h3><div class="hf2plot" id="hf2BEvo"></div><div class="hf2leg" id="hf2BLeg"></div></div>' +
        '<div class="hf2grid"><div class="hf2card"><h3>Por año <span class="hf2seg sm" id="hf2BY" style="margin-left:auto"><button type="button" data-m="r">Rentabilidad</button><button type="button" data-m="v">Volatilidad</button></span></h3><div id="hf2BYears" style="overflow-x:auto"></div></div>' +
        '<div class="hf2card"><h3>Composición</h3><div id="hf2BComp" class="hf2comp"></div></div>' + L.ddCard("hf2B") + L.rollCard("hf2B") + "</div>" +
        '<button type="button" class="hf2more hf2-admin" id="hf2BMore">Más análisis</button>';
      L.ddBind("hf2B", B, function(){ B.sig = ""; render(); });
      Array.prototype.forEach.call($("hf2BY").children, function(b){ b.addEventListener("click", function(){ B.ymode = b.dataset.m; B.sig = ""; render(); }); });
      $("hf2BMore").addEventListener("click", function(){ setLegacy(!B.legacy); this.textContent = B.legacy ? "Ocultar vista clásica" : "Más análisis"; });
    }
    var sharpe = (st.ann != null && st.vol) ? st.ann / st.vol : null;
    /* índice de la cartera: mezcla de los índices de sus fondos por peso (se puede cambiar) */
    var I = window.HF2I, ixAuto = I ? I.portfolio(act.map(function(i){ var f = BTs().funds[i]; return { isin: (f && f.meta && f.meta.isin) || (f && f.fileName && f.fileName.indexOf("repo:") === 0 ? f.fileName.slice(5) : ""), w: Number(BTs().weights[i]) || 0 }; })) : "";
    var ixSpec = I ? (I.bt != null ? I.bt : ixAuto) : "", ip = ixSpec ? I.series(ixSpec) : [], idxIt = null, xs = null, cov = "";
    if (ip && ip.length){
      var ipP = ip.filter(function(x){ return x[0] >= t0 - 20 * 864e5 && x[0] <= t1; }); cov = I.cover(ip, t0, t1);
      if (ipP.length >= 2){ var off = 0; if (ipP[0][0] > t0 + 20 * 864e5){ var fv = null; p.forEach(function(x){ if (x[0] <= ipP[0][0]) fv = x[1]; }); off = fv ? fv / p[0][1] - 1 : 0; }
        idxIt = { short: I.label(ixSpec), color: T.MUT, dash: true, lw: 1.6, p: ipP, st: L.stats(ipP), idx: true, off: off }; xs = I.excess(p, ipP); }
    }
    if (I){
      $("hf2BIdx").innerHTML = '<span>Índice de referencia</span><button type="button" class="hf2idxb" data-hf2idxbt="1" title="' + esc(I.bt == null ? "Automático: mezcla de los índices de los fondos según su peso. Pulsa para cambiarlo." : "Elegido para esta cartera. Pulsa para cambiarlo.") + '"><i></i>' + esc(I.label(ixSpec)) + (I.bt == null ? " <em>automático</em>" : "") + ' <span aria-hidden="true">▾</span></button>';
      $("hf2BIdx").querySelector("button").addEventListener("click", function(e){ e.stopPropagation(); I.open({ anchor: this, name: "Cartera", current: ixSpec, src: I.bt == null ? "sugerido" : "elegido", suggested: ixAuto, sugWhy: "mezcla de los índices de los fondos según su peso", onPick: function(sp){ I.bt = sp === ixAuto ? null : sp; } }); });
    }
    $("hf2BEvoS").innerHTML = "cartera frente a sus fondos · rentabilidad acumulada, con la anualizada al final de cada línea" + (idxIt ? ' · <span class="hf2dsh"></span> índice' : "") + (ixSpec && ip === null ? " · cargando índice…" : "") + (cov ? ' · <span class="w">el índice ' + esc(cov) + "</span>" : "");
    function kpi(l, v, cls, tip){ return '<div class="hf2kpi"' + (tip ? ' title="' + tip + '"' : "") + "><span>" + l + "</span><b" + (cls ? ' class="' + cls + '"' : "") + ">" + v + "</b></div>"; }
    $("hf2BSub").textContent = act.length + (act.length === 1 ? " fondo" : " fondos") + " · " + REB.filter(function(o){ return o[0] === mode; })[0][1].toLowerCase();
    $("hf2BKpis").innerHTML = (st.ann != null ? kpi("Anualizada", pct(st.ann, 1, true), st.ann < 0 ? "neg" : "pos") : "") + kpi("Acumulada", pct(st.cum, Math.abs(st.cum) >= 1 ? 0 : 1, true), st.ann == null ? (st.cum < 0 ? "neg" : "pos") : "") +
      kpi("Volatilidad", pct(st.vol, 1), "", "Anualizada, con cierres mensuales") + (sharpe != null ? kpi("Sharpe", num(sharpe, 2), "", "Rentabilidad anualizada entre volatilidad (tipo sin riesgo 0 %)") : "") +
      kpi("Máx. caída", pct(st.mdd, 1), "", "De pico a valle con cierres diarios") + kpi("vs índice", xs ? pct(xs.d, 1, true) : "—", xs && Math.abs(xs.d) >= 0.0005 ? (xs.d < 0 ? "neg" : "pos") : "", xs ? "Anualizada de la cartera (" + pct(xs.f, 1, true) + ") menos la del índice (" + pct(xs.i, 1, true) + ")" : "Sin índice o sin un año de datos en común");
    /* si el periodo a medida empieza en los primeros días de enero, ese año cuenta entero: la cartera arranca con su valor inicial como cierre del año anterior */
    var portY = port; if (!isFull && port.length){ var d0 = new Date(L.tOf(port[0])); if (d0.getUTCMonth() === 0 && d0.getUTCDate() <= 10){ var b0 = Object.assign({}, port[0]); b0.date = new Date(Date.UTC(d0.getUTCFullYear() - 1, 11, 31)); portY = [b0].concat(port); } }
    var cart = { short: "Cartera", color: T.INK, lw: 2.8, p: p, st: st, series: isFull ? full : portY };
    var comps = act.map(function(i){ var sr = L.ser(BTs().funds[i]), q = L.pts(sr, t0, t1), srP = isFull ? sr : sr.filter(function(x){ var t = L.tOf(x); return t >= t0 - 10 * 864e5 && t <= t1; }); return { short: fname(i).short, color: T.PAL[i % T.PAL.length], lw: 1.3, p: q, st: L.stats(q), series: srP, w: Number(BTs().weights[i]) || 0 }; }).filter(function(c){ return c.p.length >= 2; });
    var evo = [cart].concat(comps); if (idxIt) evo.push(idxIt);
    try{ if (typeof btBenchUsed === "function" && btBenchUsed() && typeof btBuildBenchmarkSeriesRange === "function"){ var bq = L.pts(btBuildBenchmarkSeriesRange(new Date(t0), new Date(t1), BTs().benchRebalMode || "none", Number(BTs().benchBandX) || 5), -Infinity, Infinity); if (bq.length >= 2) evo.push({ short: "Referencia de la vista clásica", color: T.FAINT, lw: 1.3, dash: "dot", p: bq, st: L.stats(bq), idx: true }); } }catch(_){ }
    var H1 = Math.max(300, Math.min(420, Math.round(window.innerHeight * 0.40))), H2 = 290;
    L.plotEvolution("hf2BEvo", evo, H1, false);
    $("hf2BLeg").innerHTML = '<div class="its">' + evo.map(function(e){ return '<span class="it' + (e.idx ? " ix" : "") + '">' + L.sw(e.color, e.idx ? (typeof e.dash === "string" ? e.dash : "dash") : null) + "<span><b>" + esc(clip(e.short, 34)) + "</b>" + (e.w != null ? "<small>" + num(e.w, e.w % 1 ? 1 : 0) + " %</small>" : (e.idx ? "<small>índice</small>" : "")) + "</span></span>"; }).join("") + "</div>";
    Array.prototype.forEach.call($("hf2BY").children, function(b){ b.className = b.dataset.m === B.ymode ? "on" : ""; });
    $("hf2BYears").innerHTML = heat([cart].concat(comps), B.ymode === "v", T);
    $("hf2BComp").innerHTML = comps.slice().sort(function(a, b){ return b.w - a.w; }).map(function(c){
      return '<div class="r"><span class="n"><i style="background:' + c.color + '"></i>' + esc(clip(c.short, 34)) + '</span><span class="b"><u style="width:' + Math.max(1, c.w) + "%;background:" + c.color + '"></u></span><b>' + num(c.w, c.w % 1 ? 1 : 0) + " %</b><em>" + pct(c.st.ann != null ? c.st.ann : c.st.cum, 1, true) + "</em></div>"; }).join("") +
      '<div class="hf2foot">A la derecha, la rentabilidad ' + (st.ann != null ? "anualizada" : "acumulada") + " de cada fondo en el periodo.</div>";
    L.ddRender("hf2B", [cart], true, H2 - 30, B, function(){ B.sig = ""; render(); });
    L.rollRender("hf2B", pAll, T.DARK ? T.PAL[0] : T.INK, H2, B, function(){ B.sig = ""; render(); }, isFull ? null : [t0, t1]);
  }
  window.HF2B = { render: render, state: B };
})();
