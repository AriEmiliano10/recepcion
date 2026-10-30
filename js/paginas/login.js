/**
 * login.js
 * Controlador de inicio de sesión.
 */
(function (SR) {
  "use strict";

  SR.semilla.inicializar();

  var form = document.getElementById("form-login");
  var error = document.getElementById("login-error");

  function mostrarError(mensaje) {
    error.textContent = mensaje;
    error.hidden = false;
  }

  SR.auth.sesionActual().then(function (sesion) {
    if (sesion) SR.auth.irAPanel(sesion);
  }).catch(function (problema) {
    mostrarError(problema.message);
  });

  form.addEventListener("submit", function (evento) {
    evento.preventDefault();
    error.hidden = true;
    var boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;

    SR.auth.iniciarSesion(form.usuario.value, form.contrasena.value).then(function (sesion) {
      SR.auth.irAPanel(sesion);
    }).catch(function (problema) {
      mostrarError(problema.message);
      form.contrasena.value = "";
      form.contrasena.focus();
    }).finally(function () {
      boton.disabled = false;
    });
  });
})(window.SR = window.SR || {});
