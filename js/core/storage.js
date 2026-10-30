/**
 * storage.js
 * Único punto de acceso a localStorage y sessionStorage para catálogos estáticos.
 */
(function (SR) {
  "use strict";

  var PREFIJO = "sr_";

  var CLAVES = Object.freeze({
    USUARIOS: PREFIJO + "usuarios",
    EMPRESAS: PREFIJO + "empresas",
    DIRECTORIO: PREFIJO + "directorio",
    VISITAS: PREFIJO + "visitas",
    VERSION_SEMILLA: PREFIJO + "version_semilla",
    SESION: PREFIJO + "sesion"
  });

  function leer(almacen, clave, valorPorDefecto) {
    try {
      var crudo = almacen.getItem(clave);
      return crudo === null ? valorPorDefecto : JSON.parse(crudo);
    } catch (e) {
      console.error("[storage] No se pudo leer la clave:", clave, e);
      return valorPorDefecto;
    }
  }

  function escribir(almacen, clave, valor) {
    try {
      almacen.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      console.error("[storage] No se pudo escribir la clave:", clave, e);
      return false;
    }
  }

  SR.storage = Object.freeze({
    CLAVES: CLAVES,

    // Datos persistentes (localStorage)
    obtener: function (clave, valorPorDefecto) {
      return leer(window.localStorage, clave, valorPorDefecto);
    },
    guardar: function (clave, valor) {
      return escribir(window.localStorage, clave, valor);
    },
    eliminar: function (clave) {
      try {
        window.localStorage.removeItem(clave);
        return true;
      } catch (e) {
        console.error("[storage] No se pudo eliminar la clave:", clave, e);
        return false;
      }
    },

    // Datos de la pestaña actual (sessionStorage)
    obtenerSesion: function (clave) {
      return leer(window.sessionStorage, clave, null);
    },
    guardarSesion: function (clave, valor) {
      return escribir(window.sessionStorage, clave, valor);
    },
    eliminarSesion: function (clave) {
      window.sessionStorage.removeItem(clave);
    }
  });
})(window.SR = window.SR || {});
