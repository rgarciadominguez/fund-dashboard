/* ==========================================================================
   HF2 (nov-2026) — vista de cliente de Comparación y Fondo: barra de control,
   tabla resumen y gráficos propios. Lee las series ya cargadas por el motor
   (CMP.funds / STATE) y no toca sus cálculos ni la capa de datos.
   ========================================================================== */
(function(){
  "use strict";
  var PAL_L = ["#2C66D1","#C8562B","#1baf7a","#eda100","#e87ba4","#008300","#6250d6","#e34948"];
  var PAL_D = ["#4F86E8","#D2643A","#1baf7a","#C08A12","#D06A96","#2F9A2F","#7C6AE6","#E0504F"];   // validada sobre #131C2B (skill dataviz)
  var FONT = "'Instrument Sans', Arial, sans-serif";
  var PAL, INK, MUT, FAINT, HAIR, POS, NEG, SURF, ZERO, EDGE, MIDC, DARK = false;
  function palette(dark){
    DARK = !!dark; PAL = dark ? PAL_D : PAL_L;
    INK = dark ? "#E8EDF5" : "#0B1A33"; MUT = dark ? "#9CA9BF" : "#6B7790"; FAINT = dark ? "#7E8CA5" : "#98A3B8"; HAIR = dark ? "#202B3D" : "#EEF1F6";
    POS = dark ? "#3DBB84" : "#1E8A5A"; NEG = dark ? "#EB6B5F" : "#C0392B"; SURF = dark ? "#131C2B" : "#ffffff"; ZERO = dark ? "#34425A" : "#CBD3E0";
    EDGE = dark ? "#2A374C" : "#D5DCE8"; MIDC = dark ? "#1B2536" : "#F3F5F9";
  }
  function rgba(hex, a){ var n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }
  palette(false);
  var BROKERS = /^(myinvestor|mundo asesoramiento|renta ?4|ironia|mapfre|ebn|openbank|inversis|allfunds)$/i;
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]; }); }
  function h(tag, cls, html){ var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function val(p){ return p.nav != null ? p.nav : (p.value != null ? p.value : p.close); }
  function ser(f){ return (f && f.dailySeries && f.dailySeries.length >= 2) ? f.dailySeries : ((f && f.series) || []); }
  function tOf(p){ return (p.date instanceof Date) ? p.date.getTime() : Date.parse(p.date); }
  function dES(t){ var d = new Date(t); return String(d.getUTCDate()).padStart(2,"0") + "/" + String(d.getUTCMonth()+1).padStart(2,"0") + "/" + d.getUTCFullYear(); }
  function dISO(t){ return new Date(t).toISOString().slice(0,10); }
  function num(x, d){ return x.toFixed(d).replace(".", ","); }
  function pct(x, d, sign){ if (x == null || !isFinite(x)) return "—"; var s = num(Math.abs(x)*100, d == null ? 1 : d) + "%"; return (x < 0 ? "−" : (sign ? "+" : "")) + s; }
  function titleCase(s){
    if (s !== s.toUpperCase() || s.length < 8) return s;
    return s.toLowerCase().replace(/(^|[\s\-\/(])([a-záéíóúñ])([a-záéíóúñ]*)/g, function(m, a, b, c){ var w = b + c; return a + (w.length <= 2 && !/^(de|la|el|y|en)$/.test(w) ? w.toUpperCase() : b.toUpperCase() + c); })
            .replace(/\b(Fi|Sicav|Etf|Ucits|Eur|Usd|Ra|Acc|Inc|Us|Uk|Em)\b/g, function(m){ return m.toUpperCase(); });
  }
  function nameParts(n){
    var a = String(n || "").split(" · ").map(function(x){ return x.trim(); }).filter(Boolean);
    var short = titleCase((a[0] || "Fondo").replace(/\.(csv|xlsx?|txt|tsv)$/i, "").replace(/,\s*FI$/i, ""));
    return { short: short, sub: a.slice(1).filter(function(x){ return !BROKERS.test(x) && /[a-z0-9]/i.test(x); }).join(" · ") };
  }
  function clip(s, n){ s = String(s); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }

  /* ---------------- cálculo de lo que se enseña (definiciones estándar) ---------------- */
  function pts(series, t0, t1){
    var out = [];
    for (var i = 0; i < series.length; i++){ var t = tOf(series[i]), v = val(series[i]); if (t >= t0 && t <= t1 && v > 0) out.push([t, v]); }
    return out;
  }
  function monthlyRets(p){   // rentabilidades entre cierres de mes → {ym: r}
    var last = {}, order = [];
    p.forEach(function(x){ var k = dISO(x[0]).slice(0,7); if (!(k in last)) order.push(k); last[k] = x[1]; });
    var r = {};
    for (var i = 1; i < order.length; i++) r[order[i]] = last[order[i]] / last[order[i-1]] - 1;
    return r;
  }
  function sd(a){ if (a.length < 2) return null; var m = a.reduce(function(s,x){ return s+x; },0)/a.length; return Math.sqrt(a.reduce(function(s,x){ return s+(x-m)*(x-m); },0)/(a.length-1)); }
  function stats(p){
    if (!p || p.length < 2) return null;
    var cum = p[p.length-1][1] / p[0][1] - 1, days = (p[p.length-1][0] - p[0][0]) / 864e5;
    var mr = monthlyRets(p), arr = Object.keys(mr).map(function(k){ return mr[k]; });
    var peak = -Infinity, mdd = 0, mddT = p[0][0];
    p.forEach(function(x){ if (x[1] > peak) peak = x[1]; var d = x[1]/peak - 1; if (d < mdd){ mdd = d; mddT = x[0]; } });
    return { cum: cum, ann: days >= 360 ? Math.pow(1 + cum, 365.25/days) - 1 : null, vol: arr.length >= 6 ? sd(arr) * Math.sqrt(12) : null,
             mdd: mdd, mddT: mddT, days: days, mr: mr };
  }
  function years(series){   // rentabilidad por año natural con la serie completa; el año en curso, hasta su último dato
    var last = {}, lastT = {}, ys = [];
    series.forEach(function(x){ var v = val(x); if (!(v > 0)) return; var t = tOf(x), y = new Date(t).getUTCFullYear(); if (!(y in last)) ys.push(y); last[y] = v; lastT[y] = t; });
    var out = [];
    for (var i = 1; i < ys.length; i++){
      var y = ys[i]; if (ys[i-1] !== y - 1) continue;
      var d = new Date(lastT[y]);
      out.push({ y: y, r: last[y]/last[y-1] - 1, ytd: !(d.getUTCMonth() === 11 && d.getUTCDate() >= 24), t: lastT[y] });
    }
    return out;
  }
  function yearsVol(series){
    var mr = monthlyRets(pts(series, -Infinity, Infinity)), by = {};
    Object.keys(mr).forEach(function(k){ var y = Number(k.slice(0,4)); (by[y] = by[y] || []).push(mr[k]); });
    return Object.keys(by).map(Number).sort().filter(function(y){ return by[y].length >= 9; }).map(function(y){ return { y: y, r: sd(by[y]) * Math.sqrt(12), ytd: by[y].length < 12, t: 0 }; });
  }
  function down(p, n){ if (p.length <= n) return p; var k = Math.ceil(p.length / n), o = []; for (var i = 0; i < p.length; i += k) o.push(p[i]); if (o[o.length-1] !== p[p.length-1]) o.push(p[p.length-1]); return o; }
  function spark(p, color){
    var q = down(p, 48), w = 112, hh = 26, mn = Infinity, mx = -Infinity;
    q.forEach(function(x){ if (x[1] < mn) mn = x[1]; if (x[1] > mx) mx = x[1]; });
    var t0 = q[0][0], t1 = q[q.length-1][0], d = "";
    q.forEach(function(x, i){ var X = (x[0]-t0)/((t1-t0)||1)*(w-2)+1, Y = hh-2-(x[1]-mn)/((mx-mn)||1)*(hh-4); d += (i ? "L" : "M") + X.toFixed(1) + " " + Y.toFixed(1); });
    return '<svg width="'+w+'" height="'+hh+'" viewBox="0 0 '+w+' '+hh+'" aria-hidden="true"><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  /* ---------------- Plotly: plantilla propia ---------------- */
  var CFG = { displayModeBar: false, responsive: true, doubleClick: false, scrollZoom: false };
  function base(height, extra){
    var L = { height: height, font: { family: FONT, size: 12, color: MUT }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      showlegend: false, separators: ",.", margin: { l: 46, r: 16, t: 8, b: 28 }, dragmode: false,
      hoverlabel: { bgcolor: SURF, bordercolor: EDGE, font: { family: FONT, size: 12.5, color: INK }, namelength: 40 },
      xaxis: { showgrid: false, showline: false, zeroline: false, ticks: "", fixedrange: true, tickfont: { color: FAINT, size: 11.5 }, automargin: true },
      yaxis: { gridcolor: HAIR, gridwidth: 1, showline: false, zeroline: true, zerolinecolor: ZERO, zerolinewidth: 1, ticks: "", fixedrange: true,
               tickfont: { color: FAINT, size: 11.5 }, nticks: 6, automargin: true } };
    if (extra) Object.keys(extra).forEach(function(k){ L[k] = (L[k] && typeof L[k] === "object" && !Array.isArray(L[k])) ? Object.assign({}, L[k], extra[k]) : extra[k]; });
    return L;
  }
  function plot(id, data, layout){ var e = $(id); if (!e || typeof Plotly === "undefined") return; try{ Plotly.react(e, data, layout, CFG); }catch(err){ console.warn("[HF2] plot " + id, err); } }
  function msg(id, text){ var e = $(id); if (!e) return; try{ if (typeof Plotly !== "undefined") Plotly.purge(e); }catch(_){ } e.innerHTML = '<div class="hf2msg">' + esc(text) + "</div>"; e.style.height = "auto"; }
  function clear(id){ var e = $(id); if (e && e.firstChild && e.firstChild.className === "hf2msg"){ e.innerHTML = ""; e.style.height = ""; } }

  /* Evolución en % acumulado, con el nombre y la cifra al final de cada línea */
  function plotEvolution(id, items, height, single){
    clear(id);
    var lo = 0, hi = 0;
    items.forEach(function(it){ it.g = down(it.p, 900).map(function(x){ return [x[0], x[1]/it.p[0][1] - 1]; }); it.g.forEach(function(x){ if (x[1] < lo) lo = x[1]; if (x[1] > hi) hi = x[1]; }); it.end = it.g[it.g.length-1][1];
      var dd = (it.p[it.p.length-1][0] - it.p[0][0]) / 864e5; it.lab = dd >= 360 ? Math.pow(1 + it.end, 365.25 / dd) - 1 : null; });
    var useLog = hi > 3, T = function(r){ return useLog ? Math.log10(1 + r) : r; };
    lo = T(lo); hi = T(hi);
    var pad = (hi - lo || 0.1) * 0.07; lo -= pad; hi += pad;
    var order = items.slice().sort(function(a,b){ return b.end - a.end; });
    var plotH = height - 36, gap = 17 * (hi - lo) / plotH, ys = order.map(function(it){ return T(it.end); });
    for (var i = 1; i < ys.length; i++) if (ys[i] > ys[i-1] - gap) ys[i] = ys[i-1] - gap;
    var under = lo + gap*0.4 - ys[ys.length-1];
    if (under > 0){ ys[ys.length-1] += under; for (i = ys.length-2; i >= 0; i--) if (ys[i] < ys[i+1] + gap) ys[i] = ys[i+1] + gap; }
    var data = order.map(function(it){
      var t = { type: "scatter", mode: "lines", name: clip(it.short, 34), x: it.g.map(function(x){ return dISO(x[0]); }), y: it.g.map(function(x){ return useLog ? 1 + x[1] : x[1]; }), customdata: it.g.map(function(x){ return x[1]; }),
        line: { color: it.color, width: it.lw || (single ? 2.2 : 2), shape: "linear", dash: it.dash ? "dash" : "solid" }, hovertemplate: "%{customdata:+.1%}" };
      if (single){ t.fill = "tozeroy"; t.fillcolor = rgba(PAL[0], DARK ? 0.14 : 0.08); }
      return t;
    });
    var ann = order.map(function(it, k){
      return { xref: "paper", x: 1, xanchor: "left", xshift: 8, yref: "y", y: ys[k], yanchor: "middle", showarrow: false, align: "left",
               text: "<b>" + (it.lab != null ? pct(it.lab, 1, true) + "</b> anual" : pct(it.end, 1, true) + "</b>") + (single ? "" : "  " + esc(clip(it.short, 22))), font: { family: FONT, size: 12, color: it.color } };
    });
    var last = order.map(function(it){ return { type: "scatter", mode: "markers", x: [dISO(it.g[it.g.length-1][0])], y: [useLog ? 1 + it.end : it.end], marker: { color: it.color, size: 7, line: { color: SURF, width: 1.5 } }, hoverinfo: "skip" }; });
    plot(id, data.concat(last), base(height, {
      margin: { l: 50, r: single ? 96 : 236, t: 8, b: 26 }, hovermode: "x unified", annotations: ann,
      xaxis: { hoverformat: "%d/%m/%Y", nticks: 9, showspikes: true, spikemode: "across", spikecolor: ZERO, spikethickness: 1, spikedash: "solid", spikesnap: "cursor" },
      yaxis: useLog ? (function(){ var tv = [0.25,0.5,1,2,3,6,11,21,51,101,201].filter(function(f){ var u = Math.log10(f); return u >= lo && u <= hi; });
          return { type: "log", range: [lo, hi], tickmode: "array", tickvals: tv, ticktext: tv.map(function(f){ return f === 1 ? "0%" : pct(f - 1, 0, true); }), zeroline: false }; })()
        : { tickformat: "+.0%", range: [lo, hi] },
      shapes: useLog ? [{ type: "line", xref: "paper", x0: 0, x1: 1, yref: "y", y0: 1, y1: 1, line: { color: ZERO, width: 1 } }] : [] }));
  }
  function plotDrawdown(id, items, height, single){
    clear(id);
    if (!single && items.length > 4){
      var o = items.slice().sort(function(a,b){ return a.st.mdd - b.st.mdd; });
      plot(id, [{ type: "bar", orientation: "h", y: o.map(function(it){ return clip(it.short, 26); }), x: o.map(function(it){ return -it.st.mdd; }),
          marker: { color: o.map(function(it){ return it.color; }) }, text: o.map(function(it){ return pct(it.st.mdd, 1); }), textposition: "outside", cliponaxis: false,
          textfont: { family: FONT, size: 12, color: INK }, hovertemplate: "<b>%{y}</b><br>Máxima caída −%{x:.1%}<extra></extra>" }],
        base(height, { barcornerradius: 4, bargap: 0.4, margin: { l: 8, r: 12, t: 4, b: 8 }, hovermode: "closest",
          xaxis: { showticklabels: false, range: [0, -o[0].st.mdd * 1.2], zeroline: false },
          yaxis: { autorange: "reversed", showgrid: false, zeroline: false, tickfont: { color: INK, size: 12 }, tickmode: "linear", dtick: 1, automargin: true } }));
      return;
    }
    var worst = null, ann = [];
    var data = items.map(function(it){
      var peak = -Infinity, dd = it.p.map(function(x){ if (x[1] > peak) peak = x[1]; return [x[0], x[1]/peak - 1]; }), q = down(dd, 700);
      var st = it.st; if (!worst || st.mdd < worst.st.mdd) worst = it;
      var t = { type: "scatter", mode: "lines", name: clip(it.short, 34), x: q.map(function(x){ return dISO(x[0]); }), y: q.map(function(x){ return x[1]; }),
        line: { color: single ? NEG : it.color, width: 1.6, dash: it.dash ? "dash" : "solid" }, hovertemplate: "%{y:.1%}" };
      if (single || items.length <= 2){ t.fill = "tozeroy"; t.fillcolor = single ? rgba(NEG, 0.12) : rgba(it.color, 0.10); }
      return t;
    });
    (items.length <= 4 ? items : [worst]).forEach(function(it){
      if (!(it.st.mdd < -0.005)) return;
      ann.push({ x: dISO(it.st.mddT), y: it.st.mdd, xref: "x", yref: "y", text: "<b>" + pct(it.st.mdd, 1) + "</b>", showarrow: true, arrowhead: 0, arrowwidth: 1, arrowcolor: single ? NEG : it.color,
                 ax: 0, ay: 18, font: { family: FONT, size: 11.5, color: single ? NEG : it.color }, bgcolor: rgba(SURF, 0.85) });
    });
    plot(id, data, base(height, { hovermode: "x unified", annotations: ann, xaxis: { hoverformat: "%d/%m/%Y", nticks: 7 }, yaxis: { tickformat: ".0%", range: [Math.min(-0.02, items.reduce(function(m, it){ return Math.min(m, it.st.mdd); }, 0)) * 1.22, 0.004], zeroline: false } }));
  }

  /* ---------------- medidas añadidas en la ronda 3 ---------------- */
  function mean(a){ return a.length ? a.reduce(function(s, x){ return s + x; }, 0) / a.length : null; }
  function monthEnds(p){ var o = [], k = null; p.forEach(function(x){ var m = dISO(x[0]).slice(0, 7); if (m === k) o[o.length - 1] = x; else { o.push(x); k = m; } }); return o; }
  /* Resultado de entrar en CUALQUIER fecha y mantener un horizonte fijo (ventana móvil, paso diario).
     days = 0 → una sesión; 30,44 → un mes natural; 365,25 → doce meses. Devuelve [[entrada, resultado, salida]]. */
  function rollWin(p, days){
    var out = [], j = 0;
    for (var i = 1; i < p.length; i++){
      if (!days){ if (p[i][0] - p[i-1][0] <= 5 * 864e5) out.push([p[i-1][0], p[i][1] / p[i-1][1] - 1, p[i][0]]); continue; }
      var target = p[i][0] - days * 864e5; if (p[0][0] > target) continue;
      while (j + 1 < i && p[j+1][0] <= target) j++;
      if (target - p[j][0] > 12 * 864e5) continue;          // hueco en la serie: esa ventana no cuenta
      out.push([p[j][0], p[i][1] / p[j][1] - 1, p[i][0]]);
    }
    return out;
  }
  function worstOf(w){ if (!w.length) return null; var b = w[0]; for (var i = 1; i < w.length; i++) if (w[i][1] < b[1]) b = w[i]; return { r: b[1], tIn: b[0], tOut: b[2] }; }
  var HZ = { d: { days: 0, L: "Peor día", t: "un día" }, m: { days: 30.44, L: "Peor mes", t: "un mes" }, y: { days: 365.25, L: "Peor 12 meses", t: "12 meses" } };
  function rollAnn(me, N){ var o = [], w = 12 * N; for (var i = w; i < me.length; i++) o.push([me[i][0], Math.pow(me[i][1] / me[i-w][1], 1 / N) - 1]); return o; }
  function rollVol(me, N){ var r = [], o = [], w = 12 * N; for (var i = 1; i < me.length; i++) r.push(me[i][1] / me[i-1][1] - 1); for (i = w; i <= r.length; i++) o.push([me[i][0], sd(r.slice(i - w, i)) * Math.sqrt(12)]); return o; }
  function fullStats(series){     // medidas con TODO el historial del fondo (no solo el periodo común)
    var p = pts(series, -Infinity, Infinity); if (p.length < 2) return null;
    var st = stats(p), me = monthEnds(p), w = {};
    Object.keys(HZ).forEach(function(k){ w[k] = worstOf(rollWin(p, HZ[k].days)); });
    function rm(N){ var a = rollAnn(me, N); return a.length ? mean(a.map(function(x){ return x[1]; })) : null; }
    return { t0: p[0][0], ann: st.ann, vol: st.vol, mdd: st.mdd, sharpe: (st.ann != null && st.vol) ? st.ann / st.vol : null, w: w, r3: rm(3), r5: rm(5), r10: rm(10) };
  }
  function downMin(w, n){ if (w.length <= n) return w; var k = Math.ceil(w.length / n), o = []; for (var i = 0; i < w.length; i += k){ var b = w[i]; for (var j = i + 1; j < Math.min(w.length, i + k); j++) if (w[j][1] < b[1]) b = w[j]; o.push(b); } return o; }
  function hbar(id, o, vals, height, word){
    plot(id, [{ type: "bar", orientation: "h", y: o.map(function(it){ return clip(it.short, 26); }), x: vals.map(function(v){ return -v; }),
        marker: { color: o.map(function(it){ return it.color; }) }, text: vals.map(function(v){ return pct(v, 1); }), textposition: "outside", cliponaxis: false,
        textfont: { family: FONT, size: 12, color: INK }, hovertemplate: "<b>%{y}</b><br>" + word + " −%{x:.1%}<extra></extra>" }],
      base(height, { barcornerradius: 4, bargap: 0.4, margin: { l: 8, r: 12, t: 4, b: 8 }, hovermode: "closest",
        xaxis: { showticklabels: false, range: [0, Math.max.apply(null, vals.map(function(v){ return -v; }).concat([0.01])) * 1.2], zeroline: false },
        yaxis: { autorange: "reversed", showgrid: false, zeroline: false, tickfont: { color: INK, size: 12 }, tickmode: "linear", dtick: 1, automargin: true } }));
  }
  function plotLoss(id, items, height, single, mode){
    clear(id); var hz = HZ[mode];
    items.forEach(function(it){ it.w = rollWin(it.p, hz.days); it.wo = worstOf(it.w); });
    var ok = items.filter(function(it){ return it.wo; });
    if (!ok.length){ msg(id, "Hace falta más historial para ver " + hz.t + "."); return; }
    if (!single && ok.length > 4){ var o = ok.slice().sort(function(a, b){ return a.wo.r - b.wo.r; }); hbar(id, o, o.map(function(it){ return Math.min(it.wo.r, 0); }), height, hz.L); return; }
    var ann = [], lo = 0, hi = 0, data = [];
    ok.forEach(function(it){
      var q = downMin(it.w, 700), col = single ? NEG : it.color; if (it.wo.r < lo) lo = it.wo.r;
      if (single){ q.forEach(function(x){ if (x[1] > hi) hi = x[1]; }); data.push({ type: "scatter", mode: "lines", x: q.map(function(x){ return dISO(x[0]); }), y: q.map(function(x){ return Math.max(x[1], 0); }), line: { color: FAINT, width: 1 }, opacity: 0.35, hoverinfo: "skip" }); }
      data.push({ type: "scatter", mode: "lines", name: clip(it.short, 34), x: q.map(function(x){ return dISO(x[0]); }), y: q.map(function(x){ return Math.min(x[1], 0); }), customdata: q.map(function(x){ return x[1]; }),
        line: { color: col, width: 1.5, dash: it.dash ? "dash" : "solid" }, fill: (single || ok.length <= 2) ? "tozeroy" : "none", fillcolor: rgba(col, single ? 0.16 : 0.10), hovertemplate: "%{customdata:+.1%}" });
      if (it.wo.r < -0.0005) ann.push({ x: dISO(it.wo.tIn), y: it.wo.r, xref: "x", yref: "y", showarrow: true, arrowhead: 0, arrowwidth: 1, arrowcolor: col, ax: 0, ay: 18, bgcolor: rgba(SURF, 0.85),
        text: single ? "<b>" + hz.L + ": " + pct(it.wo.r, 1) + "</b>, entrando el " + dES(it.wo.tIn) : "<b>" + pct(it.wo.r, 1) + "</b>", font: { family: FONT, size: 11.5, color: single ? INK : col } });
    });
    lo = Math.min(lo, -0.004);
    plot(id, data, base(height, { hovermode: "x unified", annotations: ann, xaxis: { hoverformat: "Entrando el %d/%m/%Y", nticks: 7 },
      yaxis: { tickformat: "+.0%", range: [lo * 1.3, single ? Math.min(hi, -lo * 0.3) : -lo * 0.03] } }));
  }
  /* tarjeta «Caídas»: pérdida en ventana móvil a 12 meses / mes / día, o la clásica desde máximos */
  var DDM = [["y", "12 meses"], ["m", "Mes"], ["d", "Día"], ["x", "Desde máximos"]];
  function ddCard(pre){
    return '<div class="hf2card"><h3>Caídas <small id="' + pre + 'DDs"></small><span class="hf2seg sm" id="' + pre + 'DDm" style="margin-left:auto">' +
      DDM.map(function(o){ return '<button type="button" data-m="' + o[0] + '">' + o[1] + "</button>"; }).join("") + '</span></h3><div class="hf2mini" id="' + pre + 'DDk"></div><div class="hf2plot" id="' + pre + 'DD"></div></div>';
  }
  function ddBind(pre, S, again){ Array.prototype.forEach.call($(pre + "DDm").children, function(b){ b.addEventListener("click", function(){ S.dd = b.dataset.m; again(); }); }); }
  function ddRender(pre, items, single, H, S){
    var m = S.dd || "y";
    Array.prototype.forEach.call($(pre + "DDm").children, function(b){ b.className = b.dataset.m === m ? "on" : ""; });
    $(pre + "DDs").textContent = m === "x" ? "desde el máximo anterior" : "resultado de entrar cualquier día y mantener " + HZ[m].t;
    var k = $(pre + "DDk");
    if (single){
      var p = items[0].p, cell = function(l, v, t){ return "<div" + (t ? ' title="' + esc(t) + '"' : "") + "><span>" + l + "</span><b>" + v + "</b></div>"; };
      k.innerHTML = Object.keys(HZ).map(function(h){ var w = worstOf(rollWin(p, HZ[h].days)); return cell(HZ[h].L, w ? pct(Math.min(w.r, 0), 1) : "—", w ? "Entrando el " + dES(w.tIn) : "Sin historial suficiente"); }).join("") +
        cell("Máx. caída desde máximos", pct(items[0].st.mdd, 1), "De pico a valle, el " + dES(items[0].st.mddT));
      k.style.display = "";
    } else { k.innerHTML = ""; k.style.display = "none"; }
    if (m === "x") plotDrawdown(pre + "DD", items, H, single); else plotLoss(pre + "DD", items, H, single, m);
  }
  /* tarjeta «Rolling»: rentabilidad anualizada o volatilidad en ventanas móviles de N años */
  function rollCard(pre){
    return '<div class="hf2card"><h3><span id="' + pre + 'RLt">Rolling</span><span class="hf2seg sm" id="' + pre + 'RLm" style="margin-left:auto"><button type="button" data-m="r">Rentabilidad</button><button type="button" data-m="v">Volatilidad</button></span><span class="hf2seg sm" id="' + pre + 'RLn"></span></h3><div class="hf2plot" id="' + pre + 'RL"></div></div>';
  }
  function rollRender(pre, pAll, color, H, S, again){
    var me = monthEnds(pAll), span = (me.length - 1) / 12, opts = [1, 3, 5, 10].filter(function(N){ return span >= N + 1; }), nb = $(pre + "RLn"), mb = $(pre + "RLm");
    if (!mb.dataset.b){ mb.dataset.b = "1"; Array.prototype.forEach.call(mb.children, function(b){ b.addEventListener("click", function(){ S.rm = b.dataset.m; again(); }); }); }
    Array.prototype.forEach.call(mb.children, function(b){ b.className = b.dataset.m === (S.rm || "r") ? "on" : ""; });
    nb.innerHTML = "";
    if (!opts.length){ $(pre + "RLt").textContent = "Rolling"; msg(pre + "RL", "Hacen falta al menos dos años de historial."); return; }
    if (opts.indexOf(S.rn) < 0){ var good = opts.filter(function(N){ return span >= N * 1.5; }); S.rn = good.length ? good[good.length - 1] : opts[0]; }
    opts.forEach(function(N){ var b = h("button", S.rn === N ? "on" : "", N + "A"); b.type = "button"; b.addEventListener("click", function(){ S.rn = N; again(); }); nb.appendChild(b); });
    var isV = S.rm === "v", N = S.rn, s = isV ? rollVol(me, N) : rollAnn(me, N), avg = mean(s.map(function(x){ return x[1]; })), last = s[s.length - 1];
    $(pre + "RLt").innerHTML = (isV ? "Volatilidad" : "Rentabilidad") + " rolling a " + N + (N === 1 ? " año" : " años") + (!isV && N > 1 ? " <small>anualizada</small>" : "");
    clear(pre + "RL");
    var lo = Math.min.apply(null, s.map(function(x){ return x[1]; }).concat([0])), hi = Math.max.apply(null, s.map(function(x){ return x[1]; }).concat([0])), pad = (hi - lo || 0.05) * 0.1;
    plot(pre + "RL", [{ type: "scatter", mode: "lines", x: s.map(function(x){ return dISO(x[0]); }), y: s.map(function(x){ return x[1]; }), line: { color: color, width: 1.8 }, fill: "tozeroy", fillcolor: rgba(color, DARK ? 0.14 : 0.08),
        hovertemplate: (isV ? "%{y:.1%}" : "%{y:+.1%}") + "<extra></extra>" },
      { type: "scatter", mode: "markers", x: [dISO(last[0])], y: [last[1]], marker: { color: color, size: 7, line: { color: SURF, width: 1.5 } }, hoverinfo: "skip" }],
      base(H, { margin: { l: 46, r: 64, t: 8, b: 26 }, hovermode: "x unified", xaxis: { hoverformat: "%m/%Y", nticks: 7 }, yaxis: { tickformat: isV ? ".0%" : "+.0%", range: [lo - pad, hi + pad] },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, yref: "y", y0: avg, y1: avg, line: { color: FAINT, width: 1, dash: "dot" } }],
        annotations: [{ xref: "paper", x: 1, xanchor: "left", xshift: 8, yref: "y", y: last[1], showarrow: false, text: "<b>" + pct(last[1], 1, !isV) + "</b>", font: { family: FONT, size: 12, color: color } },
          { xref: "paper", x: 0, xanchor: "left", xshift: 4, yref: "y", y: avg, yshift: 9, showarrow: false, text: "Media " + pct(avg, 1, !isV), font: { family: FONT, size: 11, color: MUT } }] }));
  }
  function plotVolPN(id, series, height){
    var lv = pts(series, -Infinity, Infinity).map(function(x){ return { date: new Date(x[0]), nav: x[1] }; }), r = null;
    try{ r = (typeof yearlyVolPosNegFromLevels === "function") ? yearlyVolPosNegFromLevels(lv) : null; }catch(e){ r = null; }
    if (!r || !r.xs || !r.xs.length){ msg(id, "Sin datos suficientes."); return; }
    clear(id);
    var n = r.xs.length, a = Math.max(0, n - 12), xs = r.xs.slice(a).map(String), up = r.ysPos.slice(a).map(function(v){ return isFinite(v) ? v : null; }), dn = r.ysNegAbs.slice(a).map(function(v){ return isFinite(v) ? -v : null; });
    var mx = Math.max.apply(null, up.concat(dn.map(function(v){ return v == null ? 0 : -v; })).map(function(v){ return v || 0; })) || 0.1;
    function tr(y, col, nm){ return { type: "bar", name: nm, x: xs, y: y, marker: { color: col }, text: y.map(function(v){ return v == null ? "" : pct(Math.abs(v), 1); }), textposition: "outside", cliponaxis: false,
      textfont: { family: FONT, size: 11, color: INK }, hovertemplate: nm + " %{x}: %{text}<extra></extra>" }; }
    plot(id, [tr(up, PAL[0], "Al alza"), tr(dn, NEG, "A la baja")], base(height, { barmode: "relative", barcornerradius: 4, bargap: 0.32, margin: { l: 8, r: 8, t: 22, b: 26 }, xaxis: { type: "category" },
      yaxis: { showticklabels: false, showgrid: false, zerolinecolor: ZERO, range: [-mx * 1.3, mx * 1.3] },
      annotations: [{ xref: "paper", yref: "paper", x: 0, y: 1.08, xanchor: "left", showarrow: false, text: "<span style='color:" + PAL[0] + "'>■</span> días al alza   <span style='color:" + NEG + "'>■</span> días a la baja", font: { family: FONT, size: 11.5, color: MUT } }] }));
  }

  /* ======================================================================
     COMPARACIÓN
     ====================================================================== */
  var C = { sig: "", sort: null, asc: false, legacy: false, ymode: "r" };
  function cmpSlots(){
    var out = [];
    for (var i = 0; i < 10; i++){
      var src = (window.HF && HF.slotSource) ? HF.slotSource(i) : null; if (!src) continue;
      var info = (window.HF && HF.slotInfo && HF.slotInfo[i]) || null;
      var np = nameParts((info && info.name) || src.name || (src.meta && src.meta.name) || ("Fondo " + (i+1)));
      out.push({ slot: i, short: np.short, sub: np.sub, color: PAL[i % PAL.length], dash: i >= PAL.length, hidden: !!(window.CMP && CMP.hiddenSlots && CMP.hiddenSlots.has(i)),
                 start: info && info.start ? tOf({ date: info.start }) : null, isin: (info && info.isin) || "" });
    }
    return out;
  }
  function firstEmpty(){ for (var i = 0; i < 10; i++){ if (!(window.HF && HF.slotSource && HF.slotSource(i))) return i; } return -1; }
  function addFund(){ if (firstEmpty() < 0) return; if (window.HF2P) HF2P.open({ kind: "cmp" }); }
  function savedList(){ var s = $("savedAnSelect"), o = []; if (s) Array.prototype.forEach.call(s.options, function(x){ if (x.value) o.push({ v: x.value, t: x.textContent.trim() }); }); return o; }
  function loadSaved(v){ var s = $("savedAnSelect"); if (!s) return; s.value = v; s.dispatchEvent(new Event("change", { bubbles: true })); var b = $("savedAnLoad"); if (b) b.click(); }
  function setLegacy(on){ C.legacy = on; document.body.classList.toggle("hf2-legacy", on); if (on) setTimeout(function(){ window.dispatchEvent(new Event("resize")); }, 60); }

  function mountCmp(){
    var s2 = $("screen2"); if (!s2 || $("hf2Cmp")) return;
    var root = h("div", "hf2", ""); root.id = "hf2Cmp";
    root.innerHTML =
      '<div class="hf2bar"><div class="hf2chips" id="hf2Chips"></div>' +
      '<div class="hf2ctl"><div class="hf2seg" id="hf2Per"></div>' +
      '<div class="hf2rel"><button type="button" class="hf2icon txt" id="hf2DatesBtn" title="Fechas a medida">Fechas</button><div class="hf2pop" id="hf2DatesPop" hidden style="right:0;top:38px"><div class="dates"><label>Desde<input type="date" id="hf2D0"></label><label>Hasta<input type="date" id="hf2D1"></label></div></div></div>' +
      '<div class="hf2rel"><button type="button" class="hf2icon" id="hf2MenuBtn" title="Más opciones" aria-label="Más opciones">⋯</button><div class="hf2pop" id="hf2Menu" hidden style="right:0;top:38px"></div></div></div></div>' +
      '<div class="hf2hint" id="hf2Hint"></div><div id="hf2Body"></div>';
    s2.insertBefore(root, s2.firstChild);
    $("hf2DatesBtn").addEventListener("click", function(e){ e.stopPropagation(); $("hf2Menu").hidden = true; var p = $("hf2DatesPop"); p.hidden = !p.hidden; });
    $("hf2MenuBtn").addEventListener("click", function(e){ e.stopPropagation(); $("hf2DatesPop").hidden = true; buildMenu(); var p = $("hf2Menu"); p.hidden = !p.hidden; });
    ["hf2D0","hf2D1"].forEach(function(id, k){ $(id).addEventListener("change", function(){ var t = $(k ? "cmpEndDate" : "cmpStartDate"); if (!t || !this.value) return; t.value = this.value; t.dispatchEvent(new Event("change", { bubbles: true })); t.dispatchEvent(new Event("input", { bubbles: true })); }); });
    document.addEventListener("click", function(e){ ["hf2DatesPop","hf2Menu","hf2FMenu"].forEach(function(id){ var p = $(id); if (p && !p.hidden && !p.contains(e.target)) p.hidden = true; }); });
  }
  function buildMenu(){
    var m = $("hf2Menu"); m.innerHTML = "";
    var sv = savedList();
    if (sv.length){ m.appendChild(h("h6", "", "Análisis guardados")); sv.slice(0, 12).forEach(function(x){ var b = h("button", "it", esc(clip(x.t, 46))); b.type = "button"; b.addEventListener("click", function(){ m.hidden = true; loadSaved(x.v); }); m.appendChild(b); }); m.appendChild(h("hr")); }
    function item(txt, fn, admin){ var b = h("button", "it" + (admin ? " hf2-admin" : ""), txt); b.type = "button"; b.addEventListener("click", function(){ m.hidden = true; fn(); }); m.appendChild(b); }
    item("Guardar este análisis", function(){ var b = $("savedAnSaveNew"); if (b) b.click(); }, true);
    item("Exportar PDF", function(){ var b = $("s2ExportPdf"); if (b) b.click(); });
    item(C.legacy ? "Ocultar vista clásica" : "Vista clásica (matrices, rolling, CSV)", function(){ setLegacy(!C.legacy); C.sig = ""; }, true);
  }
  function range(){
    var a = $("cmpStartDate"), b = $("cmpEndDate"); if (!a || !b || !a.value || !b.value) return null;
    return [Date.parse(a.value + "T00:00:00Z"), Date.parse(b.value + "T00:00:00Z")];
  }
  function renderCmp(){
    var s2 = $("screen2"); if (!s2 || s2.classList.contains("hidden")) return;
    mountCmp();
    var slots = cmpSlots(), funds = (window.CMP && CMP.funds) || [], fs = (window.CMP && CMP.fundSlots) || [], rg = range();
    var sig = slots.map(function(s){ return s.slot + (s.hidden ? "h" : "") + s.short; }).join("|") + "#" + funds.length + "#" + (rg ? rg.join("-") : "") + "#" + savedList().length + "#" + C.sort + C.asc + C.ymode + (C.dd || "") + DARK + "#" + ($("hf2Body") ? $("hf2Body").clientWidth : 0);
    if (sig === C.sig) return; C.sig = sig;

    /* chips */
    var chips = $("hf2Chips"); chips.innerHTML = "";
    var vis = slots.filter(function(s){ return !s.hidden; });
    var lim = null, next = null;
    if (vis.length >= 2 && vis.every(function(s){ return s.start; })){ var so = vis.slice().sort(function(a,b){ return b.start - a.start; }); if ((so[0].start - so[1].start) / 864e5 / 365.25 >= 0.5){ lim = so[0]; next = so[1]; } }
    slots.forEach(function(s){
      var c = h("button", "hf2chip" + (s.hidden ? " off" : "") + (lim && lim.slot === s.slot ? " lim" : ""), '<i style="background:' + s.color + '"></i><span>' + esc(s.short) + '</span><b title="Quitar" aria-label="Quitar">×</b>');
      c.type = "button"; c.title = s.hidden ? "Mostrar " + s.short : "Ocultar " + s.short + " (se recalcula el periodo)";
      c.addEventListener("click", function(e){
        if (e.target.tagName === "B"){ if (typeof repoSlotClear === "function") repoSlotClear({ kind: "cmp", slot: s.slot, screenId: "screen2", role: "fund" }); return; }
        if (window.HF && HF.setHidden) HF.setHidden(s.slot, !s.hidden);
      });
      chips.appendChild(c);
    });
    if (slots.length && firstEmpty() >= 0){ var ad = h("button", "hf2add ghost", "+ Añadir fondo"); ad.type = "button"; ad.addEventListener("click", addFund); chips.appendChild(ad); }

    var body = $("hf2Body"), per = $("hf2Per"), hint = $("hf2Hint");
    if (!slots.length){
      per.innerHTML = ""; per.style.display = "none"; $("hf2DatesBtn").style.display = "none"; hint.innerHTML = "";
      var sv = savedList().slice(0, 4);
      body.innerHTML = '<div class="hf2empty"><h2>Compara fondos</h2><button type="button" class="hf2add" id="hf2EmptyAdd">+ Añadir fondo</button>' +
        (sv.length ? '<div class="sv"><h6>Análisis guardados</h6>' + sv.map(function(x, k){ return '<button type="button" data-k="' + k + '">' + esc(clip(x.t, 60)) + "</button>"; }).join("") + "</div>" : "") + "</div>";
      $("hf2EmptyAdd").addEventListener("click", addFund);
      Array.prototype.forEach.call(body.querySelectorAll(".sv button"), function(b){ b.addEventListener("click", function(){ loadSaved(sv[Number(b.dataset.k)].v); }); });
      return;
    }
    per.style.display = ""; $("hf2DatesBtn").style.display = "";
    if (!funds.length || !rg){ body.innerHTML = '<div class="hf2card"><div class="hf2msg">Cargando…</div></div>'; C.sig = ""; return; }

    /* periodo */
    var cs = CMP.range && CMP.range.commonStart ? CMP.range.commonStart.getTime() : rg[0], ce = CMP.range && CMP.range.commonEnd ? CMP.range.commonEnd.getTime() : rg[1];
    var spanY = (ce - cs) / 864e5 / 365.25, curY = (rg[1] - rg[0]) / 864e5 / 365.25, isMax = Math.abs(rg[0] - cs) < 4*864e5 && Math.abs(rg[1] - ce) < 4*864e5;
    per.innerHTML = "";
    [[1,"1A","cmpQuick1"],[3,"3A","cmpQuick3"],[5,"5A","cmpQuick5"],[10,"10A","cmpQuick10"],[0,"Máx","cmpQuickAll"]].forEach(function(o){
      if (o[0] && o[0] > spanY + 0.05) return;
      var on = o[0] ? (!isMax && Math.abs(curY - o[0]) < 0.06 && Math.abs(rg[1] - ce) < 4*864e5) : isMax;
      var b = h("button", on ? "on" : "", o[1]); b.type = "button"; b.addEventListener("click", function(){ var q = $(o[2]); if (q) q.click(); }); per.appendChild(b);
    });
    $("hf2D0").value = dISO(rg[0]); $("hf2D1").value = dISO(rg[1]);
    hint.innerHTML = "<span><b>" + dES(rg[0]) + " – " + dES(rg[1]) + "</b> · " + (curY >= 1 ? num(curY, 1) + " años" : Math.round(curY * 12) + " meses") + "</span>" +
      (lim ? "<span>·</span><span>El periodo común lo limita <b>" + esc(lim.short) + "</b>; sin él empezaría el " + dES(next.start) + ".</span><button type='button' id='hf2HideLim'>Ocultar</button>" : "") +
      (slots.length > vis.length ? "<span>·</span><button type='button' id='hf2ShowAll'>Mostrar todos</button>" : "");
    var hl = $("hf2HideLim"); if (hl) hl.addEventListener("click", function(){ HF.setHidden(lim.slot, true); });
    var sa = $("hf2ShowAll"); if (sa) sa.addEventListener("click", function(){ HF.showAll(); });

    /* datos por fondo visible */
    var bySlot = {}; slots.forEach(function(s){ bySlot[s.slot] = s; });
    var items = [];
    funds.forEach(function(f, k){
      var s = bySlot[fs[k] !== undefined ? fs[k] : k]; if (!s) return;
      var p = pts(ser(f), rg[0], rg[1]); if (p.length < 2) return;
      var st = stats(p), yr = years(ser(f));
      items.push({ f: f, slot: s.slot, short: s.short, sub: s.sub, color: s.color, dash: s.dash, p: p, st: st, yr: yr });
    });
    if (!items.length){ body.innerHTML = '<div class="hf2card"><div class="hf2msg">No hay datos en el periodo elegido.</div></div>'; return; }

    if (!$("hf2Evo")){
      body.innerHTML =
        '<div class="hf2card hf2sum" id="hf2Sum"></div>' +
        '<div class="hf2card"><h3>Evolución <small>rentabilidad acumulada · al final de cada línea, la anualizada del periodo</small></h3><div class="hf2plot" id="hf2Evo"></div></div>' +
        '<div class="hf2grid">' +
          '<div class="hf2card"><h3>Por año <span class="hf2seg sm" id="hf2YMode" style="margin-left:auto"><button type="button" data-m="r">Rentabilidad</button><button type="button" data-m="v">Volatilidad</button></span></h3><div id="hf2Years" style="overflow-x:auto"></div></div>' +
          ddCard("hf2") +
          '<div class="hf2card"><h3>Rentabilidad y riesgo <small>anualizada frente a volatilidad</small></h3><div class="hf2plot" id="hf2RR"></div></div>' +
          '<div class="hf2card"><h3>Correlación <small>rentabilidades mensuales</small></h3><div class="hf2plot" id="hf2Corr"></div></div>' +
        "</div>" +
        '<button type="button" class="hf2more hf2-admin" id="hf2More">Más análisis</button>';
      Array.prototype.forEach.call($("hf2YMode").children, function(b){ b.addEventListener("click", function(){ C.ymode = b.dataset.m; renderCmp(); }); });
      ddBind("hf2", C, function(){ renderCmp(); });
      $("hf2More").addEventListener("click", function(){ setLegacy(!C.legacy); this.textContent = C.legacy ? "Ocultar vista clásica" : "Más análisis"; if (C.legacy) setTimeout(function(){ var c = $("savedAnCard"); if (c) c.scrollIntoView({ behavior: "smooth" }); }, 120); });
    }

    /* tabla resumen: medidas desde el inicio de cada fondo + la anualizada del periodo mostrado */
    items.forEach(function(it){ var sr = ser(it.f); if (!it.f._hf2 || it.f._hf2n !== sr.length){ it.f._hf2 = fullStats(sr); it.f._hf2n = sr.length; } it.fs = it.f._hf2 || {}; });
    var cols = [["t0","Desde",0],["ann","Anualizada",1],["vol","Volatilidad",-1],["sharpe","Sharpe",1],["mdd","Máx. caída",1],["wy","Peor 12 meses",1],["wm","Peor mes",1],["r3","Rolling 3A",1],["r5","Rolling 5A",1],["r10","Rolling 10A",1],["pann","Anualizada",1]];
    var TIP = { t0: "Primera fecha con datos del fondo", ann: "Rentabilidad anualizada desde su primera fecha", vol: "Volatilidad anualizada con cierres mensuales, desde su primera fecha", sharpe: "Rentabilidad anualizada entre volatilidad (tipo sin riesgo 0 %)",
      mdd: "Mayor caída de pico a valle desde su primera fecha", wy: "Peor resultado de entrar cualquier día y mantener 12 meses", wm: "Peor resultado de entrar cualquier día y mantener un mes",
      r3: "Media de la rentabilidad anualizada en todas las ventanas de 3 años", r5: "Media de la rentabilidad anualizada en todas las ventanas de 5 años", r10: "Media de la rentabilidad anualizada en todas las ventanas de 10 años", pann: "Rentabilidad anualizada del periodo mostrado (acumulada si es menor de un año)" };
    function key(it, k){ var f = it.fs; return k === "wy" ? (f.w && f.w.y ? Math.min(f.w.y.r, 0) : null) : k === "wm" ? (f.w && f.w.m ? Math.min(f.w.m.r, 0) : null) : k === "pann" ? (it.st.ann != null ? it.st.ann : it.st.cum) : (f[k] == null ? null : f[k]); }
    var rows = items.slice();
    if (C.sort) rows.sort(function(a,b){ var x = key(a, C.sort), y = key(b, C.sort); if (x == null) return 1; if (y == null) return -1; return C.asc ? x - y : y - x; });
    var bestOf = {};
    if (items.length > 1) cols.forEach(function(c){ var k = c[0]; if (!c[2]) return; var v = items.map(function(it){ return key(it, k); }).filter(function(x){ return x != null; }); if (v.length < 2) return; bestOf[k] = c[2] < 0 ? Math.min.apply(null, v) : Math.max.apply(null, v); });
    var html = '<table class="hf2tbl"><thead><tr class="grp"><th></th><th colspan="10">Desde el inicio de cada fondo</th><th colspan="2">Periodo mostrado</th></tr><tr><th>Fondo</th>' +
      cols.map(function(c){ return '<th data-k="' + c[0] + '" title="' + TIP[c[0]] + '" class="' + (c[0] === "pann" ? "sepl " : "") + (C.sort === c[0] ? "s" + (C.asc ? " asc" : "") : "") + '">' + c[1] + "</th>"; }).join("") + "<th></th></tr></thead><tbody>";
    rows.forEach(function(it){
      html += '<tr><td><div class="nm"><i style="background:' + it.color + '"></i><span><b>' + esc(it.short) + "</b>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</span></div></td>";
      cols.forEach(function(c){
        var k = c[0], v = key(it, k), txt, cls = "";
        if (k === "t0") txt = v == null ? "—" : '<span class="mut">' + dES(v).slice(3) + "</span>";
        else if (k === "sharpe") txt = v == null ? "—" : num(v, 2);
        else if (k === "vol" || k === "mdd" || k === "wy" || k === "wm") txt = pct(v, 1);
        else { txt = pct(v, 1, true); cls = v == null ? "mut" : (v < 0 ? "neg" : (k === "ann" || k === "pann" ? "pos" : "")); }
        var isBest = v != null && bestOf[k] !== undefined && Math.abs(v - bestOf[k]) < 1e-12;
        html += '<td class="' + (k === "ann" ? "big " : "") + (k === "pann" ? "sepl " : "") + (isBest ? "best " : "") + cls + '">' + (isBest ? "<span>" + txt + "</span>" : txt) + "</td>";
      });
      html += '<td class="sp">' + spark(it.p, it.color) + "</td></tr>";
    });
    $("hf2Sum").innerHTML = html + "</tbody></table>";
    Array.prototype.forEach.call($("hf2Sum").querySelectorAll("th[data-k]"), function(th){ th.addEventListener("click", function(){ var k = th.dataset.k, low = (k === "vol" || k === "t0");
      if (C.sort === k){ if (C.asc === low){ C.asc = !C.asc; } else { C.sort = null; C.asc = false; } } else { C.sort = k; C.asc = low; } renderCmp(); }); });

    /* gráficos */
    var H1 = Math.max(300, Math.min(430, Math.round(window.innerHeight * 0.40))), H2 = 300;
    plotEvolution("hf2Evo", items, H1, false);
    ddRender("hf2", items, false, H2, C);

    /* rentabilidad por año: mapa de calor años × fondos */
    var isV = C.ymode === "v";
    Array.prototype.forEach.call($("hf2YMode").children, function(b){ b.className = b.dataset.m === C.ymode ? "on" : ""; });
    items.forEach(function(it){ it.yv = isV ? (it._yv || (it._yv = yearsVol(ser(it.f)))) : it.yr; });
    var allY = {}; items.forEach(function(it){ it.yv.forEach(function(y){ allY[y.y] = allY[y.y] || y; if (y.ytd) allY[y.y] = y; }); });
    var yl = Object.keys(allY).map(Number).sort().slice(-9);
    var ht = '<table class="hf2heat"><thead><tr><th></th>' + yl.map(function(y){ var o = allY[y]; return "<th" + (o.ytd ? ' class="ytd" title="Hasta el ' + dES(o.t) + '"' : "") + ">" + y + (o.ytd ? "*" : "") + "</th>"; }).join("") + "</tr></thead><tbody>";
    items.forEach(function(it){
      var m = {}; it.yv.forEach(function(y){ m[y.y] = y; });
      ht += "<tr><td title='" + esc(it.short) + "'><i style='background:" + it.color + "'></i>" + esc(clip(it.short, 26)) + "</td>" + yl.map(function(y){
        var o = m[y]; if (!o) return '<td class="na">–</td>';
        var a = Math.min(0.5, 0.07 + Math.abs(o.r) / 0.30 * 0.43) * (DARK ? 1.25 : 1), bg = isV ? rgba(PAL[0], (a * 0.8).toFixed(2)) : rgba(o.r >= 0 ? POS : NEG, a.toFixed(2));
        return '<td style="background:' + bg + '">' + pct(o.r, 1) + "</td>";
      }).join("") + "</tr>";
    });
    var ytd = yl.map(function(y){ return allY[y]; }).filter(function(o){ return o.ytd; })[0];
    $("hf2Years").innerHTML = ht + "</tbody></table>" + (ytd ? '<div style="font-size:11.5px;color:' + FAINT + ';margin:6px 4px 2px">* ' + ytd.y + (isV ? " incompleto" : " hasta el " + dES(ytd.t)) + "</div>" : "");

    /* rentabilidad y riesgo */
    var rr = items.filter(function(it){ return it.st.vol != null; });
    if (rr.length){
      clear("hf2RR");
      var useAnn = rr.every(function(it){ return it.st.ann != null; });
      var xs = rr.map(function(it){ return it.st.vol; }), yv = rr.map(function(it){ return useAnn ? it.st.ann : it.st.cum; });
      var xr = (Math.max.apply(null, xs) || 0.01), yr2 = (Math.max.apply(null, yv) - Math.min.apply(null, yv)) || 0.01, posn = [];
      var ord = rr.map(function(_, i){ return i; }).sort(function(a,b){ return yv[b] - yv[a]; });
      ord.forEach(function(i, k){
        var p = "top center";
        for (var q = 0; q < k; q++){ var j = ord[q]; if (Math.abs(xs[i]-xs[j]) < xr*0.26 && Math.abs(yv[i]-yv[j]) < yr2*0.24){ p = (posn[j] === "bottom center" || p === "bottom center" && posn[j] !== "top center") ? "middle right" : "bottom center"; } }
        posn[i] = p;
      });
      var hideT = {};   // en los grupos apretados solo se rotula el de arriba; el resto se identifica por color y al pasar el ratón
      if (rr.length > 4) ord.forEach(function(i, k){ for (var q = 0; q < k; q++){ var j = ord[q]; if (!hideT[j] && Math.abs(xs[i]-xs[j]) < xr*0.2 && Math.abs(yv[i]-yv[j]) < yr2*0.13){ hideT[i] = 1; break; } } });
      plot("hf2RR", rr.map(function(it, i){ return { type: "scatter", mode: "markers+text", x: [it.st.vol], y: [useAnn ? it.st.ann : it.st.cum], text: [hideT[i] ? "" : clip(it.short, 18)], textposition: posn[i], textfont: { family: FONT, size: 11.5, color: INK },
          marker: { color: it.color, size: 14, line: { color: SURF, width: 2 } }, hovertemplate: "<b>" + esc(it.short) + "</b><br>Rentabilidad %{y:+.1%}<br>Volatilidad %{x:.1%}<extra></extra>", cliponaxis: false }; }),
        base(H2, { margin: { l: 54, r: 24, t: 22, b: 40 }, hovermode: "closest",
          xaxis: { tickformat: ".0%", rangemode: "tozero", showgrid: true, gridcolor: HAIR, title: { text: "Volatilidad", font: { size: 11.5, color: FAINT }, standoff: 8 }, nticks: 7 },
          yaxis: { tickformat: "+.0%", title: { text: useAnn ? "Rentabilidad anualizada" : "Rentabilidad acumulada", font: { size: 11.5, color: FAINT }, standoff: 6 } } }));
    } else msg("hf2RR", "Hace falta al menos medio año de datos.");

    /* correlación */
    if (items.length < 2) msg("hf2Corr", "Añade otro fondo para ver la correlación.");
    else {
      var keys = Object.keys(items[0].st.mr).filter(function(k){ return items.every(function(it){ return k in it.st.mr; }); });
      if (keys.length < 12) msg("hf2Corr", "Hace falta al menos un año en común.");
      else {
        clear("hf2Corr");
        var R = items.map(function(it){ return keys.map(function(k){ return it.st.mr[k]; }); }), n = items.length, z = [], an = [];
        var labs = items.map(function(it){ return clip(it.short, n > 5 ? 14 : 20); });
        for (var i = 0; i < n; i++){ z.push([]); for (var j = 0; j < n; j++){
          var a = R[i], b = R[j], ma = a.reduce(function(s,x){ return s+x; },0)/a.length, mb = b.reduce(function(s,x){ return s+x; },0)/b.length, sab = 0, sa2 = 0, sb2 = 0;
          for (var q = 0; q < a.length; q++){ sab += (a[q]-ma)*(b[q]-mb); sa2 += (a[q]-ma)*(a[q]-ma); sb2 += (b[q]-mb)*(b[q]-mb); }
          var c = (sa2 > 0 && sb2 > 0) ? sab / Math.sqrt(sa2*sb2) : 0; z[i].push(i === j ? null : c);
          an.push({ x: j, y: i, text: i === j ? "" : num(c, 2), showarrow: false, font: { family: FONT, size: n > 6 ? 10.5 : 12, color: Math.abs(c) > 0.62 ? "#fff" : INK } });
        } }
        plot("hf2Corr", [{ type: "heatmap", z: z, x: labs.map(function(_, k){ return k; }), y: labs.map(function(_, k){ return k; }), zmin: -1, zmax: 1, xgap: 3, ygap: 3, showscale: false, hoverinfo: "skip",
            colorscale: [[0,PAL[1]],[0.5,MIDC],[1,PAL[0]]] }],
          base(H2, { margin: { l: 8, r: 10, t: 6, b: 8 }, annotations: an,
            xaxis: { tickmode: "array", tickvals: labs.map(function(_, k){ return k; }), ticktext: labs, tickangle: n > 4 ? -28 : 0, tickfont: { color: MUT, size: 11 }, side: "bottom" },
            yaxis: { tickmode: "array", tickvals: labs.map(function(_, k){ return k; }), ticktext: labs, autorange: "reversed", zeroline: false, showgrid: false, tickfont: { color: MUT, size: 11 } } }));
      }
    }
  }

  /* ======================================================================
     FONDO
     ====================================================================== */
  var F = { sig: "", per: 0, legacy: false };
  function fundName(){
    var e = $("hfS1Name"), sm = e ? e.querySelector("small") : null, raw = [e && e.firstChild ? e.firstChild.textContent : "", sm ? sm.textContent : ""];
    var np = nameParts(raw[0] || ""), sub = (raw[1] || "").split("·").map(function(x){ return x.trim(); }).filter(function(x){ return x && !BROKERS.test(x) && !/^(activo|gestionado|indexado)$/i.test(x); }).join(" · ");
    return { short: np.short, sub: [np.sub, sub].filter(Boolean).join(" · ") };
  }
  function pickFund(){ if (window.HF2P) HF2P.open({ kind: "screen1" }); }
  function mountFund(){
    var s1 = $("screen1"); if (!s1 || $("hf2Fund")) return;
    var root = h("div", "hf2", ""); root.id = "hf2Fund";
    root.innerHTML = '<div class="hf2bar"><div class="hf2chips" id="hf2FChips"></div><div class="hf2ctl"><div class="hf2seg" id="hf2FPer"></div>' +
      '<div class="hf2rel"><button type="button" class="hf2icon" id="hf2FMenuBtn" title="Más opciones" aria-label="Más opciones">⋯</button><div class="hf2pop" id="hf2FMenu" hidden style="right:0;top:38px"></div></div></div></div><div id="hf2FBody"></div>';
    s1.insertBefore(root, s1.firstChild);
    $("hf2FMenuBtn").addEventListener("click", function(e){
      e.stopPropagation(); var m = $("hf2FMenu"); m.innerHTML = "";
      function item(txt, fn, admin){ var b = h("button", "it" + (admin ? " hf2-admin" : ""), txt); b.type = "button"; b.addEventListener("click", function(){ m.hidden = true; fn(); }); m.appendChild(b); }
      item("Exportar PDF", function(){ var b = $("s1ExportPdf"); if (b) b.click(); });
      item(F.legacy ? "Ocultar vista clásica" : "Vista clásica (tablas, calidad, CSV)", function(){ F.legacy = !F.legacy; document.body.classList.toggle("hf2-legacy", F.legacy); F.sig = ""; setTimeout(function(){ window.dispatchEvent(new Event("resize")); }, 60); }, true);
      m.hidden = !m.hidden;
    });
  }
  function renderFund(){
    var s1 = $("screen1"); if (!s1 || s1.classList.contains("hidden")) return;
    mountFund();
    var st0 = window.STATE || {}, series = (st0.dailySeries && st0.dailySeries.length >= 2) ? st0.dailySeries : (st0.series || []);
    var loaded = document.body.dataset.s1 === "1" && series.length >= 2, nm = fundName();
    var sig = (loaded ? series.length + "@" + tOf(series[series.length-1]) + nm.short : "0") + "#" + F.per + (F.dd || "") + (F.rm || "") + (F.rn || "") + DARK + "#" + ($("hf2FBody") ? $("hf2FBody").clientWidth : 0);
    if (sig === F.sig) return; F.sig = sig;
    var chips = $("hf2FChips"), per = $("hf2FPer"), body = $("hf2FBody"); chips.innerHTML = "";
    if (!loaded){
      per.style.display = "none"; $("hf2FMenuBtn").parentElement.style.display = "none";
      body.innerHTML = '<div class="hf2empty"><h2>Analiza un fondo</h2><button type="button" class="hf2add" id="hf2FEmptyAdd">Elegir fondo</button></div>';
      $("hf2FEmptyAdd").addEventListener("click", pickFund); return;
    }
    per.style.display = ""; $("hf2FMenuBtn").parentElement.style.display = "";
    var c = h("button", "hf2chip", '<i style="background:' + PAL[0] + '"></i><span>' + esc(nm.short) + "</span><b style='font-size:11px' aria-hidden='true'>▾</b>"); c.type = "button"; c.title = "Cambiar de fondo"; c.style.paddingRight = "8px"; c.addEventListener("click", pickFund); chips.appendChild(c);
    var all = pts(series, -Infinity, Infinity), tEnd = all[all.length-1][0], spanY = (tEnd - all[0][0]) / 864e5 / 365.25;
    if (F.per && F.per > spanY + 0.05) F.per = 0;
    per.innerHTML = "";
    [[1,"1A"],[3,"3A"],[5,"5A"],[10,"10A"],[0,"Máx"]].forEach(function(o){ if (o[0] && o[0] > spanY + 0.05) return; var b = h("button", F.per === o[0] ? "on" : "", o[1]); b.type = "button"; b.addEventListener("click", function(){ F.per = o[0]; renderFund(); }); per.appendChild(b); });
    var t0 = F.per ? tEnd - F.per * 365.25 * 864e5 : -Infinity, p = all.filter(function(x){ return x[0] >= t0; }), st = stats(p), yr = years(series);
    var wy = worstOf(rollWin(p, HZ.y.days)), sharpe = (st.ann != null && st.vol) ? st.ann / st.vol : null;
    function kpi(l, v, cls, tip){ return '<div class="hf2kpi"' + (tip ? ' title="' + tip + '"' : "") + "><span>" + l + "</span><b" + (cls ? ' class="' + cls + '"' : "") + ">" + v + "</b></div>"; }
    if (!$("hf2FEvo")){
      body.innerHTML = '<div class="hf2head"><div><h1 id="hf2FName"></h1><p id="hf2FSub"></p></div><div class="hf2kpis" id="hf2FKpis"></div></div>' +
        '<div class="hf2card"><h3>Evolución <small>rentabilidad acumulada en el periodo</small></h3><div class="hf2plot" id="hf2FEvo"></div></div>' +
        '<div class="hf2grid"><div class="hf2card"><h3>Rentabilidad por año</h3><div class="hf2plot" id="hf2FYears"></div></div>' +
        '<div class="hf2card"><h3>Volatilidad por año <small>anualizada, separando días al alza y a la baja</small></h3><div class="hf2plot" id="hf2FVol"></div></div>' +
        ddCard("hf2F") + rollCard("hf2F") + "</div>";
      ddBind("hf2F", F, function(){ F.sig = ""; renderFund(); });
    }
    $("hf2FName").textContent = nm.short;
    $("hf2FSub").textContent = [nm.sub, dES(p[0][0]) + " – " + dES(tEnd)].filter(Boolean).join("  ·  ");
    $("hf2FKpis").innerHTML = (st.ann != null ? kpi("Anualizada", pct(st.ann, 1, true), st.ann < 0 ? "neg" : "pos") : "") + kpi("Acumulada", pct(st.cum, Math.abs(st.cum) >= 1 ? 0 : 1, true), st.ann == null ? (st.cum < 0 ? "neg" : "pos") : "") +
      kpi("Volatilidad", pct(st.vol, 1), "", "Anualizada, con cierres mensuales") + (sharpe != null ? kpi("Sharpe", num(sharpe, 2), "", "Rentabilidad anualizada entre volatilidad (tipo sin riesgo 0 %)") : "") +
      kpi("Máx. caída", pct(st.mdd, 1), "", "De pico a valle") + kpi("Peor 12 meses", wy ? pct(Math.min(wy.r, 0), 1) : "—", "", wy ? "Entrando el " + dES(wy.tIn) : "Sin historial suficiente");
    var it = { short: nm.short, color: PAL[0], p: p, st: st };
    var H1 = Math.max(300, Math.min(420, Math.round(window.innerHeight * 0.40))), H2 = 290;
    plotEvolution("hf2FEvo", [it], H1, true);
    ddRender("hf2F", [it], true, H2 - 40, F);
    rollRender("hf2F", all, PAL[0], H2, F, function(){ F.sig = ""; renderFund(); });
    plotVolPN("hf2FVol", series, H2);
    var yy = yr.slice(-12);
    if (yy.length){
      clear("hf2FYears");
      plot("hf2FYears", [{ type: "bar", x: yy.map(function(y){ return String(y.y) + (y.ytd ? "*" : ""); }), y: yy.map(function(y){ return y.r; }),
          marker: { color: yy.map(function(y){ return rgba(y.r >= 0 ? PAL[0] : NEG, y.ytd ? 0.45 : 1); }) },
          text: yy.map(function(y){ return pct(y.r, 1); }), textposition: "outside", textfont: { family: FONT, size: 11.5, color: INK }, cliponaxis: false,
          hovertemplate: "%{x}: %{y:+.1%}<extra></extra>" }],
        base(H2, { barcornerradius: 4, bargap: 0.32, margin: { l: 8, r: 8, t: 8, b: yy[yy.length-1].ytd ? 44 : 26 }, xaxis: { type: "category" },
          yaxis: (function(){ var mx = Math.max.apply(null, yy.map(function(y){ return y.r; }).concat([0])), mn = Math.min.apply(null, yy.map(function(y){ return y.r; }).concat([0])), sp = (mx - mn) || 0.1;
            return { showticklabels: false, showgrid: false, zerolinecolor: ZERO, range: [mn - sp * (mn < 0 ? 0.16 : 0.02), mx + sp * 0.16] }; })(),
          annotations: yy[yy.length-1].ytd ? [{ xref: "paper", yref: "paper", x: 0, y: -0.2, xanchor: "left", showarrow: false, text: "* " + yy[yy.length-1].y + " hasta el " + dES(yy[yy.length-1].t), font: { family: FONT, size: 11.5, color: FAINT } }] : [] }));
    } else msg("hf2FYears", "Aún no hay años completos.");
  }

  /* ---------------- tema claro / oscuro ---------------- */
  function setTheme(dark, save){
    palette(dark); document.body.classList.toggle("hf-dark", !!dark); document.documentElement.style.colorScheme = dark ? "dark" : "light";
    C.sig = ""; F.sig = ""; if (window.HF2B) HF2B.state.sig = "";
    var b = $("hf2Theme"); if (b){ b.setAttribute("aria-pressed", dark ? "true" : "false"); b.title = dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"; b.innerHTML = '<span aria-hidden="true">' + (dark ? "☾" : "☀") + "</span>" + (dark ? "Oscuro" : "Claro"); }
    if (save) try{ localStorage.setItem("hf_theme", dark ? "dark" : "light"); }catch(_){ }
  }
  function initTheme(){
    var pref = null; try{ pref = localStorage.getItem("hf_theme"); }catch(_){ }
    var dark = pref ? pref === "dark" : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var cb = $("hfClienteBtn");
    if (cb && !$("hf2Theme")){ var b = document.createElement("button"); b.type = "button"; b.id = "hf2Theme"; b.className = "hfTop__btn"; cb.parentNode.insertBefore(b, cb); b.addEventListener("click", function(){ setTheme(!DARK, true); tick(); }); }
    setTheme(dark, false);
  }

  /* ---------------- ciclo ---------------- */
  function tick(){ try{ renderCmp(); }catch(e){ console.warn("[HF2] cmp", e); } try{ renderFund(); }catch(e){ console.warn("[HF2] fund", e); } try{ if (window.HF2B) HF2B.render(); }catch(e){ console.warn("[HF2] bt", e); } }
  window.HF2 = { tick: tick, state: { C: C, F: F }, setTheme: setTheme,
    lib: { $: $, esc: esc, h: h, val: val, ser: ser, tOf: tOf, dES: dES, dISO: dISO, num: num, pct: pct, clip: clip, nameParts: nameParts, pts: pts, stats: stats, years: years, yearsVol: yearsVol, spark: spark, base: base, plot: plot, msg: msg, clear: clear,
      plotEvolution: plotEvolution, ddCard: ddCard, ddBind: ddBind, ddRender: ddRender, rollCard: rollCard, rollRender: rollRender, monthEnds: monthEnds, rollWin: rollWin, worstOf: worstOf, HZ: HZ, rgba: rgba,
      th: function(){ return { PAL: PAL, INK: INK, MUT: MUT, FAINT: FAINT, HAIR: HAIR, POS: POS, NEG: NEG, SURF: SURF, ZERO: ZERO, DARK: DARK, FONT: FONT }; } } };
  function start(){ initTheme(); tick(); setInterval(tick, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
