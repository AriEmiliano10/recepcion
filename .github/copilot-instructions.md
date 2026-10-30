# Instrucciones del proyecto

Este proyecto es un sistema web para control de visitantes
de un edificio.

## Tecnologías actuales

- HTML5
- CSS3
- JavaScript
- HTML, CSS, JavaScript sin framework
- Netlify Functions y PostgreSQL/Neon para cuentas y visitas compartidas

## Reglas

- No utilizar React por ahora.
- No crear funcionalidades de hardware.
- No implementar reconocimiento facial.
- No implementar control de puertas.
- Mantener separación entre recepción y empresas.
- Los empleados del edificio no son visitantes.
- El QR identifica una visita, no autoriza por sí mismo.
- Evitar duplicar información.
- Mantener el código modular.
- No modificar funcionalidades existentes sin explicar primero el cambio.

## Objetivo

La información de una visita debe capturarse una sola vez.

Una empresa registra previamente la visita.
Recepción recibe la información.
Recepción verifica y autoriza.
Se genera el QR.
Se registra entrada y posteriormente salida.