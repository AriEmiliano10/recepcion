/* Consultas del directorio físico de recepción. */
(function (SR) {
  "use strict";
  var contactos = [];
  function cargar() {
    return SR.api.solicitar("directory").then(function (resultado) {
      contactos = resultado.directorio || [];
      return todos();
    });
  }
  function todos() {
    return contactos.slice();
  }
  SR.directorio = Object.freeze({ cargar: cargar, todos: todos });
})(window.SR = window.SR || {});
