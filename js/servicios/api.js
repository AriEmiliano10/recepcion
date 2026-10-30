/** Cliente HTTP para las funciones del backend de Netlify. */
(function (SR) {
  "use strict";

  async function solicitar(ruta, opciones) {
    var config = opciones || {};
    var respuesta = await fetch("/api/" + ruta, {
      method: config.method || "GET",
      credentials: "same-origin",
      headers: config.body === undefined ? {} : { "Content-Type": "application/json" },
      body: config.body === undefined ? undefined : JSON.stringify(config.body)
    });
    var resultado;
    var cuerpo = await respuesta.text();
    try {
      resultado = JSON.parse(cuerpo);
    } catch (error) {
      if (respuesta.status === 401 && /edge-access|login redirect/i.test(cuerpo)) {
        throw new Error("Netlify está bloqueando el acceso al sitio. Revisa Visitor access en la configuración del deploy.");
      }
      throw new Error("El servidor devolvió una respuesta no válida.");
    }
    if (!respuesta.ok || !resultado.ok) {
      var problema = new Error(resultado.error || "La API respondió con HTTP " + respuesta.status + " sin detalle del error.");
      problema.status = respuesta.status;
      throw problema;
    }
    return resultado;
  }

  SR.api = Object.freeze({ solicitar: solicitar });
})(window.SR = window.SR || {});
