/**
 * encabezado.js
 * Montaje común de páginas protegidas: valida el rol, muestra
 * los datos de la sesión y conecta el botón de cerrar sesión.
 */
(function (SR) {
  "use strict";

  function texto(id, valor) {
    var el = document.getElementById(id);
    if (el) el.textContent = valor;
  }

  function mostrarError(error) {
    var app = document.getElementById("app");
    if (!app) return;
    app.hidden = false;
    var aviso = document.createElement("p");
    aviso.className = "alerta alerta-error";
    aviso.setAttribute("role", "alert");
    aviso.textContent = error.message;
    app.insertBefore(aviso, app.firstChild);
  }

  /**
   * Inicializa una página protegida para el rol indicado.
   * Devuelve la sesión o null si hubo redirección.
   */
  function montarPaginaProtegida(rolRequerido) {
    SR.semilla.inicializar();

    return SR.auth.protegerPagina(rolRequerido).then(function (sesion) {
      if (!sesion) return null;

      texto("sesion-nombre", sesion.nombre);
      texto("sesion-rol", sesion.rolEtiqueta);

      var btnSalir = document.getElementById("btn-cerrar-sesion");
      if (btnSalir) btnSalir.addEventListener("click", function () {
        SR.auth.cerrarSesion().catch(mostrarError);
      });

      document.getElementById("app").hidden = false;
      return sesion;
    }).catch(function (error) {
      mostrarError(error);
      return null;
    });
  }

  // Si el navegador restaura la página desde caché (botón "Atrás")
  // tras cerrar sesión, se vuelve a validar.
  window.addEventListener("pageshow", function (evento) {
    if (evento.persisted) {
      SR.auth.sesionActual().then(function (sesion) {
        if (!sesion) window.location.replace("index.html");
      }).catch(mostrarError);
    }
  });

  SR.encabezado = Object.freeze({ montarPaginaProtegida: montarPaginaProtegida });
})(window.SR = window.SR || {});
