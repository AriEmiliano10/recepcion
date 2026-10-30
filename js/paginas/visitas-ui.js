/* UI compartida de visitas y flujo de acceso. */
(function (SR) {
  "use strict";
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>\"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]; }); }
  function fecha(v) { return v ? new Date(v + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : ""; }
  function hoy() { var ahora = new Date(); return ahora.getFullYear() + "-" + String(ahora.getMonth() + 1).padStart(2, "0") + "-" + String(ahora.getDate()).padStart(2, "0"); }
  function textoIdentificacion(v) { if (v.identificacionPresentada === false) return "Sin identificación"; if (v.identificacionTipo === "PASAPORTE") return "Pasaporte entregado"; if (v.identificacionTipo === "INE") return "INE / IFE entregada"; return "Identificación presentada"; }
  function mostrarQr(id) {
    var visita = SR.visitas.buscar(id);
    if (!visita) return;
    var anterior = document.getElementById("modal-qr"); if (anterior) anterior.remove();
    var modal = document.createElement("div"); modal.id = "modal-qr"; modal.className = "modal-qr";
    modal.innerHTML = "<div class=\"modal-qr-contenido\" role=\"dialog\" aria-modal=\"true\"><button class=\"modal-qr-cerrar\" type=\"button\" aria-label=\"Cerrar\">&times;</button><div class=\"modal-qr-marca\"><img src=\"img/logo.png\" alt=\"Logo\"><span>Gafete de visitante</span></div><h2>" + esc(visita.visitante) + "</h2><p class=\"texto-secundario\">Folio " + esc(visita.folio) + " · " + esc(visita.anfitrion) + "</p><div id=\"qr-render\" class=\"qr-render\"></div><p class=\"qr-ayuda\">Presenta este codigo en recepcion</p><div class=\"modal-qr-acciones\"><button class=\"boton boton-secundario\" id=\"btn-descargar-qr\" type=\"button\">Descargar QR</button><button class=\"boton boton-primario\" id=\"btn-imprimir-qr\" type=\"button\">Imprimir gafete</button></div></div>";
    document.body.appendChild(modal);
    var cerrar = function () { modal.remove(); };
    modal.querySelector(".modal-qr-cerrar").onclick = cerrar;
    modal.onclick = function (ev) { if (ev.target === modal) cerrar(); };
    if (!window.QRCode) { modal.querySelector("#qr-render").textContent = "No se pudo cargar el generador QR."; return; }
    new QRCode(modal.querySelector("#qr-render"), { text: visita.id, width: 260, height: 260, colorDark: "#123f52", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
    window.setTimeout(function () {
      var canvas = modal.querySelector("#qr-render canvas"); if (!canvas) return;
      var contexto = canvas.getContext("2d"), logo = new Image();
      logo.onload = function () { var lado = 54, x = (canvas.width - lado) / 2, y = (canvas.height - lado) / 2; contexto.fillStyle = "#ffffff"; contexto.fillRect(x - 7, y - 7, lado + 14, lado + 14); contexto.drawImage(logo, x, y, lado, lado); };
      logo.src = "img/logo.png";
      modal.querySelector("#btn-descargar-qr").onclick = function () { var enlace = document.createElement("a"); enlace.download = "QR-" + visita.folio + ".png"; enlace.href = canvas.toDataURL("image/png"); enlace.click(); };
      modal.querySelector("#btn-imprimir-qr").onclick = function () { var ventana = window.open("", "_blank", "width=480,height=700"); if (!ventana) return; ventana.document.write("<title>Gafete " + esc(visita.folio) + "</title><style>body{font-family:Arial;text-align:center;padding:24px}img{width:280px;max-width:100%}</style><h2>Gafete de visitante</h2><p>" + esc(visita.visitante) + "</p><img src=\"" + canvas.toDataURL("image/png") + "\"><p>Folio " + esc(visita.folio) + "</p><script>window.onload=function(){window.print();}<\\/script>"); ventana.document.close(); };
    }, 120);
  }

  async function render(sesion) {
    var lista = await SR.visitas.visibles(sesion), resumen = document.getElementById("resumen-visitas"), estados = SR.visitas.ESTADOS, conteo = {}, fechaHoy = hoy();
    Object.keys(estados).forEach(function (k) { conteo[k] = lista.filter(function (v) { return v.estado === estados[k]; }).length; });
    if (resumen) resumen.innerHTML = "<div class=\"estadistica estadistica-hoy\"><strong>" + lista.filter(function (v) { return v.fecha === fechaHoy; }).length + "</strong><span>Visitas de hoy</span></div><div class=\"estadistica\"><strong>" + conteo.PROGRAMADA + "</strong><span>Programadas</span></div><div class=\"estadistica estadistica-espera\"><strong>" + conteo.EN_ESPERA + "</strong><span>En espera</span></div><div class=\"estadistica estadistica-dentro\"><strong>" + conteo.DENTRO + "</strong><span>Dentro ahora</span></div><div class=\"estadistica\"><strong>" + lista.length + "</strong><span>Total histórico</span></div>";
    if (resumen && sesion.rol === SR.roles.RECEPCION) resumen.insertAdjacentHTML("beforeend", "<div class=\"estadistica estadistica-pre\"><strong>" + lista.filter(function (v) { return v.origen === "PISO" && v.estado === estados.PROGRAMADA; }).length + "</strong><span>Pre-registros de piso</span></div>");
    var tabla = document.getElementById("tabla-visitas"); if (!tabla) return;
    if (!lista.length) { tabla.innerHTML = "<p class=\"texto-secundario\">Aún no hay visitas registradas.</p>"; return; }
    tabla.innerHTML = "<div class=\"tabla-herramientas\"><label class=\"busqueda\"><span>Buscar visita</span><input id=\"buscar-visitas\" type=\"search\" placeholder=\"Folio, visitante o anfitrión\"></label><select id=\"filtro-estado\" aria-label=\"Filtrar por estado\"><option value=\"TODOS\">Todos los estados</option>" + Object.keys(estados).map(function (k) { return '<option value="' + estados[k] + '">' + estados[k].replace("_", " ") + '</option>'; }).join("") + "</select></div><table><thead><tr><th>Folio</th><th>Visitante e identificacion</th><th>Destino</th><th>Fecha/hora</th><th>Origen</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>" + lista.map(function (v) {
      var e = SR.empresas.porId(v.empresaId), acciones = "";
      var etiquetaLlegada = v.origen === "PISO" ? "Validar llegada" : "Registrar llegada";
      var origenTexto = v.origen === "PISO" ? "Pre-registro de piso" : "Registro en recepcion";
      if (v.estado === estados.PROGRAMADA) {
        acciones = '<button class="boton boton-mini" data-qr="' + v.id + '">Ver QR</button>';
        if (sesion.rol === SR.roles.RECEPCION) acciones += ' <button class="boton boton-mini" data-llegada="' + v.id + '">' + etiquetaLlegada + '</button>';
        if (sesion.rol !== SR.roles.RECEPCION) acciones += ' <button class="boton boton-mini boton-peligro" data-cancelar="' + v.id + '">Cancelar</button>';
      } else if (v.estado === estados.EN_ESPERA && sesion.rol === SR.roles.RECEPCION) acciones = '<button class="boton boton-mini" data-autorizar="' + v.id + '">Autorizar</button> <button class="boton boton-mini boton-peligro" data-rechazar="' + v.id + '">Rechazar</button>';
      else if (v.estado === estados.AUTORIZADA && sesion.rol === SR.roles.RECEPCION) acciones = '<button class="boton boton-mini" data-qr="' + v.id + '">Ver QR</button> <button class="boton boton-mini" data-entrada="' + v.id + '">Registrar entrada</button>';
      else if (v.estado === estados.DENTRO && sesion.rol === SR.roles.RECEPCION) acciones = '<button class="boton boton-mini" data-qr="' + v.id + '">Ver QR</button> <button class="boton boton-mini" data-salida="' + v.id + '">Registrar salida</button>';
      else acciones = '<button class="boton boton-mini" data-qr="' + v.id + '">Ver QR/gafete</button>';
      return "<tr><td><strong>" + esc(v.folio) + "</strong></td><td>" + esc(v.visitante) + "<small class=\"identificacion-" + (v.identificacionPresentada === false ? "no" : "si") + "\">" + textoIdentificacion(v) + "</small></td><td><strong>Piso " + esc(v.piso) + "</strong><small>" + esc(v.empresaNombre || (e ? e.nombre : "Sin empresa especifica")) + "</small><small>Anfitrion: " + esc(v.anfitrion) + (v.anfitrionPuesto ? " - " + esc(v.anfitrionPuesto) : "") + "</small><small>Motivo: " + esc(v.motivo) + "</small></td><td>" + fecha(v.fecha) + "<br>" + esc(v.hora) + "</td><td><span class=\"origen origen-" + String(v.origen || "RECEPCION").toLowerCase() + "\">" + origenTexto + "</span></td><td><span class=\"estado estado-" + v.estado.toLowerCase() + "\">" + v.estado.replace("_", " ") + "</span></td><td>" + acciones + "</td></tr>";
    }).join("") + "</tbody></table>";
    var buscar = tabla.querySelector("#buscar-visitas"), filtro = tabla.querySelector("#filtro-estado");
    function filtrar() { var termino = String(buscar.value || "").toLowerCase().trim(), estado = filtro.value; tabla.querySelectorAll("tbody tr").forEach(function (fila) { var coincideTexto = !termino || fila.textContent.toLowerCase().indexOf(termino) >= 0, coincideEstado = estado === "TODOS" || fila.textContent.indexOf(estado.replace("_", " ")) >= 0; fila.hidden = !(coincideTexto && coincideEstado); }); }
    buscar.addEventListener("input", filtrar); filtro.addEventListener("change", filtrar);
    function procesar(operacion) {
      operacion.then(function () { return actualizar(sesion); }).catch(function (error) {
        var mensajeOperacion = document.getElementById("mensaje-visita");
        if (mensajeOperacion) { mensajeOperacion.hidden = false; mensajeOperacion.className = "alerta alerta-error"; mensajeOperacion.textContent = error.message; }
      });
    }
    tabla.querySelectorAll("[data-llegada]").forEach(function (b) { b.onclick = function () { procesar(SR.visitas.marcarLlegada(b.dataset.llegada)); }; });
    tabla.querySelectorAll("[data-autorizar]").forEach(function (b) { b.onclick = function () { procesar(SR.visitas.autorizar(b.dataset.autorizar)); }; });
    tabla.querySelectorAll("[data-rechazar]").forEach(function (b) { b.onclick = function () { var motivo = prompt("Motivo del rechazo:"); if (motivo !== null) procesar(SR.visitas.rechazar(b.dataset.rechazar, sesion, motivo)); }; });
    tabla.querySelectorAll("[data-entrada]").forEach(function (b) { b.onclick = function () { procesar(SR.visitas.registrarEntrada(b.dataset.entrada)); }; });
    tabla.querySelectorAll("[data-salida]").forEach(function (b) { b.onclick = function () { procesar(SR.visitas.registrarSalida(b.dataset.salida)); }; });
    tabla.querySelectorAll("[data-cancelar]").forEach(function (b) { b.onclick = function () { procesar(SR.visitas.cancelar(b.dataset.cancelar)); }; });
    tabla.querySelectorAll("[data-qr]").forEach(function (b) { b.onclick = function () { mostrarQr(b.dataset.qr); }; });
  }
  function configurarAnfitrion(sesion) {
    var selector = document.getElementById("anfitrion-directorio"), nombre = document.getElementById("anfitrion"), puesto = document.getElementById("anfitrion-puesto");
    if (!selector || !SR.directorio) return;
    var todos = SR.directorio.todos(), contactos = sesion.rol === SR.roles.RECEPCION ? todos : todos.filter(function (c) { return Number(c.piso) === Number(sesion.empresa ? sesion.empresa.piso : sesion.piso); });
    selector.innerHTML = '<option value="">Seleccionar del directorio...</option><option value="manual">No aparece: registrar persona</option>' + contactos.map(function (c, i) { return '<option value="dir-' + (i + 1) + '">' + esc(c.nombre) + ' - piso ' + esc(c.piso) + '</option>'; }).join("");
    selector.onchange = function () {
      var valor = selector.value, indice = valor.indexOf("dir-") === 0 ? Number(valor.slice(4)) - 1 : -1, contacto = contactos[indice];
      if (!contacto) { nombre.value = ""; puesto.value = ""; nombre.readOnly = false; puesto.readOnly = false; return; }
      nombre.value = contacto.nombre; puesto.value = contacto.empresa || "Contacto del edificio"; nombre.readOnly = true; puesto.readOnly = true;
    };
  }

  function configurarDestino(sesion) {
    var selector = document.getElementById("anfitrion-directorio"), piso = document.getElementById("piso-visita"), empresa = document.getElementById("empresa-visita");
    if (!selector || !piso || !SR.directorio) return;
    var todos = SR.directorio.todos(), contactos = sesion.rol === SR.roles.RECEPCION ? todos : todos.filter(function (c) { return Number(c.piso) === Number(sesion.empresa ? sesion.empresa.piso : sesion.piso); });
    function aplicar() {
      var valor = selector.value, indice = valor.indexOf("dir-") === 0 ? Number(valor.slice(4)) - 1 : -1, contacto = contactos[indice];
      if (contacto) {
        piso.value = String(contacto.piso);
        piso.disabled = true;
        if (empresa && contacto.empresa) {
          var opcion = Array.prototype.slice.call(empresa.options).find(function (o) { var e = SR.empresas.porId(o.value); return e && e.nombre === contacto.empresa && Number(e.piso) === Number(contacto.piso); });
          if (opcion) empresa.value = opcion.value;
          empresa.disabled = true;
        } else if (empresa) {
          empresa.disabled = false;
        }
      } else {
        if (empresa) { empresa.disabled = false; empresa.value = ""; }
        piso.disabled = false;
        if (sesion.rol !== SR.roles.RECEPCION && (sesion.empresa || sesion.piso)) piso.value = String(sesion.empresa ? sesion.empresa.piso : sesion.piso);
        else piso.value = "";
      }
    }
    selector.addEventListener("change", aplicar);
    if (sesion.rol !== SR.roles.RECEPCION && (sesion.empresa || sesion.piso)) piso.value = String(sesion.empresa ? sesion.empresa.piso : sesion.piso);
    aplicar();
  }

  function configurarIdentificacion() {
    var presentado = document.getElementById("identificacion-presentada"), campo = document.getElementById("campo-tipo-identificacion"), tipo = document.getElementById("identificacion-tipo"), aviso = document.getElementById("aviso-sin-identificacion");
    if (!presentado || !campo || !tipo) return;
    function actualizar() {
      var siPresenta = presentado.value !== "NO";
      campo.hidden = !siPresenta;
      tipo.required = siPresenta;
      if (!siPresenta) tipo.value = "";
      if (aviso) aviso.hidden = siPresenta;
    }
    presentado.addEventListener("change", actualizar);
    actualizar();
  }

  function actualizar(sesion) {
    return render(sesion).catch(function (error) {
      var tabla = document.getElementById("tabla-visitas");
      if (tabla) tabla.textContent = error.message;
    });
  }

  function iniciar(sesion) {
    var mensajeDirectorio = document.getElementById("mensaje-visita") || document.getElementById("tabla-visitas");
    SR.directorio.cargar().then(function () {
      iniciarConDirectorio(sesion);
    }).catch(function (error) {
      if (mensajeDirectorio) {
        mensajeDirectorio.hidden = false;
        mensajeDirectorio.className = "alerta alerta-error";
        mensajeDirectorio.textContent = error.message;
      }
    });
  }

  function iniciarConDirectorio(sesion) {
    var form = document.getElementById("form-visita"), empresa = document.getElementById("empresa-visita"), mensaje = document.getElementById("mensaje-visita"), empresas = SR.empresas.todas();
    var etiquetaDocumento = document.querySelector('label[for="documento"]'), etiquetaTipo = document.querySelector('label[for="tipo-identificacion"]');
    if (etiquetaDocumento) etiquetaDocumento.textContent = "N\u00famero de identificaci\u00f3n";
    if (etiquetaTipo) etiquetaTipo.textContent = "Tipo de identificaci\u00f3n";
    if (form) {
      var anfitrionCampo = document.getElementById("anfitrion-directorio").parentElement;
      var empresaCampo = empresa ? empresa.parentElement : document.getElementById("piso-visita").parentElement;
      if (anfitrionCampo && empresaCampo) form.insertBefore(anfitrionCampo, empresaCampo);
    }
    if (empresa) {
      var empresasDisponibles = sesion.rol === SR.roles.PISO ? empresas.filter(function (e) { return Number(e.piso) === Number(sesion.piso); }) : empresas;
      empresa.innerHTML = (sesion.rol === SR.roles.PISO ? '<option value="">Sin empresa especifica</option>' : '<option value="">Seleccionar empresa...</option>') + empresasDisponibles.map(function (e) { return '<option value="' + e.id + '">' + esc(e.nombre) + ' (piso ' + e.piso + ')</option>'; }).join("");
    }
    var campoFecha = document.getElementById("fecha-visita");
    if (campoFecha) campoFecha.min = hoy();
    var directorio = document.getElementById("lista-directorio"); if (directorio) directorio.innerHTML = empresas.map(function (e) { return "<article class=\"directorio-item\"><strong>" + esc(e.nombre) + "</strong><span>Piso " + e.piso + " · Recepción de visitas</span></article>"; }).join("");
    configurarAnfitrion(sesion);
    configurarDestino(sesion);
    configurarIdentificacion();
    var opciones = document.getElementById("directorio-opciones");
    if (opciones && SR.directorio) opciones.innerHTML = SR.directorio.todos().map(function (c) { return '<option value="' + esc(c.nombre) + '">Piso ' + esc(c.piso) + ' · ' + esc(c.empresa || "Contacto del edificio") + '</option>'; }).join("");
    if (directorio && SR.directorio) {
      var contactos = SR.directorio.todos();
      directorio.innerHTML = contactos.map(function (c) {
        var detalle = c.empresa || "Contacto del edificio";
        return "<article class=\"directorio-item\"><span class=\"directorio-piso\">Piso " + esc(c.piso) + "</span><strong>" + esc(c.nombre) + "</strong><span>" + esc(detalle) + "</span><a class=\"directorio-telefono\" href=\"tel:" + esc(c.celular) + "\">" + esc(c.celular) + "</a></article>";
      }).join("");
    }
    var btn = document.getElementById("btn-directorio"), dir = document.getElementById("directorio"); if (btn && dir) btn.onclick = function () { dir.hidden = !dir.hidden; };
    if (form) form.onsubmit = function (ev) {
      ev.preventDefault();
      var selectorAnfitrion = document.getElementById("anfitrion-directorio");
      var empresaNombreCampo = document.getElementById("empresa-nombre");
      var datos = {
        visitante: document.getElementById("visitante").value,
        identificacionPresentada: document.getElementById("identificacion-presentada").value,
        identificacionTipo: document.getElementById("identificacion-tipo") ? document.getElementById("identificacion-tipo").value : "",
        piso: document.getElementById("piso-visita").value,
        empresaId: empresa ? empresa.value : null,
        empresaNombre: empresaNombreCampo ? empresaNombreCampo.value : "",
        anfitrion: document.getElementById("anfitrion").value,
        anfitrionPuesto: document.getElementById("anfitrion-puesto").value,
        anfitrionOrigen: selectorAnfitrion && selectorAnfitrion.value.indexOf("dir-") === 0 ? "DIRECTORIO" : "MANUAL",
        anfitrionContactoId: selectorAnfitrion && selectorAnfitrion.value.indexOf("dir-") === 0 ? selectorAnfitrion.value : null,
        motivo: document.getElementById("motivo").value,
        fecha: document.getElementById("fecha-visita").value,
        hora: document.getElementById("hora-visita").value
      };
      mensaje.hidden = true;
      SR.visitas.crear(datos).then(function (resultado) {
        mensaje.hidden = false;
        mensaje.className = "alerta alerta-exito";
        mensaje.textContent = "Visita creada con folio " + resultado.visita.folio;
        form.reset();
        configurarAnfitrion(sesion);
        configurarDestino(sesion);
        configurarIdentificacion();
        return actualizar(sesion);
      }).catch(function (error) {
        mensaje.hidden = false;
        mensaje.className = "alerta alerta-error";
        mensaje.textContent = error.message;
      });
    };
    actualizar(sesion);
  }
  SR.visitasUI = Object.freeze({ iniciar: iniciar });
})(window.SR = window.SR || {});
