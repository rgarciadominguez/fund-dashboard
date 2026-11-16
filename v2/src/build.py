"""Construye v2/index.html = base (commit de la capa de datos v2) + capa HF2 (css+js) + ajustes del tema."""
import sys, pathlib
here = pathlib.Path(__file__).parent
s = (here / "base_v2.html").read_text(encoding="utf-8")
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:60]); s = s.replace(a, b)
# la capa HF expone lo que HF2 necesita
rep("  var slotInfo = {};   // slot -> {name, isin, start, end, src}\n", "  var slotInfo = {};   // slot -> {name, isin, start, end, src}\n  HF.slotInfo = slotInfo; HF.slotSource = function(i){ return slotSource(i); };\n")
# los gráficos propios de HF2 no pasan por el tema antiguo; los antiguos, sin barra ni rejilla vertical
rep('      var id = (typeof el === "string") ? el : ((el && el.id) || "");\n', '      var id = (typeof el === "string") ? el : ((el && el.id) || "");\n      if (id.indexOf("hf2") === 0) return;\n')
rep('    a.gridcolor = "#E6EAF0"; a.zerolinecolor = "#C9D2E0"; a.linecolor = "#C9D2E0";', '    a.gridcolor = "#EEF1F6"; a.zerolinecolor = "#CBD3E0"; a.linecolor = "#E3E8F0"; a.showline = false; a.ticks = "";')
rep('''Object.keys(layout).forEach(function(k){ if (/^[xy]axis\\d*$/.test(k) && layout[k] && typeof layout[k]==="object") axis(layout[k]); });''',
    '''Object.keys(layout).forEach(function(k){ if (/^[xy]axis\\d*$/.test(k) && layout[k] && typeof layout[k]==="object"){ axis(layout[k]); if (k.charAt(0)==="x" && !(Array.isArray(data) && data[0] && data[0].type==="heatmap")) layout[k].showgrid = false; } });''')
rep("      Plotly[fn] = function(el, data, layout, cfg){ theme(el, data, layout); return orig.call(this, el, data, layout, cfg); };",
    "      Plotly[fn] = function(el, data, layout, cfg){ theme(el, data, layout); return orig.call(this, el, data, layout, Object.assign({}, cfg, { displayModeBar:false })); };")
# lo que el buscador nuevo necesita de los módulos existentes
rep("  window.mstBuildParsed = mstBuildParsed;\n", "  window.mstBuildParsed = mstBuildParsed;\n  window.mstSearch = mstSearch;\n")
rep("  window.__fdStore = store;\n", """  window.__fdStore = store;
  window.__fdLazy = fdLazyMap;
  window.__fdAddIsin = async function(isin, name, cur){   // alta en el repositorio de un fondo cargado desde Morningstar
    if (store[isin] && ((store[isin].rows || []).length >= 2 || fdIsLazy(isin))) return false;
    // ficha: el screener puede no responder (401 desde nov-2026); con tope y sin bloquear el alta
    let meta = {isin, name: isin, category: "", assetType: "", geography: "", currency: "", issuer: "", className: ""};
    try { meta = await Promise.race([dpFetchMeta(isin), new Promise((_, j) => setTimeout(() => j(new Error("ficha")), 12000))]); } catch(_){}
    if (name && (!meta.name || meta.name === isin)) meta.name = name;
    const mc = (window.MST && MST.metaCache && MST.metaCache.get(isin)) || {};
    const ccy = [cur, meta.currency, mc.baseCurrency].map(x => String(x || "").trim().toUpperCase()).find(x => /^[A-Z]{3}$/.test(x)) || "";
    if (ccy) meta.currency = ccy;
    let daily = [], weekly = [], monthly = [];
    try { daily   = await dpFetchSeries(isin, ccy, "daily");   } catch(_){}
    try { weekly  = await dpFetchSeries(isin, ccy, "weekly");  } catch(_){}
    try { monthly = await dpFetchSeries(isin, ccy, "monthly"); } catch(_){}
    const rows = dpMerge(daily, weekly, monthly);
    if (!rows.length) throw new Error("Sin histórico disponible");
    store[isin] = {meta, rows, updatedAt: Date.now()};
    dpSyncToDatapack(); dpUpdateStats(); dpRenderFundsList();
    return true;
  };
""")
# búsqueda Morningstar: por ISIN primero security_details (directo, ~0,2 s; el proxy del Worker devuelve 202
# vacío por el WAF y la cadena de proxies públicos colgaba la búsqueda); y tope de tiempo a cada ruta lenta
rep("""    if (mstIsIsin(tRaw)){
      try {
        const results = await mstSearchLegacyAPI(tRaw, 5);""", """    if (mstIsIsin(tRaw)){
      try {
        const d = await mstFetchSecurityDetails(tRaw);
        if (d && d.name) return [{ name: d.name, isin: (d.isin || tRaw).toUpperCase(), msId: d.msId || "", baseCurrency: d.currency || "" }];
      } catch(_){}
      try {
        const results = await mstWithTimeout(mstSearchLegacyAPI(tRaw, 5), 6000);""")
rep("""      return await mstSearchGlobal(tRaw, 5);
    }""", """      return await mstWithTimeout(mstSearchGlobal(tRaw, 5), 8000).catch(() => []);
    }""")
rep("""      const results = await mstSearchLegacyAPI(tRaw, limit || 25);
      if (results.length) return results;
    } catch(e){
      if (e && e.message && /aws-waf-token/i.test(e.message)) throw e;
    }
    return await mstSearchGlobal(tRaw, limit);
  }""", """      const results = await mstWithTimeout(mstSearchLegacyAPI(tRaw, limit || 25), 6000);
      if (results.length) return results;
    } catch(e){
      if (e && e.message && /aws-waf-token/i.test(e.message)) throw e;
    }
    return await mstWithTimeout(mstSearchGlobal(tRaw, limit), 8000).catch(() => []);
  }
  function mstWithTimeout(p, ms){
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("Morningstar no responde")), ms))]);
  }""")
# descargas del alta: cada intento con tope (la cadena de proxies públicos colgaba sin límite)
rep("""      try{
        const res = await fetch(u, {credentials:"omit", cache:"default"});
        if (!res.ok){ lastErr = new Error("HTTP "+res.status); continue; }""", """      try{
        const ctl = new AbortController(); const tmr = setTimeout(() => ctl.abort(), 9000);
        const res = await fetch(u, {credentials:"omit", cache:"default", signal: ctl.signal});
        clearTimeout(tmr);
        if (!res.ok){ lastErr = new Error("HTTP "+res.status); if (u === url && res.status === 401) break; continue; }""")
import json
cfg = json.loads((here / "config.json").read_text(encoding="utf-8"))
css = (here / "hf2.css").read_text(encoding="utf-8")
js = "\n".join((here / f).read_text(encoding="utf-8") for f in ("hf2.js", "hf2-pick.js", "hf2-bt.js"))
js = js.replace("__CAT_URL__", cfg["catalog_url"]).replace("__CAT_KEY__", cfg["catalog_anon_key"])
rep("</body>", "<style id=\"hf2-css\">\n" + css + "\n</style>\n<script id=\"hf2-layer\">\n" + js + "\n</script>\n</body>")
out = pathlib.Path(sys.argv[1]); out.write_text(s, encoding="utf-8"); print("ok", len(s))
