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
  function pct(x, d, sign){ if (x == null || !isFinite(x)) return "—"; var dd = d == null ? 1 : d, s = num(Math.abs(x)*100, dd) + "%"; if (Number(num(Math.abs(x)*100, dd).replace(",", ".")) === 0) return s; return (x < 0 ? "−" : (sign ? "+" : "")) + s; }
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
    items.forEach(function(it){ var o = 1 + (it.off || 0); it.g = down(it.p, 900).map(function(x){ return [x[0], o * x[1]/it.p[0][1] - 1]; }); it.g.forEach(function(x){ if (x[1] < lo) lo = x[1]; if (x[1] > hi) hi = x[1]; }); it.end = it.g[it.g.length-1][1];
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
        line: { color: it.color, width: it.lw || (single ? 2.2 : 2), shape: "linear", dash: it.dash ? (typeof it.dash === "string" ? it.dash : "dash") : "solid" }, hovertemplate: "%{customdata:+.1%}" };
      if (single && !it.idx){ t.fill = "tozeroy"; t.fillcolor = rgba(PAL[0], DARK ? 0.14 : 0.08); }
      if (it.idx) t.hovertemplate = "%{customdata:+.1%} <span style='color:" + MUT + "'>índice</span>";
      return t;
    });
    var ann = order.map(function(it, k){
      if (it.idx && it.off) return null;   // índice que empieza más tarde: su anualizada no es comparable
      return { xref: "paper", x: 1, xanchor: "left", xshift: 8, yref: "y", y: ys[k], yanchor: "middle", showarrow: false, align: "left",
               text: "<b>" + (it.lab != null ? pct(it.lab, 1, true) + "</b>" + (single && !it.idx ? " anual" : "") : pct(it.end, 1, true) + "</b>"), font: { family: FONT, size: 12, color: it.color } };
    });
    var last = order.map(function(it){ return { type: "scatter", mode: "markers", x: [dISO(it.g[it.g.length-1][0])], y: [useLog ? 1 + it.end : it.end], marker: { color: it.color, size: 7, line: { color: SURF, width: 1.5 } }, hoverinfo: "skip" }; });
    plot(id, data.concat(last), base(height, {
      margin: { l: 50, r: single ? 96 : 66, t: 8, b: 26 }, hovermode: "x unified", annotations: ann.filter(Boolean),
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
  /* medidas con TODO el historial del fondo (no solo el periodo común). Definiciones:
     ann = anualizada desde el primer dato; vol = desviación de las rentabilidades mensuales × √12 desde el inicio;
     mddM = máx. caída de pico a valle con cierres de fin de mes; sharpe = ann / vol (tipo sin riesgo 0 %);
     sh5 = media del Sharpe de todas las ventanas de 5 años (paso mensual); rN = media de la anualizada en ventanas de N años;
     vN = media de la volatilidad en ventanas de N años; ddN(f) = máx. caída en los últimos N años con cierres de frecuencia f. */
  function fullStats(series){
    var p = pts(series, -Infinity, Infinity); if (p.length < 2) return null;
    var st = stats(p), me = monthEnds(p);
    function rm(N){ var a = rollAnn(me, N); return a.length ? mean(a.map(function(x){ return x[1]; })) : null; }
    function vm(N){ var a = rollVol(me, N); return a.length ? mean(a.map(function(x){ return x[1]; })) : null; }
    var ra5 = rollAnn(me, 5), rv5 = rollVol(me, 5), sh = [];
    for (var i = 0; i < Math.min(ra5.length, rv5.length); i++) if (rv5[i][1] > 0) sh.push(ra5[i][1] / rv5[i][1]);
    var lastT = p[p.length - 1][0], memo = {};
    function ddN(N, f){
      var key = N + f; if (key in memo) return memo[key];
      var q = p;
      if (N){ var cut = lastT - N * 365.25 * 864e5; if (p[0][0] > cut + 31 * 864e5) return (memo[key] = null); q = p.filter(function(x){ return x[0] >= cut; }); }
      return (memo[key] = q.length >= 2 ? ddOf(resample(q, f)).mdd : null);
    }
    return { t0: p[0][0], ann: st.ann, vol: st.vol, mdd: st.mdd, mddM: ddOf(resample(p, "m")).mdd, sharpe: (st.ann != null && st.vol) ? st.ann / st.vol : null, sh5: sh.length ? mean(sh) : null,
             r3: rm(3), r5: rm(5), r10: rm(10), v3: vm(3), v5: vm(5), v10: vm(10), ddN: ddN, p: p };
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
  /* tarjeta «Caídas desde máximos»: siempre de pico a valle; el conmutador cambia la frecuencia de los cierres
     (todos / fin de mes / fin de trimestre / fin de año). Cada serie remuestreada es un subconjunto de la diaria,
     así que la caída diaria ≥ mensual ≥ trimestral ≥ anual. */
  var DDF = [["d", "Diario", "Diaria", "todos los cierres"], ["m", "Mensual", "Mensual", "cierres de fin de mes"], ["q", "Trimestral", "Trimestral", "cierres de fin de trimestre"], ["a", "Anual", "Anual", "cierres de fin de año"]];
  function resample(p, f){
    if (f === "d" || p.length < 2) return p;
    var o = [p[0]], k = null;
    for (var i = 1; i < p.length; i++){
      var d = new Date(p[i][0]), y = d.getUTCFullYear(), m = d.getUTCMonth(), kk = f === "m" ? y * 12 + m : f === "q" ? y * 4 + Math.floor(m / 3) : y;
      if (kk === k) o[o.length - 1] = p[i]; else { o.push(p[i]); k = kk; }
    }
    return o;
  }
  function ddOf(q){
    var pk = -Infinity, tp = null, m = 0, a = null, b = null, c = [];
    q.forEach(function(x){ if (x[1] > pk){ pk = x[1]; tp = x[0]; } var d = x[1] / pk - 1; c.push([x[0], d]); if (d < m){ m = d; a = tp; b = x[0]; } });
    return { mdd: m, tP: a, tV: b, c: c };
  }
  function ddAll(p){ var o = {}; DDF.forEach(function(f){ o[f[0]] = ddOf(resample(p, f[0])); }); return o; }
  function ddCard(pre){
    return '<div class="hf2card"><h3>Caídas desde máximos <small id="' + pre + 'DDs"></small><span class="hf2seg sm" id="' + pre + 'DDm" style="margin-left:auto">' +
      DDF.map(function(o){ return '<button type="button" data-m="' + o[0] + '">' + o[1] + "</button>"; }).join("") + '</span></h3><div class="hf2ddw"><div class="hf2plot" id="' + pre + 'DD"></div><div class="hf2dds" id="' + pre + 'DDk"></div></div></div>';
  }
  function ddBind(pre, S, again){ Array.prototype.forEach.call($(pre + "DDm").children, function(b){ b.addEventListener("click", function(){ S.dd = b.dataset.m; again(); }); }); }
  function sd2(t){ return t == null ? "" : dES(t).slice(0, 6) + dES(t).slice(8); }
  function ddRender(pre, items, single, H, S, again){
    var m = S.dd; if (!DDF.some(function(f){ return f[0] === m; })) m = S.dd = "m";
    var F0 = DDF.filter(function(f){ return f[0] === m; })[0];
    Array.prototype.forEach.call($(pre + "DDm").children, function(b){ b.className = b.dataset.m === m ? "on" : ""; });
    $(pre + "DDs").textContent = F0[3];
    items.forEach(function(it){ it.dda = ddAll(it.p); });
    var k = $(pre + "DDk");
    if (single){
      var d = items[0].dda;
      k.className = "hf2dds one";
      k.innerHTML = DDF.map(function(f){ var x = d[f[0]]; return '<button type="button" class="r' + (f[0] === m ? " on" : "") + '" data-m="' + f[0] + '"><span>' + f[2] + "</span><b>" + pct(x.mdd, 1) + "</b><small>" + (x.tP != null && x.mdd < 0 ? sd2(x.tP) + " a " + sd2(x.tV) : "sin caídas") + "</small></button>"; }).join("");
    } else {
      /* con más de 4 fondos, solo la tabla (barra en la frecuencia elegida); con menos, curvas + tabla al lado */
      var big = items.length > 4, worst = Math.min.apply(null, items.map(function(it){ return it.dda[m].mdd; }).concat([-0.01]));
      k.className = "hf2dds many" + (big ? " big" : "");
      var rows = big ? items.slice().sort(function(a, b){ return a.dda[m].mdd - b.dda[m].mdd; }) : items;
      k.innerHTML = '<table><thead><tr><th></th>' + DDF.map(function(f){ return '<th class="' + (f[0] === m ? "on" : "") + '" data-m="' + f[0] + '" title="' + f[3] + '">' + (big ? f[2] : f[2].slice(0, 3) + ".") + "</th>"; }).join("") + "</tr></thead><tbody>" +
        rows.map(function(it){ return '<tr><td title="' + esc(it.short) + '"><i style="background:' + it.color + '"></i>' + esc(clip(it.short, big ? 30 : 14)) + "</td>" + DDF.map(function(f){ var x = it.dda[f[0]], on = f[0] === m;
          return '<td class="' + (on ? "on" : "") + '" title="' + (x.tP != null && x.mdd < 0 ? "De " + dES(x.tP) + " a " + dES(x.tV) : "") + '">' + (big && on ? '<u style="width:' + Math.round(x.mdd / worst * 100) + "%;background:" + it.color + '"></u>' : "") + "<span>" + pct(x.mdd, 1) + "</span></td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>" +
        (big ? '<div class="hf2foot">Pasa el ratón por una cifra para ver las fechas de pico y valle.</div>' : "");
    }
    Array.prototype.forEach.call(k.querySelectorAll("[data-m]"), function(b){ b.addEventListener("click", function(){ S.dd = b.dataset.m; if (again) again(); }); });
    var id = pre + "DD"; clear(id);
    $(id).style.display = (!single && items.length > 4) ? "none" : "";
    if (!single && items.length > 4) return;
    var lo = 0, ann = [];
    var data = items.map(function(it){
      var c = it.dda[m].c, q = m === "d" ? downMin(c, 700) : c, col = single ? NEG : it.color; if (it.dda[m].mdd < lo) lo = it.dda[m].mdd;
      var t = { type: "scatter", mode: "lines", name: clip(it.short, 34), x: q.map(function(x){ return dISO(x[0]); }), y: q.map(function(x){ return x[1]; }),
        line: { color: col, width: 1.6, dash: it.dash ? "dash" : "solid", shape: m === "d" ? "linear" : "hv" }, hovertemplate: "%{y:.1%}" };
      if (single || items.length <= 2){ t.fill = "tozeroy"; t.fillcolor = rgba(col, single ? 0.12 : 0.10); }
      var w = it.dda[m];
      if (w.mdd < -0.005) ann.push({ x: dISO(w.tV), y: w.mdd, xref: "x", yref: "y", text: "<b>" + pct(w.mdd, 1) + "</b>", showarrow: true, arrowhead: 0, arrowwidth: 1, arrowcolor: col, ax: 0, ay: 16, font: { family: FONT, size: 11.5, color: col }, bgcolor: rgba(SURF, 0.85) });
      return t;
    });
    plot(id, data, base(H, { hovermode: "x unified", annotations: items.length <= 4 ? ann : [], margin: { l: 46, r: 10, t: 8, b: 26 }, xaxis: { hoverformat: m === "d" ? "%d/%m/%Y" : "%m/%Y", nticks: 6 },
      yaxis: { tickformat: ".0%", range: [Math.min(-0.02, lo) * 1.22, 0.004], zeroline: false } }));
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
      '<button type="button" class="hf2icon txt" id="hf2IdxBtn" title="Mostrar el índice de referencia de cada fondo en el gráfico de evolución" aria-pressed="false">Índices</button>' +
      '<div class="hf2rel"><button type="button" class="hf2icon txt" id="hf2DatesBtn" title="Fechas a medida">Fechas</button><div class="hf2pop" id="hf2DatesPop" hidden style="right:0;top:38px"><div class="dates"><label>Desde<input type="date" id="hf2D0"></label><label>Hasta<input type="date" id="hf2D1"></label></div></div></div>' +
      '<div class="hf2rel"><button type="button" class="hf2icon" id="hf2MenuBtn" title="Más opciones" aria-label="Más opciones">⋯</button><div class="hf2pop" id="hf2Menu" hidden style="right:0;top:38px"></div></div></div></div>' +
      '<div class="hf2hint" id="hf2Hint"></div><div id="hf2Body"></div>';
    s2.insertBefore(root, s2.firstChild);
    $("hf2IdxBtn").addEventListener("click", function(){ if (window.HF2I){ HF2I.cmpOn = !HF2I.cmpOn; HF2I.bump(); } });
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
  /* ---------------- ficha (catálogo): patrimonio y coste ---------------- */
  function isinOk(x){ return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(x || ""); }
  function info(isin){ return (isin && window.HF2P && HF2P.info) ? (HF2P.info(isin) || {}) : {}; }
  /* el coste es el MISMO dato para todos: TER si lo tienen todos; si no, comisión de gestión si la tienen todos;
     si tampoco, la medida con más cobertura (y guion donde falte) */
  function costOf(isins){
    var nt = isins.filter(function(i){ return info(i).ter != null; }).length, ng = isins.filter(function(i){ return info(i).cg != null; }).length, n = isins.length;
    var k = nt === n ? "ter" : ng === n ? "cg" : (nt >= ng ? "ter" : "cg");
    return { k: k, lab: k === "ter" ? "TER" : "Com. gestión", tip: (k === "ter" ? "Gastos corrientes (TER) anuales, del catálogo" : "Comisión de gestión anual, del catálogo") + (k === "cg" && nt < n ? ". Se muestra la comisión de gestión porque no todos los fondos tienen TER" : "") + ((k === "ter" ? nt : ng) < n ? ". Guion: sin dato en el catálogo" : ""),
             v: function(isin){ var x = info(isin)[k]; return x == null ? null : x / 100; } };
  }
  function fmtAum(v){ if (v == null) return "—"; return (v >= 1000 ? Math.round(v).toLocaleString("es-ES", { useGrouping: true }).replace(/ /g, ".") : num(v, v >= 10 ? 0 : 1)) + " M€"; }
  function yr(t){ return t == null ? "" : String(new Date(t).getUTCFullYear()); }
  function sw(color, dash){ return dash ? '<svg width="16" height="8" aria-hidden="true"><line x1="0" y1="4" x2="16" y2="4" stroke="' + color + '" stroke-width="2" stroke-dasharray="' + (dash === "dot" ? "2 3" : "5 3") + '"/></svg>' : '<i style="background:' + color + '"></i>'; }
  var IDXDASH = ["dash", "dot", "dashdot", "longdash"];

  /* ejes del gráfico rentabilidad-riesgo */
  var RRO = [["r3", "Rentab. rolling 3A", "+"], ["r5", "Rentab. rolling 5A", "+"], ["r10", "Rentab. rolling 10A", "+"], ["ann", "Rentab. anualizada desde inicio", "+"],
             ["v3", "Volatilidad media 3A", ""], ["v5", "Volatilidad media 5A", ""], ["v10", "Volatilidad media 10A", ""], ["vol", "Volatilidad desde inicio", ""],
             ["d3", "Máx. caída 3A", ""], ["d5", "Máx. caída 5A", ""], ["d10", "Máx. caída 10A", ""], ["d0", "Máx. caída desde inicio", ""], ["fee", "Coste anual", ""]];
  var RRTIP = { r: "media de la rentabilidad anualizada de todas las ventanas de N años", v: "media de la volatilidad (mensual × √12) de todas las ventanas de N años", d: "de pico a valle en los últimos N años" };
  function rrVal(it, k, f, cost){
    var fs = it.fs || {};
    if (k === "fee") return cost.v(it.isin);
    if (k.charAt(0) === "d"){ var N = Number(k.slice(1)); return fs.ddN ? fs.ddN(N, f) : null; }
    return fs[k] == null ? null : fs[k];
  }

  function renderCmp(){
    var s2 = $("screen2"); if (!s2 || s2.classList.contains("hidden")) return;
    mountCmp();
    var I = window.HF2I || { ver: 0, cmpOn: false };
    var slots = cmpSlots(), funds = (window.CMP && CMP.funds) || [], fs = (window.CMP && CMP.fundSlots) || [], rg = range();
    var sig = slots.map(function(s){ return s.slot + (s.hidden ? "h" : "") + s.short; }).join("|") + "#" + funds.length + "#" + (rg ? rg.join("-") : "") + "#" + savedList().length + "#" + C.sort + C.asc + C.ymode + (C.dd || "") + C.rx + C.ry + C.rrf + C.cn + DARK + "#" + I.ver + (I.cmpOn ? "i" : "") + "#" + ($("hf2Body") ? $("hf2Body").clientWidth : 0);
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

    var body = $("hf2Body"), per = $("hf2Per"), hint = $("hf2Hint"), ib = $("hf2IdxBtn");
    if (!slots.length){
      per.innerHTML = ""; per.style.display = "none"; $("hf2DatesBtn").style.display = "none"; ib.style.display = "none"; hint.innerHTML = "";
      var sv = savedList().slice(0, 4);
      body.innerHTML = '<div class="hf2empty"><h2>Compara fondos</h2><button type="button" class="hf2add" id="hf2EmptyAdd">+ Añadir fondo</button>' +
        (sv.length ? '<div class="sv"><h6>Análisis guardados</h6>' + sv.map(function(x, k){ return '<button type="button" data-k="' + k + '">' + esc(clip(x.t, 60)) + "</button>"; }).join("") + "</div>" : "") + "</div>";
      $("hf2EmptyAdd").addEventListener("click", addFund);
      Array.prototype.forEach.call(body.querySelectorAll(".sv button"), function(b){ b.addEventListener("click", function(){ loadSaved(sv[Number(b.dataset.k)].v); }); });
      return;
    }
    per.style.display = ""; $("hf2DatesBtn").style.display = ""; ib.style.display = ""; ib.className = "hf2icon txt" + (I.cmpOn ? " on" : ""); ib.setAttribute("aria-pressed", I.cmpOn ? "true" : "false");
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
      (slots.length > vis.length ? "<span>·</span><button type='button' id='hf2ShowAll'>Mostrar todos</button>" : "");
    var sa = $("hf2ShowAll"); if (sa) sa.addEventListener("click", function(){ HF.showAll(); });

    /* datos por fondo visible */
    var bySlot = {}; slots.forEach(function(s){ bySlot[s.slot] = s; });
    var items = [];
    funds.forEach(function(f, k){
      var s = bySlot[fs[k] !== undefined ? fs[k] : k]; if (!s) return;
      var p = pts(ser(f), rg[0], rg[1]); if (p.length < 2) return;
      var st = stats(p), yr2 = years(ser(f));
      items.push({ f: f, slot: s.slot, short: s.short, sub: s.sub, color: s.color, dash: s.dash, p: p, st: st, yr: yr2, isin: isinOk(s.isin) ? s.isin : "" });
    });
    if (!items.length){ body.innerHTML = '<div class="hf2card"><div class="hf2msg">No hay datos en el periodo elegido.</div></div>'; return; }

    if (!$("hf2Evo")){
      body.innerHTML =
        '<div class="hf2card hf2sum" id="hf2Sum"></div>' +
        '<div class="hf2card"><h3>Evolución <small>rentabilidad acumulada · al final de cada línea, la anualizada del periodo</small></h3><div class="hf2plot" id="hf2Evo"></div><div class="hf2leg" id="hf2Leg"></div></div>' +
        '<div class="hf2grid">' +
          '<div class="hf2card"><h3>Por año <span class="hf2seg sm" id="hf2YMode" style="margin-left:auto"><button type="button" data-m="r">Rentabilidad</button><button type="button" data-m="v">Volatilidad</button></span></h3><div id="hf2Years" style="overflow-x:auto"></div></div>' +
          ddCard("hf2") +
          '<div class="hf2card"><h3>Rentabilidad y riesgo <span class="hf2axes"><label>Vertical <select class="hf2sel sm" id="hf2RRy"></select></label><label>Horizontal <select class="hf2sel sm" id="hf2RRx"></select></label><span class="hf2seg sm" id="hf2RRf"></span></span></h3><div class="hf2plot" id="hf2RR"></div><div class="hf2foot" id="hf2RRF"></div></div>' +
          '<div class="hf2card"><h3>Correlación <small>rentabilidades mensuales</small><span class="hf2seg sm" id="hf2CN" style="margin-left:auto"></span></h3><div class="hf2plot" id="hf2Corr"></div><div class="hf2foot" id="hf2CorrF"></div></div>' +
        "</div>" +
        '<button type="button" class="hf2more hf2-admin" id="hf2More">Más análisis</button>';
      Array.prototype.forEach.call($("hf2YMode").children, function(b){ b.addEventListener("click", function(){ C.ymode = b.dataset.m; renderCmp(); }); });
      ddBind("hf2", C, function(){ renderCmp(); });
      ["hf2RRx", "hf2RRy"].forEach(function(id, k){ var e = $(id); e.innerHTML = RRO.map(function(o){ return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join(""); e.addEventListener("change", function(){ C[k ? "ry" : "rx"] = this.value; renderCmp(); }); });
      $("hf2More").addEventListener("click", function(){ setLegacy(!C.legacy); this.textContent = C.legacy ? "Ocultar vista clásica" : "Más análisis"; if (C.legacy) setTimeout(function(){ var c = $("savedAnCard"); if (c) c.scrollIntoView({ behavior: "smooth" }); }, 120); });
    }

    /* medidas desde el inicio de cada fondo + índice de referencia */
    items.forEach(function(it){ var sr = ser(it.f); if (!it.f._hf2 || it.f._hf2n !== sr.length){ it.f._hf2 = fullStats(sr); it.f._hf2n = sr.length; } it.fs = it.f._hf2 || {};
      it.ix = it.isin && window.HF2I ? HF2I.choice(it.isin) : { spec: "", src: "none" };
      var ip = it.ix.spec ? HF2I.series(it.ix.spec) : [];
      it.ip = ip; it.xs = ip && ip.length && it.fs.p ? HF2I.excess(it.fs.p, ip) : null; });
    var cost = costOf(items.map(function(it){ return it.isin; }));
    var cols = [["t0","Inicio",0],["aum","Patrimonio",0],["fee",cost.lab,-1],["ann","Anualizada",1],["vol","Volatilidad",-1],["mddM","Máx. caída",1],["sharpe","Sharpe",1],["sh5","Sharpe 5A",1],["r3","Rolling 3A",1],["r5","Rolling 5A",1],["r10","Rolling 10A",1],["xs","vs índice",1]];
    var TIP = { t0: "Año del primer dato del fondo", aum: "Patrimonio del fondo (todas sus clases), en millones de euros, del catálogo", fee: cost.tip, ann: "Rentabilidad anualizada desde su primer dato", vol: "Volatilidad media desde el inicio: desviación de las rentabilidades mensuales × √12",
      mddM: "Mayor caída de pico a valle desde el inicio, con cierres de fin de mes", sharpe: "Rentabilidad anualizada entre volatilidad desde el inicio (tipo sin riesgo 0 %)", sh5: "Media del Sharpe de todas las ventanas de 5 años (paso mensual, tipo sin riesgo 0 %)",
      r3: "Media de la rentabilidad anualizada en todas las ventanas de 3 años", r5: "Media de la rentabilidad anualizada en todas las ventanas de 5 años", r10: "Media de la rentabilidad anualizada en todas las ventanas de 10 años",
      xs: "Anualizada del fondo menos la de su índice de referencia, en el tramo en que existen los dos. Pulsa para cambiar el índice" };
    function key(it, k){ var f = it.fs; return k === "aum" ? (info(it.isin).aum == null ? null : info(it.isin).aum) : k === "fee" ? cost.v(it.isin) : k === "xs" ? (it.xs ? it.xs.d : null) : (f[k] == null ? null : f[k]); }
    var rows = items.slice();
    if (C.sort) rows.sort(function(a,b){ var x = key(a, C.sort), y = key(b, C.sort); if (x == null) return 1; if (y == null) return -1; return C.asc ? x - y : y - x; });
    var bestOf = {};
    if (items.length > 1) cols.forEach(function(c){ var k = c[0]; if (!c[2]) return; var v = items.map(function(it){ return key(it, k); }).filter(function(x){ return x != null; }); if (v.length < 2) return; bestOf[k] = c[2] < 0 ? Math.min.apply(null, v) : Math.max.apply(null, v); });
    var wide = ($("hf2Body").clientWidth || 1200) >= 1320;
    var html = '<table class="hf2tbl"><thead><tr class="grp"><th></th><th colspan="3">Ficha</th><th colspan="8">Desde el inicio de cada fondo</th><th class="sepl">Índice</th>' + (wide ? "<th></th>" : "") + '</tr><tr><th>Fondo</th>' +
      cols.map(function(c){ return '<th data-k="' + c[0] + '" title="' + esc(TIP[c[0]]) + '" class="' + (c[0] === "xs" || c[0] === "ann" ? "sepl " : "") + (C.sort === c[0] ? "s" + (C.asc ? " asc" : "") : "") + '">' + c[1] + "</th>"; }).join("") + (wide ? "<th></th>" : "") + "</tr></thead><tbody>";
    rows.forEach(function(it){
      html += '<tr><td><div class="nm two"><i style="background:' + it.color + '"></i><span><b title="' + esc(it.short) + '">' + esc(clip(it.short, 30)) + "</b>" + (it.sub ? "<small>" + esc(clip(it.sub, 34)) + "</small>" : "") + "</span></div></td>";
      cols.forEach(function(c){
        var k = c[0], v = key(it, k), txt, cls = "";
        if (k === "t0") txt = v == null ? "—" : '<span class="mut">' + yr(v) + "</span>";
        else if (k === "aum") txt = v == null ? '<span class="mut">—</span>' : fmtAum(v);
        else if (k === "fee") txt = v == null ? '<span class="mut">—</span>' : num(v * 100, 2) + " %";
        else if (k === "sharpe" || k === "sh5") txt = v == null ? '<span class="mut">—</span>' : num(v, 2);
        else if (k === "vol" || k === "mddM") txt = pct(v, 1);
        else if (k === "xs"){
          if (!it.isin){ html += '<td class="sepl mut">—</td>'; return; }
          var lab = it.ix.spec ? HF2I.short(it.ix.spec) : "elegir índice", load = it.ix.spec && it.ip === null;
          txt = '<button type="button" class="hf2idxc" data-hf2idx="' + esc(it.isin) + '" data-n="' + esc(it.short) + '" title="' + esc((it.ix.spec ? HF2I.label(it.ix.spec) + (it.ix.src === "sugerido" ? " · sugerido (" + it.ix.why + ")" : "") : "Sin índice") + ". Pulsa para cambiarlo") + '">' +
            '<b class="' + (v == null ? "mut" : Math.abs(v) < 0.0005 ? "" : v < 0 ? "neg" : "pos") + '">' + (load ? "…" : (v == null ? "—" : pct(v, 1, true))) + "</b><small>" + esc(clip(lab, 18)) + (it.ix.src === "sugerido" && it.ix.spec ? " ·&nbsp;sug." : "") + "</small></button>";
          var isB = v != null && bestOf.xs !== undefined && Math.abs(v - bestOf.xs) < 1e-12;
          html += '<td class="sepl idx' + (isB ? " best" : "") + '">' + txt + "</td>"; return;
        }
        else { txt = pct(v, 1, true); cls = v == null ? "mut" : (v < 0 ? "neg" : (k === "ann" ? "pos" : "")); }
        var isBest = v != null && bestOf[k] !== undefined && Math.abs(v - bestOf[k]) < 1e-12;
        html += '<td class="' + (k === "ann" ? "big sepl " : "") + (isBest ? "best " : "") + cls + '">' + (isBest ? "<span>" + txt + "</span>" : txt) + "</td>";
      });
      html += (wide ? '<td class="sp">' + spark(it.p, it.color) + "</td>" : "") + "</tr>";
    });
    $("hf2Sum").innerHTML = html + "</tbody></table>" +
      '<div class="hf2foot">Volatilidad: rentabilidades mensuales × √12 · Máx. caída: de pico a valle con cierres de fin de mes · Sharpe con tipo sin riesgo 0 % · Sharpe 5A y rolling: media de todas las ventanas · ' + esc(cost.lab) + ": del catálogo</div>";
    Array.prototype.forEach.call($("hf2Sum").querySelectorAll("th[data-k]"), function(th){ th.addEventListener("click", function(){ var k = th.dataset.k, low = (k === "vol" || k === "t0" || k === "fee");
      if (C.sort === k){ if (C.asc === low){ C.asc = !C.asc; } else { C.sort = null; C.asc = false; } } else { C.sort = k; C.asc = low; } renderCmp(); }); });
    if (window.HF2I) HF2I.bind($("hf2Sum"));

    /* evolución + índices (no limitan el periodo) + leyenda */
    var H1 = Math.max(300, Math.min(430, Math.round(window.innerHeight * 0.40))), H2 = 300;
    var evo = items.slice(), idxs = [], warn = [];
    if (I.cmpOn && window.HF2I){
      var seen = {};
      items.forEach(function(it){ var sp = it.ix.spec; if (!sp || seen[sp]) return; seen[sp] = 1;
        var ip = HF2I.series(sp); if (!ip || !ip.length) return;
        var q = ip.filter(function(x){ return x[0] >= rg[0] - 20 * 864e5 && x[0] <= rg[1]; }); if (q.length < 2) { warn.push(HF2I.label(sp) + " no tiene datos en el periodo"); return; }
        var w = HF2I.cover(ip, rg[0], rg[1]); if (w) warn.push(HF2I.label(sp) + " " + w);
        idxs.push({ short: HF2I.label(sp), color: MUT, dash: IDXDASH[idxs.length % IDXDASH.length], lw: 1.4, p: q, st: stats(q), idx: true }); });
      evo = evo.concat(idxs);
    }
    plotEvolution("hf2Evo", evo, H1, false);
    var t0By = {}; funds.forEach(function(f, k){ var s = fs[k] !== undefined ? fs[k] : k, a = ser(f); if (a.length) t0By[s] = tOf(a[0]); });
    var leg = slots.map(function(s){ var t = s.start || t0By[s.slot];
      return '<button type="button" class="it' + (s.hidden ? " off" : "") + (lim && lim.slot === s.slot ? " lim" : "") + '" data-s="' + s.slot + '" title="' + (s.hidden ? "Mostrar " : "Ocultar ") + esc(s.short) + (s.hidden ? "" : " (se recalcula el periodo común)") + '">' + sw(s.color) + "<span><b>" + esc(clip(s.short, 30)) + "</b><small>" + (t ? yr(t) : "") + "</small></span></button>"; }).join("") +
      idxs.map(function(x){ return '<span class="it ix">' + sw(MUT, x.dash) + "<span><b>" + esc(clip(x.short, 34)) + "</b><small>índice</small></span></span>"; }).join("");
    var nY = lim ? (lim.start - next.start) / 864e5 / 365.25 : 0;
    var note = lim ? "Periodo común desde <b>" + yr(cs) + "</b> · lo limita <b>" + esc(lim.short) + "</b>; sin él, desde " + yr(next.start) + " (+" + (nY >= 1 ? Math.round(nY) + (Math.round(nY) === 1 ? " año" : " años") : Math.round(nY * 12) + " meses") + ') <button type="button" id="hf2HideLim">Ocultarlo</button>'
      : "Periodo común desde <b>" + yr(cs) + "</b>";
    $("hf2Leg").innerHTML = '<div class="its">' + leg + '</div><div class="nt">' + note + (warn.length ? '<span class="w">' + esc(warn.join(" · ")) + "</span>" : "") + "</div>";
    Array.prototype.forEach.call($("hf2Leg").querySelectorAll("button.it"), function(b){ b.addEventListener("click", function(){ var s = bySlot[Number(b.dataset.s)]; if (s && window.HF && HF.setHidden) HF.setHidden(s.slot, !s.hidden); }); });
    var hl = $("hf2HideLim"); if (hl) hl.addEventListener("click", function(){ HF.setHidden(lim.slot, true); });

    ddRender("hf2", items, false, H2 - 30, C, function(){ renderCmp(); });

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

    /* rentabilidad y riesgo con ejes a elegir */
    C.rx = C.rx || "v5"; C.ry = C.ry || "r5"; C.rrf = C.rrf || "m";
    $("hf2RRx").value = C.rx; $("hf2RRy").value = C.ry;
    var needF = C.rx.charAt(0) === "d" && C.rx !== "d" || C.ry.charAt(0) === "d", fsg = $("hf2RRf");
    fsg.style.display = needF ? "" : "none";
    fsg.innerHTML = needF ? DDF.map(function(f){ return '<button type="button" data-m="' + f[0] + '" title="Máx. caída con ' + f[3] + '" class="' + (C.rrf === f[0] ? "on" : "") + '">' + f[1].charAt(0) + "</button>"; }).join("") : "";
    Array.prototype.forEach.call(fsg.children, function(b){ b.addEventListener("click", function(){ C.rrf = b.dataset.m; renderCmp(); }); });
    function axLab(k){ var o = RRO.filter(function(x){ return x[0] === k; })[0]; var t = o[1]; if (k === "fee") t = cost.lab + " anual"; if (k.charAt(0) === "d") t += " (" + DDF.filter(function(f){ return f[0] === C.rrf; })[0][3].replace("cierres de ", "cierres ") + ")"; return t; }
    function axTip(k){ var c = k.charAt(0); if (k === "ann" || k === "vol" || k === "fee") return ""; return RRTIP[c] ? RRTIP[c].replace("N años", k.slice(1) === "0" ? "todo el historial" : k.slice(1) + " años") : ""; }
    var rr = [], miss = [];
    items.forEach(function(it){ var x = rrVal(it, C.rx, C.rrf, cost), y = rrVal(it, C.ry, C.rrf, cost); if (x == null || y == null) miss.push(it.short); else rr.push({ it: it, x: x, y: y }); });
    var fmtA = function(k){ return k.charAt(0) === "r" || k === "ann" ? "+.1%" : ".1%"; };
    if (rr.length){
      clear("hf2RR");
      var xs = rr.map(function(o){ return o.x; }), yv = rr.map(function(o){ return o.y; });
      var xr = (Math.max.apply(null, xs) - Math.min.apply(null, xs.concat([0]))) || 0.01, yr2 = (Math.max.apply(null, yv) - Math.min.apply(null, yv)) || 0.01, posn = [];
      var ord = rr.map(function(_, i){ return i; }).sort(function(a,b){ return yv[b] - yv[a]; });
      ord.forEach(function(i, k){
        var p = "top center";
        for (var q = 0; q < k; q++){ var j = ord[q]; if (Math.abs(xs[i]-xs[j]) < xr*0.26 && Math.abs(yv[i]-yv[j]) < yr2*0.24){ p = (posn[j] === "bottom center" || p === "bottom center" && posn[j] !== "top center") ? "middle right" : "bottom center"; } }
        posn[i] = p;
      });
      var hideT = {};
      if (rr.length > 4) ord.forEach(function(i, k){ for (var q = 0; q < k; q++){ var j = ord[q]; if (!hideT[j] && Math.abs(xs[i]-xs[j]) < xr*0.2 && Math.abs(yv[i]-yv[j]) < yr2*0.13){ hideT[i] = 1; break; } } });
      var xNeg = xs.every(function(v){ return v <= 0; });
      plot("hf2RR", rr.map(function(o, i){ return { type: "scatter", mode: "markers+text", x: [o.x], y: [o.y], text: [hideT[i] ? "" : clip(o.it.short, 18)], textposition: posn[i], textfont: { family: FONT, size: 11.5, color: INK },
          marker: { color: o.it.color, size: 14, line: { color: SURF, width: 2 } }, hovertemplate: "<b>" + esc(o.it.short) + "</b><br>" + esc(axLab(C.ry)) + " %{y:" + fmtA(C.ry) + "}<br>" + esc(axLab(C.rx)) + " %{x:" + fmtA(C.rx) + "}<extra></extra>", cliponaxis: false }; }),
        base(H2, { margin: { l: 54, r: 24, t: 22, b: 40 }, hovermode: "closest",
          xaxis: { tickformat: C.rx === "fee" ? ".1%" : fmtA(C.rx).replace(".1", ".0"), rangemode: xNeg ? "normal" : "tozero", showgrid: true, gridcolor: HAIR, title: { text: axLab(C.rx), font: { size: 11.5, color: FAINT }, standoff: 8 }, nticks: 7 },
          yaxis: { tickformat: C.ry === "fee" ? ".1%" : fmtA(C.ry).replace(".1", ".0"), title: { text: axLab(C.ry), font: { size: 11.5, color: FAINT }, standoff: 6 } } }));
    } else msg("hf2RR", "Ningún fondo tiene historial suficiente para estos ejes.");
    var tipx = [axTip(C.ry) ? "Vertical: " + axTip(C.ry) : "", axTip(C.rx) ? "Horizontal: " + axTip(C.rx) : ""].filter(Boolean).join(" · ");
    $("hf2RRF").innerHTML = esc(tipx) + (miss.length ? (tipx ? "<br>" : "") + "Sin dato: " + esc(miss.join(", ")) : "");

    /* correlación: rentabilidades mensuales de los últimos N años (o todo lo común) con el historial completo */
    var cn = $("hf2CN"); C.cn = C.cn || 5;
    cn.innerHTML = [[3,"3A"],[5,"5A"],[10,"10A"],[0,"Todo"]].map(function(o){ return '<button type="button" data-n="' + o[0] + '" class="' + (C.cn === o[0] || (o[0] === 0 && C.cn === "all") ? "on" : "") + '">' + o[1] + "</button>"; }).join("");
    Array.prototype.forEach.call(cn.children, function(b){ b.addEventListener("click", function(){ C.cn = Number(b.dataset.n) || "all"; renderCmp(); }); });
    $("hf2CorrF").innerHTML = "";
    if (items.length < 2) msg("hf2Corr", "Añade otro fondo para ver la correlación.");
    else {
      items.forEach(function(it){ it.mrAll = it.fs && it.fs.p ? (it._mrA || (it._mrA = monthlyRets(it.fs.p))) : {}; });
      var lastM = items.map(function(it){ var k = Object.keys(it.mrAll).sort(); return k[k.length - 1] || ""; }).sort()[0];
      var keysC, inC = items, out = [];
      if (C.cn === "all"){ keysC = Object.keys(items[0].mrAll).filter(function(k){ return k <= lastM && items.every(function(it){ return k in it.mrAll; }); }).sort(); }
      else {
        var y0 = Number(lastM.slice(0, 4)), m0 = Number(lastM.slice(5, 7)), win = [];
        for (var q = 0; q < C.cn * 12; q++){ var mm = m0 - q, yy = y0; while (mm <= 0){ mm += 12; yy--; } win.push(yy + "-" + String(mm).padStart(2, "0")); }
        inC = items.filter(function(it){ return win.every(function(k){ return k in it.mrAll; }); });
        out = items.filter(function(it){ return inC.indexOf(it) < 0; });
        keysC = win.reverse();
      }
      if (out.length) $("hf2CorrF").textContent = "Sin " + C.cn + " años de historia: " + out.map(function(it){ return it.short; }).join(", ");
      if (inC.length < 2) msg("hf2Corr", "Hacen falta al menos dos fondos con " + C.cn + " años de historia.");
      else if (keysC.length < 12) msg("hf2Corr", "Hace falta al menos un año en común.");
      else {
        clear("hf2Corr");
        if (C.cn === "all") $("hf2CorrF").textContent = "Todo el tramo común: " + keysC.length + " meses desde " + keysC[0].slice(5) + "/" + keysC[0].slice(0, 4);
        var R = inC.map(function(it){ return keysC.map(function(k){ return it.mrAll[k]; }); }), n = inC.length, z = [], an = [];
        var labs = inC.map(function(it){ return clip(it.short, n > 5 ? 14 : 20); });
        for (var i = 0; i < n; i++){ z.push([]); for (var j = 0; j < n; j++){
          var a = R[i], b = R[j], ma = a.reduce(function(s,x){ return s+x; },0)/a.length, mb = b.reduce(function(s,x){ return s+x; },0)/b.length, sab = 0, sa2 = 0, sb2 = 0;
          for (var q2 = 0; q2 < a.length; q2++){ sab += (a[q2]-ma)*(b[q2]-mb); sa2 += (a[q2]-ma)*(a[q2]-ma); sb2 += (b[q2]-mb)*(b[q2]-mb); }
          var c = (sa2 > 0 && sb2 > 0) ? sab / Math.sqrt(sa2*sb2) : 0; z[i].push(i === j ? null : c);
          an.push({ x: j, y: i, text: i === j ? "" : num(c, 2), showarrow: false, font: { family: FONT, size: n > 6 ? 10.5 : 12, color: Math.abs(c) > 0.62 ? "#fff" : INK } });
        } }
        plot("hf2Corr", [{ type: "heatmap", z: z, x: labs.map(function(_, k){ return k; }), y: labs.map(function(_, k){ return k; }), zmin: -1, zmax: 1, xgap: 3, ygap: 3, showscale: false, hoverinfo: "skip",
            colorscale: [[0,PAL[1]],[0.5,MIDC],[1,PAL[0]]] }],
          base(H2 - 20, { margin: { l: 8, r: 10, t: 6, b: 8 }, annotations: an,
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
    var isin = String(st0.sourceKey || "").split("|")[1] || ""; if (!isinOk(isin)) isin = "";
    var I = window.HF2I || { ver: 0 };
    var sig = (loaded ? series.length + "@" + tOf(series[series.length-1]) + nm.short + isin : "0") + "#" + F.per + (F.dd || "") + (F.rm || "") + (F.rn || "") + DARK + "#" + I.ver + "#" + ($("hf2FBody") ? $("hf2FBody").clientWidth : 0);
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
    var sharpe = (st.ann != null && st.vol) ? st.ann / st.vol : null;
    /* índice de referencia: no limita el periodo; si empieza más tarde, arranca a la altura del fondo */
    var ix = isin && window.HF2I ? HF2I.choice(isin) : { spec: "", src: "none" }, ip = ix.spec ? HF2I.series(ix.spec) : [], ipP = [], xs = null, cov = "", idxIt = null;
    if (ip && ip.length){
      ipP = ip.filter(function(x){ return x[0] >= p[0][0] - 20 * 864e5 && x[0] <= tEnd; });
      cov = HF2I.cover(ip, p[0][0], tEnd);
      if (ipP.length >= 2){
        var off = 0; if (ipP[0][0] > p[0][0] + 20 * 864e5){ var fv = null; p.forEach(function(x){ if (x[0] <= ipP[0][0]) fv = x[1]; }); off = fv ? fv / p[0][1] - 1 : 0; }
        idxIt = { short: HF2I.label(ix.spec), color: MUT, dash: true, lw: 1.5, p: ipP, st: stats(ipP), idx: true, off: off };
        xs = HF2I.excess(p, ipP);
      }
    }
    function kpi(l, v, cls, tip){ return '<div class="hf2kpi"' + (tip ? ' title="' + tip + '"' : "") + "><span>" + l + "</span><b" + (cls ? ' class="' + cls + '"' : "") + ">" + v + "</b></div>"; }
    if (!$("hf2FEvo")){
      body.innerHTML = '<div class="hf2head"><div><h1 id="hf2FName"></h1><p id="hf2FSub"></p><div class="hf2idxrow" id="hf2FIdx"></div></div><div class="hf2kpis" id="hf2FKpis"></div></div>' +
        '<div class="hf2card"><h3>Evolución <small id="hf2FEvoS">rentabilidad acumulada en el periodo</small></h3><div class="hf2plot" id="hf2FEvo"></div></div>' +
        '<div class="hf2grid"><div class="hf2card"><h3>Rentabilidad por año</h3><div class="hf2plot" id="hf2FYears"></div></div>' +
        '<div class="hf2card"><h3>Volatilidad por año <small>anualizada, separando días al alza y a la baja</small></h3><div class="hf2plot" id="hf2FVol"></div></div>' +
        ddCard("hf2F") + rollCard("hf2F") + "</div>";
      ddBind("hf2F", F, function(){ F.sig = ""; renderFund(); });
    }
    $("hf2FIdx").innerHTML = isin && window.HF2I ? '<span>Índice de referencia</span>' + HF2I.button(isin, nm.short) : "";
    if (window.HF2I) HF2I.bind($("hf2FIdx"));
    $("hf2FEvoS").innerHTML = "rentabilidad acumulada en el periodo" + (idxIt ? ' · <span class="hf2dsh"></span> ' + esc(idxIt.short) : "") + (ix.spec && ip === null ? " · cargando índice…" : "") + (cov ? ' · <span class="w">el índice ' + esc(cov) + "</span>" : "");
    $("hf2FName").textContent = nm.short;
    $("hf2FSub").textContent = [nm.sub, dES(p[0][0]) + " – " + dES(tEnd)].filter(Boolean).join("  ·  ");
    $("hf2FKpis").innerHTML = (st.ann != null ? kpi("Anualizada", pct(st.ann, 1, true), st.ann < 0 ? "neg" : "pos") : "") + kpi("Acumulada", pct(st.cum, Math.abs(st.cum) >= 1 ? 0 : 1, true), st.ann == null ? (st.cum < 0 ? "neg" : "pos") : "") +
      kpi("Volatilidad", pct(st.vol, 1), "", "Anualizada, con cierres mensuales") + (sharpe != null ? kpi("Sharpe", num(sharpe, 2), "", "Rentabilidad anualizada entre volatilidad (tipo sin riesgo 0 %)") : "") +
      kpi("Máx. caída", pct(st.mdd, 1), "", "De pico a valle con cierres diarios") +
      (isin ? kpi("vs índice", xs ? pct(xs.d, 1, true) : "—", xs && Math.abs(xs.d) >= 0.0005 ? (xs.d < 0 ? "neg" : "pos") : "", xs ? "Anualizada del fondo (" + pct(xs.f, 1, true) + ") menos la del índice (" + pct(xs.i, 1, true) + ") del " + dES(xs.t0) + " al " + dES(xs.t1) : "Sin índice o sin un año de datos en común") : "");
    var it = { short: nm.short, color: PAL[0], p: p, st: st };
    var H1 = Math.max(300, Math.min(420, Math.round(window.innerHeight * 0.40))), H2 = 290;
    plotEvolution("hf2FEvo", idxIt ? [it, idxIt] : [it], H1, true);
    ddRender("hf2F", [it], true, H2 - 30, F, function(){ F.sig = ""; renderFund(); });
    rollRender("hf2F", all, PAL[0], H2, F, function(){ F.sig = ""; renderFund(); });
    plotVolPN("hf2FVol", series, H2);
    var yy = yr.slice(-12);
    if (yy.length){
      clear("hf2FYears");
      var iy = {}, hasI = false;
      if (ip && ip.length) years(ip.map(function(x){ return { date: new Date(x[0]), value: x[1] }; })).forEach(function(o){ iy[o.y] = o.r; });
      var yiv = yy.map(function(y){ var v = iy[y.y]; if (v != null && !y.ytd) hasI = true; return y.ytd ? null : (v == null ? null : v); });
      var trs = [{ type: "bar", name: nm.short, x: yy.map(function(y){ return String(y.y) + (y.ytd ? "*" : ""); }), y: yy.map(function(y){ return y.r; }),
          marker: { color: yy.map(function(y){ return rgba(y.r >= 0 ? PAL[0] : NEG, y.ytd ? 0.45 : 1); }) },
          text: yy.map(function(y){ return pct(y.r, 1); }), textposition: "outside", constraintext: "none", textfont: { family: FONT, size: hasI ? 10.5 : 11.5, color: INK }, cliponaxis: false,
          hovertemplate: "%{x}: %{y:+.1%}<extra></extra>" }];
      if (hasI) trs.push({ type: "bar", name: "Índice", x: yy.map(function(y){ return String(y.y) + (y.ytd ? "*" : ""); }), y: yiv, marker: { color: rgba(FAINT, DARK ? 0.55 : 0.45) },
          hovertemplate: "%{x} índice: %{y:+.1%}<extra></extra>" });
      var allv = yy.map(function(y){ return y.r; }).concat(yiv.filter(function(v){ return v != null; }));
      plot("hf2FYears", trs,
        base(H2, { barcornerradius: 4, bargap: hasI ? 0.22 : 0.32, bargroupgap: 0.06, barmode: "group", margin: { l: 8, r: 8, t: 8, b: yy[yy.length-1].ytd || hasI ? 44 : 26 }, xaxis: { type: "category" },
          yaxis: (function(){ var mx = Math.max.apply(null, allv.concat([0])), mn = Math.min.apply(null, allv.concat([0])), sp = (mx - mn) || 0.1;
            return { showticklabels: false, showgrid: false, zerolinecolor: ZERO, range: [mn - sp * (mn < 0 ? 0.16 : 0.02), mx + sp * 0.16] }; })(),
          annotations: (yy[yy.length-1].ytd || hasI) ? [{ xref: "paper", yref: "paper", x: 0, y: -0.2, xanchor: "left", showarrow: false, text: [yy[yy.length-1].ytd ? "* " + yy[yy.length-1].y + " hasta el " + dES(yy[yy.length-1].t) : "", hasI ? "<span style='color:" + rgba(FAINT, 0.8) + "'>■</span> índice de referencia" : ""].filter(Boolean).join("   "), font: { family: FONT, size: 11.5, color: FAINT } }] : [] }));
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
      plotEvolution: plotEvolution, ddCard: ddCard, ddBind: ddBind, ddRender: ddRender, rollCard: rollCard, rollRender: rollRender, monthEnds: monthEnds, rollWin: rollWin, worstOf: worstOf, HZ: HZ, rgba: rgba, sw: sw, resample: resample, ddOf: ddOf, fullStats: fullStats,
      th: function(){ return { PAL: PAL, INK: INK, MUT: MUT, FAINT: FAINT, HAIR: HAIR, POS: POS, NEG: NEG, SURF: SURF, ZERO: ZERO, DARK: DARK, FONT: FONT }; } } };
  function start(){ initTheme(); tick(); setInterval(tick, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
