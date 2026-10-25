// Vista estática de la pantalla del validador. Lee datos.json, que sale de una
// ejecución real del validador contra GraphDB (exportar_datos.py), y arma las
// mismas tres pantallas que la app de Streamlit (Figuras 6 a 9 del TFG).

// Proyecto que muestra el paso 2 de Integración, como en la Figura 9.
const PROYECTO_VALIDADOR = "compliancetech/validador";

const FICHAS = {
  "ficha-v1.ttl": "ficha-v1.ttl · ejemplo conforme",
  "ficha-v2.ttl": "ficha-v2.ttl · ejemplo no conforme",
  "subir": "Subir archivo .ttl",
};

let datos;
const estado = { cliente: null, modelo: null, version: null, pestana: "resultado", ficha: "ficha-v2.ttl", validado: null };

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const dec = (v) => (v === undefined || v === "" ? "Ausente" : Number(v).toFixed(2).replace(".", ","));
const regla = (id) => datos.reglas.find((r) => r.id === id);
const pill = (ok) => `<span class="ct-pill ${ok ? "ok" : "ko"}">${ok ? "Conforme" : "No conforme"}</span>`;

function fecha(iso) {
  const formato = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(formato.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

// ---------------------------------------------------------------- bloques comunes

function banner(ok, fallas, despliegue) {
  if (ok) {
    return `<div class="ct-banner ok"><b>${despliegue ? "Conforme · despliegue autorizado." : "Conforme."}</b> Cumple R1 a R5.</div>`;
  }
  const nombres = fallas.map((id) => `${id} (${regla(id).label.toLowerCase()})`).join(", ");
  return `<div class="ct-banner ko"><b>${despliegue ? "No conforme · despliegue bloqueado." : "No conforme."}</b> Falla ${esc(nombres)}.</div>`;
}

function cards(lista) {
  return `<div class="ct-cards">${lista.map(([titulo, valor, sub, rojo]) => `
    <div class="ct-card"><div class="lbl">${esc(titulo)}</div><div class="val${rojo ? " ko" : ""}">${esc(valor)}</div>
    <div class="sub">${esc(sub)}</div></div>`).join("")}</div>`;
}

function tablaReglas(filas) {
  const cuerpo = filas.map((f) => {
    const r = regla(f.id);
    return `<tr${f.ok ? "" : ' class="ct-fail"'}><td><span class="ct-id">${r.id}</span></td><td class="name">${esc(r.label)}</td>
      <td class="obs">${esc(f.observed)}</td><td class="muted">${esc(f.expected)}</td>
      <td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.legal_basis)}</a></td><td>${pill(f.ok)}</td></tr>`;
  }).join("");
  return `<div class="tabla"><table class="ct-table"><tr><th>ID</th><th>Control</th><th>Obtenido</th><th>Esperado</th>
    <th>Base legal</th><th>Resultado</th></tr>${cuerpo}</table></div>`;
}

function barras(titulo, items, escala = 1) {
  const filas = items.map(([etiqueta, valor, texto, clase]) => `
    <div class="ct-bar-row"><span class="lbl">${esc(etiqueta)}</span>
    <span class="ct-bar ${clase}" style="width:${Math.max(1, Math.min(Number(valor) / escala, 1) * 60)}%"></span>
    <span>${esc(texto)}</span></div>`).join("");
  return `<div class="ct-box"><div class="h">${esc(titulo)}</div>${filas}</div>`;
}

function select(id, etiqueta, opciones, actual) {
  return `<label for="${id}">${etiqueta}</label><select id="${id}">${opciones.map(([valor, texto]) =>
    `<option value="${esc(valor)}"${valor === actual ? " selected" : ""}>${esc(texto)}</option>`).join("")}</select>`;
}

// ---------------------------------------------------------------- Ejecuciones (Figuras 6 y 7)

function ejecuciones() {
  const todas = datos.ejecuciones; // de la más nueva a la más vieja
  const clientes = new Map(todas.map((r) => [r.clientId, r.provider || r.clientId]));
  if (!clientes.has(estado.cliente)) estado.cliente = [...clientes.keys()][0];
  const delCliente = todas.filter((r) => r.clientId === estado.cliente);
  const modelos = new Map(delCliente.map((r) => [r.modelId, r.modelName || r.modelId]));
  if (!modelos.has(estado.modelo)) estado.modelo = [...modelos.keys()][0];
  const ultima = new Map();
  delCliente.filter((r) => r.modelId === estado.modelo).forEach((r) => { if (!ultima.has(r.versionLabel)) ultima.set(r.versionLabel, r); });
  if (!ultima.has(estado.version)) estado.version = [...ultima.keys()][0];
  const run = ultima.get(estado.version);

  document.getElementById("selectores").innerHTML =
    select("cliente", "Cliente", [...clientes], estado.cliente) +
    select("modelo", "Modelo", [...modelos], estado.modelo) +
    select("version", "Versión", [...ultima].map(([v, r]) => [v, `${v} · ${fecha(r.executedAt).slice(0, 10)}`]), estado.version);

  const fallas = run.reglas.filter((r) => !r.ok).map((r) => r.id);
  const ok = run.conforms === "true";
  const esPipeline = run.origin === "pipeline";
  let riesgo = run.reglas[0].observed;
  if (run.annexIIIPoint) riesgo += ` (Anexo III, ${run.annexIIIPoint})`;
  const origen = esPipeline ? (run.pipelineId ? `Pipeline #${esc(run.pipelineId)}` : "Pipeline") : "Validación manual";

  const encabezado = `
    <div class="ct-title">${esc(modelos.get(estado.modelo))} · ${esc(estado.version)}</div>
    <p class="ct-meta">Finalidad: ${esc(run.purpose || "sin declarar")} · Riesgo: ${esc(riesgo)}</p>
    <p class="ct-meta">${origen} · ${fecha(run.executedAt)}</p>
    <div class="pestanas" role="tablist">
      <button role="tab" data-pestana="resultado" aria-selected="${estado.pestana === "resultado"}">Resultado</button>
      <button role="tab" data-pestana="historial" aria-selected="${estado.pestana === "historial"}">Historial</button>
    </div>`;
  return encabezado + (estado.pestana === "resultado" ? resultado(run, fallas, ok, esPipeline) : historial());
}

function resultado(run, fallas, ok, esPipeline) {
  const decision = esPipeline ? (ok ? "Autorizado" : "Bloqueado") : "No aplica";
  return banner(ok, fallas, esPipeline) + cards([
    ["Reglas conformes", `${run.reglas.length - fallas.length}/${run.reglas.length}`, `Reglas v${run.rulesVersion}`, false],
    ["Paridad demográfica (sexo)", dec(run.dpd), `Umbral ${datos.umbralTexto}`, fallas.includes("R5")],
    ["Despliegue", decision, esPipeline ? "Job compliance-check" : "Validación sin despliegue", esPipeline && !ok],
  ]) + tablaReglas(run.reglas) + `
    <div class="fila-doble">
      <div>${run.tasas.length ? barras("Tasa de aprobación por sexo", run.tasas.map((t) => [t.group, t.rate, dec(t.rate), ""])) : ""}</div>
      <div><button class="boton primario" id="descargar">Descargar reporte</button>
      ${run.pipelineUrl ? `<a class="boton secundario" href="${esc(run.pipelineUrl)}" target="_blank" rel="noopener">Ver pipeline en GitLab</a>` : ""}</div>
    </div>`;
}

function historial() {
  const { consulta, filas } = datos.historial[`${estado.cliente}|${estado.modelo}`];
  const porVersion = new Map();
  filas.forEach((h) => { if (!porVersion.has(h.versionLabel)) porVersion.set(h.versionLabel, h); });
  const items = [...porVersion].sort(([a], [b]) => a.localeCompare(b)).map(([v, h]) =>
    [v, h.dpd || 0, dec(h.dpd), h.dpd && Number(h.dpd) <= datos.umbral ? "ok" : "ko"]);
  const cuerpo = filas.map((h) => {
    const bien = h.conforms === "true";
    const donde = h.origin === "pipeline" ? (h.pipelineId ? `#${esc(h.pipelineId)}` : "pipeline") : esc(h.origin);
    return `<tr${bien ? "" : ' class="ct-fail"'}><td class="name"><b>${esc(h.versionLabel)}</b></td><td>${fecha(h.executedAt)}</td>
      <td class="obs">${dec(h.dpd)}</td><td>${5 - Number(h.failedRules)}/5</td><td>${donde}</td><td>${pill(bien)}</td></tr>`;
  }).join("");
  return `<div class="historial">${barras(`Paridad demográfica por versión · umbral ${datos.umbralTexto}`, items, 0.25)}
    <div class="tabla"><table class="ct-table"><tr><th>Versión</th><th>Fecha</th><th>Paridad</th><th>Reglas</th><th>Origen</th>
    <th>Resultado</th></tr>${cuerpo}</table></div>
    <p class="nota">Consulta SPARQL que arma esta tabla. Se puede correr en GraphDB Workbench.</p>
    <pre><code>${esc(consulta)}</code></pre></div>`;
}

// ---------------------------------------------------------------- Validación manual (Figura 8)

function validacionManual() {
  const opciones = Object.entries(FICHAS).map(([valor, texto]) => `
    <label><input type="radio" name="ficha" value="${valor}"${valor === estado.ficha ? " checked" : ""}> ${esc(texto)}</label>`).join("");
  let salida = "";
  if (estado.validado === "subir") {
    salida = `<div class="ct-banner info">En esta vista estática no se pueden validar archivos propios, porque no hay
      servidor. Para eso hay que instalar el prototipo con Docker, como explica el README del repositorio validador.</div>`;
  } else if (estado.validado) {
    const r = datos.manual[estado.validado];
    salida = `<p class="ct-meta">${esc(r.model_name)} · ${esc(r.version_label)} · reglas v${esc(r.rules_version)}</p>` +
      banner(r.conforms, r.failed_rules, false) + tablaReglas(r.reglas);
  }
  return `
    <div class="ct-title">Validación manual</div>
    <p class="ct-meta">Mismas reglas que el pipeline, sin despliegue</p>
    <div class="fila-doble" style="margin-top:20px">
      <div class="ct-box opciones"><div class="h">Ficha del modelo</div>${opciones}</div>
      <div><button class="boton primario" id="validar">Validar</button>
      <p class="nota">Ejecuta R1 a R5 y registra el resultado con origen manual. En esta vista se muestra el resultado
      guardado de esa validación.</p></div>
    </div>
    ${salida}
    <p class="nota">La ficha de ejemplo trae la paridad precalculada. En el pipeline la calcula Fairlearn.</p>`;
}

// ---------------------------------------------------------------- Integración (Figura 9)

function integracion() {
  const ultimo = datos.ejecuciones.find((r) => r.origin === "pipeline");
  const numero = ultimo && ultimo.pipelineId ? `#${esc(ultimo.pipelineId)}` : "corrida local";
  const paso = (n, texto) => `<div class="ct-step"><span class="n">${n}</span><span>${texto}</span></div>`;
  return `
    <div class="ct-title">Integración</div>
    <p class="ct-meta">Flujo: pipeline de GitLab CI → GraphDB → esta pantalla</p>
    <div class="ct-banner info" style="margin-top:20px">Vista estática, sin conexión en vivo con GraphDB.
      Último resultado guardado: pipeline ${numero}, ${ultimo ? fecha(ultimo.executedAt) : ""}.</div>
    <div class="ct-box"><div class="h">Cliente</div><div class="ct-kv">
      <span class="k">Nombre</span><span>${esc(ultimo ? ultimo.provider : "")}</span>
      <span class="k">Proyecto GitLab</span><span>banco-aurora-modelo-credito</span>
      <span class="k">Versión de reglas</span><span>v${esc(datos.rulesVersion)}</span>
      <span class="k">Repositorio GraphDB</span><span>historial</span></div></div>
    <div class="ct-box"><div class="h">Pasos de integración (equipo de ML del cliente)</div>
      ${paso(1, "Agregar <code>ficha.ttl</code> al repositorio del modelo.")}
      ${paso(2, "Incluir el job de control en <code>.gitlab-ci.yml</code>.")}
      <pre><code>include:\n  - project: "${PROYECTO_VALIDADOR}"\n    ref: main\n    file: "/ci/compliance-check.yml"</code></pre>
      ${paso(3, "Definir las variables de CI/CD (Settings › CI/CD › Variables).")}
      <pre><code>GRAPHDB_URL\nGRAPHDB_USER\nGRAPHDB_PASSWORD</code></pre>
      ${paso(4, "Hacer push de una versión nueva. El resultado aparece en Ejecuciones.")}
    </div>`;
}

// ---------------------------------------------------------------- navegación

const PAGINAS = { "ejecuciones": ejecuciones, "validacion-manual": validacionManual, "integracion": integracion };

function mostrar() {
  const nombre = PAGINAS[location.hash.slice(1)] ? location.hash.slice(1) : "ejecuciones";
  document.querySelectorAll(".menu a").forEach((a) => a.classList.toggle("activa", a.dataset.pagina === nombre));
  document.getElementById("selectores").innerHTML = "";
  document.getElementById("pagina").innerHTML = PAGINAS[nombre]();
}

function descargarReporte() {
  const run = datos.ejecuciones.find((r) => r.clientId === estado.cliente && r.modelId === estado.modelo && r.versionLabel === estado.version);
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([run.reporte], { type: "text/turtle" }));
  enlace.download = `reporte-${estado.modelo}-${estado.version}.ttl`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

document.addEventListener("change", (evento) => {
  const { id, name, value } = evento.target;
  if (id === "cliente") { estado.cliente = value; estado.modelo = null; estado.version = null; }
  if (id === "modelo") { estado.modelo = value; estado.version = null; }
  if (id === "version") estado.version = value;
  if (name === "ficha") { estado.ficha = value; estado.validado = null; }
  mostrar();
});

document.addEventListener("click", (evento) => {
  const objetivo = evento.target.closest("button");
  if (!objetivo) return;
  if (objetivo.dataset.pestana) { estado.pestana = objetivo.dataset.pestana; mostrar(); }
  if (objetivo.id === "validar") { estado.validado = estado.ficha; mostrar(); }
  if (objetivo.id === "descargar") descargarReporte();
});

window.addEventListener("hashchange", mostrar);

fetch("datos.json")
  .then((respuesta) => respuesta.json())
  .then((json) => {
    datos = json;
    document.getElementById("fecha-datos").textContent = fecha(datos.generado);
    mostrar();
  })
  .catch(() => {
    document.getElementById("pagina").innerHTML = '<div class="ct-banner ko">No se pudieron cargar los datos del prototipo.</div>';
  });
