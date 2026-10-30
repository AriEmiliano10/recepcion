/**
 * recepcion.js
 * Controlador del panel de recepción. Solo accesible con rol RECEPCION.
 */
(function (SR) {
  "use strict";

  SR.encabezado.montarPaginaProtegida(SR.roles.RECEPCION).then(function (sesion) {
    if (sesion) SR.visitasUI.iniciar(sesion);
  });
})(window.SR = window.SR || {});
