# Validador de cumplimiento · vista del prototipo

Vista estática del prototipo del Trabajo Final de Grado "Automatización de la
verificación normativa de modelos de inteligencia artificial en ComplianceTech
Europa" (Nicolás Cozzarin, Universidad Siglo 21).

Sitio: https://nicolas-cozzarin.github.io/validador-prototipo/

Reproduce las tres pantallas del prototipo (Ejecuciones, Validación manual e
Integración) con los datos de una ejecución real del validador contra GraphDB
10.8: el pipeline del Banco Aurora con la versión v1 (conforme) y la v2 (con
sesgo, frenada por R5), y la validación manual de las dos fichas de ejemplo.

GitHub Pages solo sirve archivos estáticos. Por eso esta vista no valida fichas
nuevas: el prototipo completo, con GraphDB y validación en vivo, se instala con
Docker siguiendo el README del repositorio validador.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `estilos.css`, `app.js` | La página. Arma las pantallas con `datos.json` |
| `datos.json` | Resultados de la ejecución real |
| `exportar_datos.py` | Genera `datos.json`: corre el pipeline del banco y la validación manual contra un GraphDB local |

## Volver a generar los datos

Con los repos `validador` y `banco-aurora-modelo-credito` al lado de esta
carpeta, el validador instalado y GraphDB corriendo en la computadora:

```bash
python exportar_datos.py
```

El script vacía el repositorio historial, por eso solo acepta un GraphDB local.
