/**
 * Catálogo de empresas sin datos personales; las cuentas, visitas y contactos
 * se administran en el backend.
 */
(function (SR) {
  "use strict";

  var VERSION = 6;
  var EMPRESAS = [
    { id: "emp-001", nombre: "Consultores Alfa", piso: 3 },
    { id: "emp-003", nombre: "GRUPO INTEGRAL GLEOS, S.A. DE C.V.", piso: 1 },
    { id: "emp-004", nombre: "CASA TAVINHO", piso: 1 },
    { id: "emp-005", nombre: "STE", piso: 2 },
    { id: "emp-006", nombre: "OFI STORE", piso: 3 },
    { id: "emp-007", nombre: "RECURSOS HUMANOS", piso: 3 },
    { id: "emp-008", nombre: "OFI STORE", piso: 5 },
    { id: "emp-009", nombre: "MARABIAS", piso: 5 },
    { id: "emp-010", nombre: "EVTEK S.A. DE C.V.", piso: 5 },
    { id: "emp-002", nombre: "Tecnologías Beta", piso: 5 }
  ];

  function inicializar() {
    var s = SR.storage;
    var versionActual = s.obtener(s.CLAVES.VERSION_SEMILLA, 0);
    if (versionActual >= VERSION) {
      var empresasGuardadas = s.obtener(s.CLAVES.EMPRESAS, []);
      var idsGuardados = empresasGuardadas.map(function (e) { return e.id; });
      var faltantes = EMPRESAS.filter(function (e) { return idsGuardados.indexOf(e.id) < 0; });
      if (faltantes.length) s.guardar(s.CLAVES.EMPRESAS, empresasGuardadas.concat(faltantes));
      s.eliminar(s.CLAVES.DIRECTORIO);
      return;
    }

    s.guardar(s.CLAVES.EMPRESAS, EMPRESAS);
    s.eliminar(s.CLAVES.DIRECTORIO);
    s.guardar(s.CLAVES.VERSION_SEMILLA, VERSION);
  }

  SR.semilla = Object.freeze({ inicializar: inicializar });
})(window.SR = window.SR || {});
