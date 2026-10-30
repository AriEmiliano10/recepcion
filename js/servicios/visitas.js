/** Servicio de visitas: conserva una copia de lectura y delega cambios al backend. */
(function (SR) {
  "use strict";

  var ESTADOS = Object.freeze({
    PROGRAMADA: "PROGRAMADA",
    EN_ESPERA: "EN_ESPERA",
    AUTORIZADA: "AUTORIZADA",
    RECHAZADA: "RECHAZADA",
    DENTRO: "DENTRO",
    FINALIZADA: "FINALIZADA",
    CANCELADA: "CANCELADA"
  });
  var cache = [];

  function todas() {
    return SR.api.solicitar("visits").then(function (resultado) {
      cache = resultado.visitas;
      return cache.slice();
    });
  }

  function visibles() {
    return todas();
  }

  function buscar(id) {
    return cache.find(function (visita) { return visita.id === id; }) || null;
  }

  function porEmpresa(empresaId) {
    return cache.filter(function (visita) { return visita.empresaId === empresaId; });
  }

  function crear(datos) {
    return SR.api.solicitar("visits", { method: "POST", body: datos }).then(function (resultado) {
      cache.unshift(resultado.visita);
      return resultado;
    });
  }

  function operar(id, accion, datos) {
    return SR.api.solicitar("visits/" + encodeURIComponent(id) + "/" + accion, {
      method: "POST",
      body: datos || {}
    }).then(function (resultado) {
      var indice = cache.findIndex(function (visita) { return visita.id === id; });
      if (indice >= 0) cache[indice] = resultado.visita;
      return resultado;
    });
  }

  SR.visitas = Object.freeze({
    ESTADOS: ESTADOS,
    todas: todas,
    visibles: visibles,
    porEmpresa: porEmpresa,
    buscar: buscar,
    crear: crear,
    marcarLlegada: function (id) { return operar(id, "arrival"); },
    autorizar: function (id) { return operar(id, "authorize"); },
    rechazar: function (id, sesion, motivo) { return operar(id, "reject", { motivo: motivo }); },
    registrarEntrada: function (id) { return operar(id, "entry"); },
    registrarSalida: function (id) { return operar(id, "exit"); },
    cancelar: function (id) { return operar(id, "cancel"); }
  });
})(window.SR = window.SR || {});
