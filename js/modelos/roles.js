/**
 * roles.js
 * Definición central de roles. Única fuente de verdad sobre
 * qué roles existen, a qué panel van y qué requieren.
 */
(function (SR) {
  "use strict";

  var ROLES = Object.freeze({
    RECEPCION: Object.freeze({
      clave: "RECEPCION",
      etiqueta: "Recepción",
      panel: "recepcion.html",
      requiereEmpresa: false
    }),
    EMPRESA: Object.freeze({
      clave: "EMPRESA",
      etiqueta: "Empresa",
      panel: "empresa.html",
      requiereEmpresa: true
    }),
    PISO: Object.freeze({
      clave: "PISO",
      etiqueta: "Perfil de piso",
      panel: "piso.html",
      requiereEmpresa: false,
      requierePiso: true
    })
  });

  SR.roles = Object.freeze({
    RECEPCION: ROLES.RECEPCION.clave,
    EMPRESA: ROLES.EMPRESA.clave,
    PISO: ROLES.PISO.clave,

    esValido: function (clave) {
      return Object.prototype.hasOwnProperty.call(ROLES, clave);
    },
    obtener: function (clave) {
      return ROLES[clave] || null;
    }
  });
})(window.SR = window.SR || {});
