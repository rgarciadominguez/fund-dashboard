/* ==========================================================================
   HF2 · índice de referencia (nov-2026). Sugiere un índice por fondo con la
   tabla de abajo (editable), deja cambiarlo y lo guarda en la ficha del fondo
   del repositorio (meta.benchmark, solo ese campo). Las series son las IDX_*
   del propio repositorio (versión en euros). Un índice no limita el periodo.
   ========================================================================== */
(function(){
  "use strict";
  var L = window.HF2.lib, $ = L.$, esc = L.esc, h = L.h;

  /* ---------- nombres de los índices del repositorio (los que no estén aquí salen con su clave) ---------- */
  var NAMES = {
    IDX_MSCI_ACWI_GROSS_Euro: "MSCI ACWI", IDX_MSCI_WORLD_GROSS_EUE_Euro: "MSCI World", IDX_MSCI_EUROPE_GROSS_EUR_Euro: "MSCI Europe",
    IDX_SP500_GROSS_Euro: "S&P 500", IDX_MSCI_UNITED_STATES_BROAD_GROSS_Euro: "MSCI USA", IDX_MSCI_EM_GROSS_Euro: "MSCI Emergentes",
    IDX_MSCI_WORLD_SMALL_CAP_PRICE_VERSION_Euro: "MSCI World Small Cap (precio)", IDX_SMALL_CAPS_EUROPA_STOXX_SMALL_EUR_NR_Euro: "STOXX Europe Small 200",
    IDX_MSCI_US_SMALL_GROSS_Euro: "MSCI USA Small Cap", IDX_MSCI_PACIFIC_NET_Euro: "MSCI Pacífico", IDX_MSCI_CHINA_NET_Euro: "MSCI China", IDX_MSCI_INDIA_NET_Euro: "MSCI India",
    IDX_MSCI_ACWI_EX_USA_GROSS_Euro: "MSCI ACWI ex USA", IDX_MSCI_WORLD_EX_USA_GROSS_Euro: "MSCI World ex USA", IDX_NASDAQ_100_TR_Euro: "Nasdaq 100",
    IDX_NASDAQ_100_Euro: "Nasdaq 100 (precio)", IDX_NASDAQ_COMPOSITE_TR_Euro: "Nasdaq Composite", IDX_REITS_EUROPA_Euro: "REITs Europa",
    IDX_EUROZONE_3_YEARS_GOV_Euro: "Deuda eurozona 3A", IDX_EUROZONE_5_YEARS_GOV_Euro: "Deuda eurozona 5A", IDX_EUROZONE_7_YEARS_GOV_Euro: "Deuda eurozona 7A",
    IDX_EUROZONE_10_YEARS_GOV_Euro: "Deuda eurozona 10A", IDX_EUROZONE_20_YEARS_GOV_Euro: "Deuda eurozona 20A", IDX_EUROZONE_30_YEARS_GOV_Euro: "Deuda eurozona 30A",
    IDX_BLOOMBERG_GOLD_TR_Euro: "Oro (Bloomberg Gold TR)", IDX_FUTUROS_ORO_DESDE_2000_Euro: "Oro (futuros)",
    IDX_US_3_YEARS_GOV_Euro: "Deuda EE. UU. 3A (en EUR)", IDX_US_5_YEARS_GOV_Euro: "Deuda EE. UU. 5A (en EUR)", IDX_US_10_YEAR_GOV_Euro: "Deuda EE. UU. 10A (en EUR)", IDX_US_30_YEARS_GOV_Euro: "Deuda EE. UU. 30A (en EUR)"
  };
  /* si el índice sugerido no está al día, se sugiere este en su lugar (o ninguno) */
  var FALLBACK = { IDX_MSCI_WORLD_SMALL_CAP_PRICE_VERSION_Euro: "IDX_MSCI_WORLD_GROSS_EUE_Euro" };
  var ACWI = "IDX_MSCI_ACWI_GROSS_Euro", WORLD = "IDX_MSCI_WORLD_GROSS_EUE_Euro", EUR = "IDX_MSCI_EUROPE_GROSS_EUR_Euro", SP = "IDX_SP500_GROSS_Euro", EM = "IDX_MSCI_EM_GROSS_Euro",
      SMW = "IDX_MSCI_WORLD_SMALL_CAP_PRICE_VERSION_Euro", SME = "IDX_SMALL_CAPS_EUROPA_STOXX_SMALL_EUR_NR_Euro", PAC = "IDX_MSCI_PACIFIC_NET_Euro",
      G3 = "IDX_EUROZONE_3_YEARS_GOV_Euro", G5 = "IDX_EUROZONE_5_YEARS_GOV_Euro", G10 = "IDX_EUROZONE_10_YEARS_GOV_Euro", GOLD = "IDX_BLOOMBERG_GOLD_TR_Euro";
  function mix(a){ return a.map(function(x){ return x[0] + "*" + x[1]; }).join("+"); }   // [[clave, peso %]] → "IDX_A*50+IDX_B*50"

  /* ---------- 1) texto «benchmark» del catálogo → índice (primera regla que encaje) ---------- */
  var TEXT_RULES = [
    [/permanente/i, mix([[ACWI, 25], [G10, 25], [GOLD, 25], [G3, 25]]), "cartera permanente"],
    [/75\s*%\s*rv/i, mix([[ACWI, 75], [G5, 25]]), "75 % RV / 25 % RF"],
    [/40\s*%\s*rv/i, mix([[ACWI, 40], [G5, 60]]), "40 % RV / 60 % RF"],
    [/25\s*%\s*rv/i, mix([[ACWI, 25], [G5, 75]]), "25 % RV / 75 % RF"],
    [/small/i, null, "small"],                                  // se resuelve abajo según la zona
    [/acwi/i, ACWI, ""], [/msci world|mundial/i, WORLD, ""], [/sp ?500|s&p/i, SP, ""],
    [/emerg/i, EM, ""], [/india/i, "IDX_MSCI_INDIA_NET_Euro", ""], [/china/i, "IDX_MSCI_CHINA_NET_Euro", ""],
    [/jap[oó]n|pac[ií]fico/i, PAC, "aprox."], [/euro ?stoxx|europe|europa/i, EUR, ""],
    [/euribor|corto plazo/i, G3, "aprox."], [/medio plazo/i, G5, ""], [/largo plazo/i, G10, ""],
    [/\boro\b|gold/i, GOLD, ""], [/reit/i, "IDX_REITS_EUROPA_Euro", "aprox."],
    [/high yield|cat[aá]strofe|ibex/i, "", "sin índice equivalente en el repositorio"]
  ];
  /* ---------- 2) si no hay texto: tipo · zona · categoría RF · plazo ---------- */
  function byTax(t){
    var tipo = t.tipo || "", geo = t.geo || "", car = (t.car || []).join(" ").toLowerCase(), cm = String(t.catms || "").toLowerCase(), pz = t.plazo || [];
    if (!tipo) tipo = /money market|monetari/.test(cm) ? "Monetario" : /bond|renta fija/.test(cm) ? "Renta fija" : /allocation|mixto/.test(cm) ? "Mixtos" : /equity|renta variable|rv /.test(cm) ? "Renta variable" : /commodit|precious|oro/.test(cm) ? "Materias primas" : "";
    if (tipo === "Monetario") return [G3, "monetario → deuda eurozona 3A (aprox.)"];
    if (tipo === "Renta fija"){
      if (/high yield|cat[aá]strofe|ils/.test(car) || /high yield/.test(cm)) return ["", "renta fija high yield / ILS: sin índice equivalente"];
      if (pz.indexOf("Corto") >= 0 || /corto|ultra short|short/.test(cm)) return [G3, "renta fija corto plazo"];
      if (pz.indexOf("Largo") >= 0 || /largo|long/.test(cm)) return [G10, "renta fija largo plazo"];
      return [G5, "renta fija"];
    }
    if (tipo === "Mixtos"){
      if (/defensiv|conservad|cautious|prudente/.test(cm)) return [mix([[ACWI, 30], [G5, 70]]), "mixto defensivo"];
      if (/agresiv|aggressive|dinámic|dinamic/.test(cm)) return [mix([[ACWI, 75], [G5, 25]]), "mixto agresivo"];
      return [mix([[ACWI, 50], [G5, 50]]), "mixto"];
    }
    if (tipo === "Materias primas") return /oro|gold|preciosos/.test(cm + " " + String(t.tema || "").toLowerCase()) ? [GOLD, "oro"] : ["", "materias primas: sin índice equivalente"];
    if (tipo === "Renta variable" || /rv |renta variable|equity/.test(cm)){
      var small = /small|peque/.test(car + " " + cm);
      if (small) return /europ|espa/i.test(geo + " " + cm) ? [SME, "small caps Europa"] : (/EE\. UU\./.test(geo) || /^us |usa/.test(cm)) ? ["IDX_MSCI_US_SMALL_GROSS_Euro", "small caps EE. UU."] : [SMW, "small caps"];
      if (/reit/.test(car)) return ["IDX_REITS_EUROPA_Euro", "REITs (aprox.)"];
      if (/Europa|España|Nórdicos/.test(geo) || /europ|españa|zona euro|eurozona/.test(cm)) return [EUR, "renta variable Europa"];
      if (/EE\. UU\./.test(geo) || /ee\.? ?uu|usa|us large|estados unidos/.test(cm)) return [SP, "renta variable EE. UU."];
      if (/Emergentes/.test(geo) || /emerg/.test(cm)) return [EM, "renta variable emergente"];
      if (/Asia/.test(geo) || /jap[oó]n|asia|pac[ií]f/.test(cm)) return [PAC, "Asia-Pacífico (aprox.)"];
      if (/india/.test(cm)) return ["IDX_MSCI_INDIA_NET_Euro", "India"];
      if (/china/.test(cm)) return ["IDX_MSCI_CHINA_NET_Euro", "China"];
      if (/Desarrollados/.test(geo)) return [WORLD, "renta variable desarrollados"];
      return [ACWI, "renta variable global"];
    }
    return ["", "sin regla para este tipo de fondo"];
  }
  function suggest(isin){
    var g = suggestRaw(isin), c = parse(g.spec);
    if (!c.length) return g;
    var bad = c.filter(function(x){ return !fresh(x.k); });
    if (!bad.length) return g;
    var ok = c.every(function(x){ return fresh(x.k) || (FALLBACK[x.k] && fresh(FALLBACK[x.k])); });
    if (!ok) return { spec: "", why: g.why + " · " + bad.map(function(x){ return nameOf(x.k); }).join(", ") + " no está al día en el repositorio" };
    return { spec: c.map(function(x){ return (fresh(x.k) ? x.k : FALLBACK[x.k]) + (c.length > 1 ? "*" + x.w : ""); }).join("+"), why: g.why + " · " + bad.map(function(x){ return nameOf(x.k); }).join(", ") + " no está al día: se usa " + bad.map(function(x){ return nameOf(FALLBACK[x.k]); }).join(", ") + " (aprox.)" };
  }
  /* fecha final de un índice del repositorio y si está al día (≤ 60 días del más reciente) */
  function endOf(k){ var lz = window.__fdLazy ? window.__fdLazy() : null, e = lz && lz.get ? lz.get(k) : null; if (e && e.d1) return Date.parse(e.d1 + "T00:00:00Z"); var r = rowsOf(k); return r ? L.tOf(r[r.length - 1]) : null; }
  function newest(){ var lz = window.__fdLazy ? window.__fdLazy() : null, m = 0; if (lz && lz.forEach) lz.forEach(function(e, k){ if (/^IDX_/.test(k) && e && e.d1){ var t = Date.parse(e.d1 + "T00:00:00Z"); if (t > m) m = t; } }); return m; }
  function fresh(k){ if (!exists(k)) return false; var e = endOf(k), n = newest(); return !(e && n && e < n - 60 * 864e5); }
  function suggestRaw(isin){
    var t = (window.HF2P && HF2P.info) ? (HF2P.info(isin) || {}) : {};
    var txt = String(t.bmk || "");
    if (txt){
      for (var i = 0; i < TEXT_RULES.length; i++){
        var r = TEXT_RULES[i]; if (!r[0].test(txt)) continue;
        if (r[2] === "small") return { spec: /europ/i.test(txt) ? SME : SMW, why: "catálogo: «" + txt + "»" };
        return { spec: r[1], why: "catálogo: «" + txt + "»" + (r[2] && r[1] ? " (" + r[2] + ")" : (r[1] ? "" : " · " + r[2])) };
      }
    }
    var b = byTax(t);
    return { spec: b[0], why: b[1] };
  }

  /* ---------- elección: lo guardado en la ficha manda; si no, la sugerencia ---------- */
  var LOCAL = {};   // isin → spec elegido en esta sesión (fondos que no están en el repositorio)
  var I = { ver: 0, cmpOn: false, bt: null };
  function store(){ return window.__fdStore || {}; }
  /* meta.benchmark = [{id, peso}] (lista vacía = sin índice) */
  function fromList(b){ return b.filter(function(x){ return x && x.id; }).map(function(x, i, a){ return x.id + (a.length > 1 ? "*" + (Number(x.peso) || 0) : ""); }).join("+"); }
  function toList(spec){ return parse(spec).map(function(x){ return { id: x.k, peso: x.w }; }); }
  function saved(isin){ var f = store()[isin], b = f && f.meta && f.meta.benchmark; if (Array.isArray(b)) return fromList(b); if (b && typeof b === "object" && typeof b.spec === "string") return b.spec; if (typeof b === "string") return b; return null; }
  function choice(isin){
    if (!isin) return { spec: "", src: "none", why: "" };
    if (isin in LOCAL) return { spec: LOCAL[isin], src: "elegido", why: "" };
    var s = saved(isin); if (s != null) return { spec: s, src: "guardado", why: "" };
    var g = suggest(isin); return { spec: g.spec || "", src: "sugerido", why: g.why };
  }
  function parse(spec){ if (!spec) return []; return String(spec).split("+").map(function(x){ var a = x.split("*"); return { k: a[0], w: a.length > 1 ? Number(a[1]) : 100 }; }).filter(function(x){ return x.k && x.w > 0; }); }
  function nameOf(k){ return NAMES[k] || (NAMES[String(k).replace(/_USD$/, "_Euro")] ? NAMES[String(k).replace(/_USD$/, "_Euro")].replace(/ \(en EUR\)/, "") + " (USD)" : String(k).replace(/^IDX_/, "").replace(/_(Euro|USD)$/, "").replace(/_/g, " ")); }
  function label(spec){ var c = parse(spec); if (!c.length) return "Sin índice"; if (c.length === 1) return nameOf(c[0].k); return c.map(function(x){ return x.w + " % " + nameOf(x.k); }).join(" + "); }
  function short(spec){ var c = parse(spec); if (!c.length) return "—"; if (c.length === 1) return nameOf(c[0].k); return c.map(function(x){ return x.w; }).join("/") + " " + c.map(function(x){ return nameOf(x.k).replace(/^Deuda eurozona /, "Gob. ").replace(/^MSCI /, ""); }).join("·"); }

  function bump(){ I.ver++; try{ window.HF2.state.C.sig = ""; window.HF2.state.F.sig = ""; if (window.HF2B) HF2B.state.sig = ""; }catch(_){ } }
  /* guarda SOLO meta.benchmark: lee la ficha de la nube, añade el campo y la vuelve a escribir (sin tocar la serie) */
  function persist(isin, spec){
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin) || !store()[isin] || typeof window.__fdSaveMeta !== "function"){ LOCAL[isin] = spec; bump(); return Promise.resolve(false); }
    var val = toList(spec);
    LOCAL[isin] = spec; bump();
    return window.__fdSaveMeta(isin, "benchmark", val).then(function(){ delete LOCAL[isin]; bump(); return true; })
      .catch(function(e){ console.warn("[índice] no se pudo guardar en la ficha de " + isin, e); return false; });
  }

  /* ---------- series: una sola o mezcla con rebalanceo mensual ---------- */
  var CACHE = {};
  function rowsOf(k){ var f = store()[k]; return f && f.rows && f.rows.length >= 2 ? f.rows : null; }
  function exists(k){ var lz = window.__fdLazy ? window.__fdLazy() : null; return !!(store()[k] || (lz && lz.has && lz.has(k))); }
  function series(spec){   // → [[t, v]] | null (cargando) | [] (no disponible)
    var c = parse(spec); if (!c.length) return [];
    var key = c.map(function(x){ return x.k + x.w; }).join("+") + "@" + c.map(function(x){ var r = rowsOf(x.k); return r ? r.length : 0; }).join(",");
    if (CACHE[key]) return CACHE[key];
    var miss = c.filter(function(x){ return !rowsOf(x.k); });
    if (miss.length){
      if (miss.some(function(x){ return !exists(x.k); })) return [];
      miss.forEach(function(x){ if (x.k in LOADING) return; LOADING[x.k] = 1;
        Promise.resolve(window.__fdEnsureSeries ? window.__fdEnsureSeries(x.k) : null).catch(function(e){ console.warn("[índice]", e); }).then(function(){ delete LOADING[x.k]; bump(); }); });
      return null;
    }
    var out;
    if (c.length === 1) out = L.pts(rowsOf(c[0].k), -Infinity, Infinity);
    else {
      var me = c.map(function(x){ var m = {}; L.monthEnds(L.pts(rowsOf(x.k), -Infinity, Infinity)).forEach(function(p){ m[L.dISO(p[0]).slice(0, 7)] = p; }); return m; });
      var ks = Object.keys(me[0]).filter(function(k){ return me.every(function(m){ return k in m; }); }).sort(), tw = c.reduce(function(s, x){ return s + x.w; }, 0);
      out = []; var v = 100;
      ks.forEach(function(k, i){
        if (i){ var r = 0; c.forEach(function(x, j){ r += x.w / tw * (me[j][k][1] / me[j][ks[i - 1]][1] - 1); }); v *= 1 + r; }
        out.push([Math.max.apply(null, me.map(function(m){ return m[k][0]; })), v]);
      });
    }
    CACHE[key] = out; return out;
  }
  var LOADING = {};
  /* serie de un fondo frente a su índice en el tramo en que existen los dos */
  function excess(fp, ip){
    if (!fp || !ip || fp.length < 2 || ip.length < 2) return null;
    var a = Math.max(fp[0][0], ip[0][0]), b = Math.min(fp[fp.length - 1][0], ip[ip.length - 1][0]);
    if ((b - a) / 864e5 < 360) return null;
    function at(p, t, first){ var best = null; for (var i = 0; i < p.length; i++){ if (first ? p[i][0] >= t : p[i][0] <= t){ if (first) return p[i]; best = p[i]; } } return best; }
    var f0 = at(fp, a, true), f1 = at(fp, b, false), i0 = at(ip, a, true), i1 = at(ip, b, false);
    if (!f0 || !f1 || !i0 || !i1) return null;
    var yf = (f1[0] - f0[0]) / 864e5 / 365.25, yi = (i1[0] - i0[0]) / 864e5 / 365.25;
    if (yf <= 0 || yi <= 0) return null;
    var af = Math.pow(f1[1] / f0[1], 1 / yf) - 1, ai = Math.pow(i1[1] / i0[1], 1 / yi) - 1;
    return { d: af - ai, f: af, i: ai, t0: a, t1: b };
  }
  /* aviso discreto cuando el índice no cubre el periodo */
  function cover(ip, t0, t1){
    if (!ip || !ip.length) return "";
    var a = ip[0][0], b = ip[ip.length - 1][0], w = [];
    if (a > t0 + 40 * 864e5) w.push("empieza el " + L.dES(a));
    if (b < t1 - 40 * 864e5) w.push("termina el " + L.dES(b));
    return w.join(" y ");
  }
  /* índice de una cartera: mezcla de los índices de sus fondos por peso (o el global si ninguno tiene) */
  function portfolio(list){   // [{isin, w}]
    var acc = {}, tw = 0;
    list.forEach(function(x){ var c = parse(choice(x.isin).spec); if (!c.length || !(x.w > 0)) return; var s = c.reduce(function(q, y){ return q + y.w; }, 0); tw += x.w;
      c.forEach(function(y){ acc[y.k] = (acc[y.k] || 0) + x.w * y.w / s; }); });
    if (!tw) return ACWI;
    var a = Object.keys(acc).map(function(k){ return [k, Math.round(acc[k] / tw * 100)]; }).filter(function(x){ return x[1] > 0; }).sort(function(x, y){ return y[1] - x[1]; });
    var d = 100 - a.reduce(function(s, x){ return s + x[1]; }, 0); if (a.length) a[0][1] += d;
    return a.length === 1 ? a[0][0] : mix(a);
  }

  /* ---------- selector ---------- */
  function available(){
    var ks = {}, lz = window.__fdLazy ? window.__fdLazy() : null;
    function ok(k){ return /^IDX_/.test(k) && (/_Euro$/.test(k) || (/_USD$/.test(k) && fresh(k) && k !== "IDX_FUTUROS_ORO_DESDE_1975_USD")); }
    Object.keys(store()).forEach(function(k){ if (ok(k)) ks[k] = 1; });
    if (lz && lz.forEach) lz.forEach(function(_, k){ if (ok(k)) ks[k] = 1; });
    if (!Object.keys(ks).length) Object.keys(NAMES).forEach(function(k){ ks[k] = 1; });
    return Object.keys(ks);
  }
  function group(k){ return /GOV|BOND/.test(k) ? "Renta fija" : /GOLD|ORO|REIT/.test(k) ? "Oro e inmobiliario" : "Renta variable"; }
  /* los de USD que ya no se actualizan no se ofrecen (sus versiones en EUR sí) */
  var POP = null;
  function closePop(){ if (POP){ POP.remove(); POP = null; } }
  document.addEventListener("click", function(e){ if (POP && !POP.contains(e.target) && !(e.target.closest && e.target.closest("[data-hf2idx],[data-hf2idxbt]"))) closePop(); });
  document.addEventListener("keydown", function(e){ if (e.key === "Escape") closePop(); });
  /* opts: {anchor, isin, name, current, src, suggested, sugWhy, onPick(spec) → si se pasa, no se guarda en la ficha (cartera)} */
  function tag(k){ var e = endOf(k), cur = /_USD$/.test(k) ? "USD" : "", t = []; if (cur) t.push(cur); if (!fresh(k) && e) t.push("hasta " + L.dES(e)); return t.join(" · "); }
  function open(opts){
    closePop();
    var cur = opts.isin ? choice(opts.isin) : { spec: opts.current || "", src: opts.src || "elegido", why: opts.why || "" };
    var sg = opts.isin ? suggest(opts.isin) : { spec: opts.suggested || "", why: opts.sugWhy || "" };
    var p = h("div", "hf2pop hf2idxpop", ""); POP = p;
    var picked = cur.src === "sugerido" ? null : cur.spec;
    function it(spec, txt, sub, on){ return '<button type="button" class="it' + (on ? " on" : "") + '" data-s="' + esc(spec) + '"><span>' + txt + (sub ? "<small>" + sub + "</small>" : "") + "</span>" + (on ? "<em>✓</em>" : "") + "</button>"; }
    var html = '<h6>Índice de referencia' + (opts.name ? " · " + esc(L.clip(opts.name, 34)) : "") + "</h6>";
    html += it(sg.spec || "", "<b>Sugerido:</b> " + esc(label(sg.spec)), esc(sg.why || ""), cur.src === "sugerido");
    if (picked && parse(picked).length > 1) html += it(picked, esc(label(picked)), "mezcla elegida · rebalanceo mensual", true);
    var av = available(), gs = {};
    av.forEach(function(k){ (gs[group(k)] = gs[group(k)] || []).push(k); });
    ["Renta variable", "Renta fija", "Oro e inmobiliario"].forEach(function(g){
      if (!gs[g]) return; html += "<h6>" + g + "</h6>";
      gs[g].sort(function(a, b){ return (/_USD$/.test(a) - /_USD$/.test(b)) || nameOf(a).localeCompare(nameOf(b), "es"); }).forEach(function(k){ html += it(k, esc(nameOf(k)), esc(tag(k)), picked === k); });
    });
    html += '<h6>Mezcla a medida <small>rebalanceo mensual</small></h6><div class="hf2mix" id="hf2Mix"></div><hr>' + it("", "Sin índice", "", picked === "");
    p.innerHTML = html;
    document.body.appendChild(p);
    /* constructor de mezcla: índice + %, suma 100 */
    var rows = parse(picked && parse(picked).length > 1 ? picked : (sg.spec && parse(sg.spec).length > 1 ? sg.spec : "IDX_MSCI_ACWI_GROSS_Euro*60+IDX_EUROZONE_5_YEARS_GOV_Euro*40")).map(function(x){ return { k: x.k, w: x.w }; });
    var opt = av.slice().sort(function(a, b){ return nameOf(a).localeCompare(nameOf(b), "es"); });
    function paintMix(){
      var box = p.querySelector("#hf2Mix"), sum = rows.reduce(function(q, r){ return q + (Number(r.w) || 0); }, 0);
      box.innerHTML = rows.map(function(r, i){ return '<div class="r"><select data-i="' + i + '">' + opt.map(function(k){ return '<option value="' + esc(k) + '"' + (k === r.k ? " selected" : "") + ">" + esc(nameOf(k)) + (tag(k) ? " · " + esc(tag(k)) : "") + "</option>"; }).join("") +
        '</select><input type="number" min="0" max="100" step="5" value="' + r.w + '" data-i="' + i + '"><em>%</em>' + (rows.length > 1 ? '<b data-i="' + i + '" title="Quitar">×</b>' : "") + "</div>"; }).join("") +
        '<div class="f"><button type="button" class="lnk" id="hf2MixAdd">+ Añadir índice</button><span class="' + (Math.abs(sum - 100) < 0.01 ? "ok" : "bad") + '">Suma ' + L.num(sum, 0) + ' %</span><button type="button" class="go" id="hf2MixGo"' + (Math.abs(sum - 100) < 0.01 && rows.length > 1 ? "" : " disabled") + ">Aplicar</button></div>";
      Array.prototype.forEach.call(box.querySelectorAll("select"), function(e){ e.addEventListener("change", function(){ rows[+e.dataset.i].k = e.value; }); });
      Array.prototype.forEach.call(box.querySelectorAll("input"), function(e){ e.addEventListener("change", function(){ rows[+e.dataset.i].w = Math.max(0, Math.min(100, Number(e.value) || 0)); paintMix(); }); });
      Array.prototype.forEach.call(box.querySelectorAll("b"), function(e){ e.addEventListener("click", function(ev){ ev.stopPropagation(); rows.splice(+e.dataset.i, 1); paintMix(); }); });
      box.querySelector("#hf2MixAdd").addEventListener("click", function(ev){ ev.stopPropagation(); rows.push({ k: "IDX_EUROZONE_3_YEARS_GOV_Euro", w: Math.max(0, 100 - sum) }); paintMix(); });
      box.querySelector("#hf2MixGo").addEventListener("click", function(){ var seen = {}, m = []; rows.forEach(function(r){ if (!(r.w > 0)) return; if (seen[r.k]) seen[r.k].w += r.w; else { seen[r.k] = { k: r.k, w: r.w }; m.push(seen[r.k]); } });
        pick(m.length === 1 ? m[0].k : m.map(function(x){ return x.k + "*" + x.w; }).join("+")); });
    }
    paintMix();
    var r = opts.anchor.getBoundingClientRect();
    p.style.position = "fixed"; p.style.top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - 440)) + "px"; p.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 360)) + "px";
    function pick(sp){ closePop(); if (opts.onPick){ opts.onPick(sp); bump(); return; } persist(opts.isin, sp); }
    Array.prototype.forEach.call(p.querySelectorAll("button.it"), function(b){ b.addEventListener("click", function(){ pick(b.dataset.s); }); });
    p.addEventListener("click", function(e){ e.stopPropagation(); });
  }
  /* botón «Índice: X · sugerido ▾» */
  function button(isin, name, cls){
    var c = choice(isin);
    return '<button type="button" class="hf2idxb ' + (cls || "") + '" data-hf2idx="' + esc(isin) + '" data-n="' + esc(name || "") + '" title="' + esc(c.src === "sugerido" ? "Sugerido (" + c.why + "). Pulsa para elegir otro o confirmarlo." : "Índice de referencia guardado en la ficha del fondo. Pulsa para cambiarlo.") + '">' +
      '<i></i>' + esc(label(c.spec)) + (c.src === "sugerido" && c.spec ? ' <em>sugerido</em>' : "") + ' <span aria-hidden="true">▾</span></button>';
  }
  function bind(root){
    Array.prototype.forEach.call((root || document).querySelectorAll("[data-hf2idx]"), function(b){
      if (b.dataset.b) return; b.dataset.b = "1";
      b.addEventListener("click", function(e){ e.stopPropagation(); if (POP){ closePop(); return; } open({ anchor: b, isin: b.dataset.hf2idx, name: b.dataset.n }); });
    });
  }

  /* ---------- análisis guardados ---------- */
  function exportState(){ return { cmpOn: !!I.cmpOn, bt: I.bt, local: Object.assign({}, LOCAL) }; }
  function importState(s){ if (!s || typeof s !== "object") return; I.cmpOn = !!s.cmpOn; I.bt = s.bt == null ? null : String(s.bt); if (s.local && typeof s.local === "object") Object.keys(s.local).forEach(function(k){ if (saved(k) == null) LOCAL[k] = String(s.local[k]); }); bump(); }

  I.choice = choice; I.suggest = suggest; I.label = label; I.short = short; I.parse = parse; I.series = series; I.excess = excess; I.cover = cover; I.portfolio = portfolio;
  I.open = open; I.button = button; I.bind = bind; I.persist = persist; I.exportState = exportState; I.importState = importState; I.bump = bump; I.nameOf = nameOf;
  I.RULES = { text: TEXT_RULES, byTax: byTax }; I.fresh = fresh; I.endOf = endOf; I.toList = toList;
  window.HF2I = I;
})();
