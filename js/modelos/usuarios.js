/**
 * usuarios.js
 * Consultas sobre usuarios del sistema (recepción y empresas).
 * Nota: los usuarios NO son visitantes ni empleados del directorio.
 */
(function (SR) {
  "use strict";

  function todos() {
    return SR.storage.obtener(SR.storage.CLAVES.USUARIOS, []);
  }

  SR.usuarios = Object.freeze({
    porId: function (id) {
      return todos().find(function (u) { return u.id === id; }) || null;
    },
    porNombreUsuario: function (usuario) {
      var buscado = String(usuario || "").trim().toLowerCase();
      return todos().find(function (u) {
        return u.usuario.toLowerCase() === buscado;
      }) || null;
    }
  });
})(window.SR = window.SR || {});
