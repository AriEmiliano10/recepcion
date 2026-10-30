/**
 * empresas.js
 * Consultas sobre el catálogo de empresas del edificio.
 */
(function (SR) {
  "use strict";

  function todas() {
    return SR.storage.obtener(SR.storage.CLAVES.EMPRESAS, []);
  }

  SR.empresas = Object.freeze({
    todas: todas,
    porId: function (id) {
      return todas().find(function (e) { return e.id === id; }) || null;
    }
  });
})(window.SR = window.SR || {});
