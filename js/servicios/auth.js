/**
 * auth.js
 * Autenticación y control de sesión mediante la cookie HttpOnly del backend.
 */
(function (SR) {
  "use strict";

  var PAGINA_LOGIN = "index.html";

  function iniciarSesion(nombreUsuario, contrasena) {
    if (!String(nombreUsuario || "").trim() || !contrasena) {
      return Promise.reject(new Error("Ingresa usuario y contraseña."));
    }
    return SR.api.solicitar("auth/login", {
      method: "POST",
      body: { usuario: nombreUsuario, contrasena: contrasena }
    }).then(function (resultado) {
      return resultado.sesion;
    });
  }

  function cerrarSesion() {
    return SR.api.solicitar("auth/logout", { method: "POST", body: {} }).then(function () {
      window.location.replace(PAGINA_LOGIN);
    });
  }

  function sesionActual() {
    return SR.api.solicitar("auth/session").then(function (resultado) {
      return resultado.sesion;
    }).catch(function (error) {
      if (error.status === 401) return null;
      throw error;
    });
  }

  function protegerPagina(rolRequerido) {
    return sesionActual().then(function (sesion) {
      if (!sesion) {
        window.location.replace(PAGINA_LOGIN);
        return null;
      }
      if (sesion.rol !== rolRequerido) {
        window.location.replace(sesion.panel);
        return null;
      }
      return sesion;
    });
  }

  function irAPanel(sesion) {
    window.location.replace(sesion.panel);
  }

  SR.auth = Object.freeze({
    iniciarSesion: iniciarSesion,
    cerrarSesion: cerrarSesion,
    sesionActual: sesionActual,
    protegerPagina: protegerPagina,
    irAPanel: irAPanel
  });
})(window.SR = window.SR || {});
