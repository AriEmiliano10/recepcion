/**
 * empresa.js
 * Controlador del panel de empresa. Solo accesible con rol EMPRESA.
 * Todo lo que se muestre aquí debe limitarse a sesion.empresa.
 */
(function (SR) {
  "use strict";

  var rolPagina = document.body.classList.contains("pagina-piso") ? SR.roles.PISO : SR.roles.EMPRESA;
  SR.encabezado.montarPaginaProtegida(rolPagina).then(function (sesion) {
    if (!sesion) return;
    document.getElementById(sesion.empresa ? "empresa-nombre" : "piso-nombre").textContent = sesion.empresa ? sesion.empresa.nombre : "Perfil de piso " + sesion.piso;
    document.getElementById("empresa-piso").textContent = "Piso " + (sesion.empresa ? sesion.empresa.piso : sesion.piso);
    document.title = (sesion.empresa ? sesion.empresa.nombre : "Perfil de piso " + sesion.piso) + " · Sistema de Recepción";
    SR.visitasUI.iniciar(sesion);
  });
})(window.SR = window.SR || {});
