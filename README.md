# Subtítulos IA

Complemento Stremio sin dependencias npm ni compilación. Busca películas y episodios por IMDb en OpenSubtitles REST y OpenSubtitles de Stremio. Conserva los originales y ofrece hasta tres traducciones al español, priorizando inglés.

## Traducción sin clave

Funciona sin cuenta ni clave mediante el endpoint **no oficial Google Translate (gtx)**. No tiene garantía de disponibilidad, cuota o estabilidad; puede bloquear peticiones y envía el diálogo a Google. Respeta las condiciones y derechos de los proveedores.

`MISTRAL_API_KEY` es una mejora opcional de calidad: se intenta Mistral primero, en lotes de 40 diálogos. Los HTTP 429 se reintentan tras 2, 5 y 15 segundos. Si sigue fallando (o hay otro error), el resto del archivo usa Google. El proveedor elegido aparece en los logs; un archivo puede contener lotes de ambos proveedores. Google segmenta peticiones de hasta 1500 caracteres. Números y marcas de tiempo SRT no se traducen. Se enmascaran etiquetas de formato y se restauran. Descarga gzip; admite UTF-8, Windows-1252 y MacRoman.

## Local (Node 22+)

```sh
cp .env.example .env
# Sin clave funciona; opcionalmente configura MISTRAL_API_KEY.
node --env-file=.env server.js
# O directamente, sin configuración:
# node server.js
```

Abre http://localhost:7111; manifest: http://localhost:7111/manifest.json.

```sh
npm test
# Servidor ya iniciado: verifica manifest, película, serie y traducción REAL completa.
# Puede tardar minutos y consumir cuota si Mistral está configurado.
node scripts/verify.js
# Otro servidor:
BASE_URL=https://tu-dominio node scripts/verify.js
```

El verificador comprueba diálogo español, números/marcas de tiempo idénticos al original y ausencia de marcadores pendientes. Depende de proveedores reales; termina con código no cero ante fallos.

### Variables

- `MISTRAL_API_KEY`: opcional; nunca publiques `.env`.
- `MISTRAL_MODEL`: `mistral-small-latest` por defecto.
- `TOKEN_SECRET`: secreto de firma HMAC estable. **Configúralo en producción y con varias instancias**, incluso usando Google sin clave. Si falta, se usa la clave Mistral o un secreto aleatorio por proceso (los enlaces dejan de funcionar al reiniciar o cambiar instancia).
- `PUBLIC_BASE_URL`: URL pública opcional para proxy/dominio.
- `PORT`: 7111 por defecto (Node).

## Vercel

Importa el repositorio; framework **Other**, sin comando de compilación ni directorio de salida. Configura `TOKEN_SECRET` y, opcionalmente, `MISTRAL_API_KEY`. `vercel.json` dirige las rutas a `api/index.js` con máximo solicitado de 300 s. La duración disponible depende del plan y puede no permitir películas completas. Configura `PUBLIC_BASE_URL=https://tu-proyecto.vercel.app` si hay proxy. No se ha desplegado ni verificado alojamiento cloud.

## Cloudflare Workers

```sh
npx wrangler secret put TOKEN_SECRET
# Opcional:
# npx wrangler secret put MISTRAL_API_KEY
npx wrangler deploy
```

`wrangler.toml` usa `worker.js`, sin compatibilidad Node ni build propio. Los límites gratuitos de subrequests/CPU pueden impedir subtítulos largos, especialmente Google y reintentos. Usa Node o alojamiento con duración suficiente; no se promete que cada título quepa en el plan gratuito.

## Deno

Entrada `deno.js`; configura `TOKEN_SECRET` y opcionalmente `MISTRAL_API_KEY`. Local: `deno run --allow-net --allow-env deno.js`. La configuración de despliegue y límites depende del alojamiento Deno elegido.

## Instalar para la familia

1. Despliega y comparte solo `https://tu-dominio/manifest.json`, no secretos.
2. Stremio → Complementos → Addon URL → Instalar; también está el botón de la página inicial.
3. Selecciona **🤖 Traducido al español (IA)**; identificador `ia-...` (algunos clientes no muestran el campo `m`). Google no es un modelo IA generativo, aunque comparte esta etiqueta de traducción automática.
4. Primera carga: puede tardar minutos; si el cliente agota su espera, vuelve a seleccionarlo tras terminar. Originales españoles se ofrecen sin traducción.

HTTPS debe ser accesible desde los dispositivos; localhost solo funciona en la misma máquina. El alojamiento gratuito no hace gratuita la API Mistral.

## Diseño y límites

- `core.js`: Fetch portable; `server.js`: Node; `api/index.js`: Vercel; `worker.js`: Workers; `deno.js`: Deno.
- CORS abierto. Fuentes/Google: 10 s por petición; Mistral: 60 s por intento. Errores de traducción/descarga: 502, nunca contenido inventado. Si fallan ambos buscadores se devuelve una lista vacía.
- Tokens HMAC-SHA256 y lista de hosts permitidos; los tokens no contienen la clave. Cambiar el secreto invalida enlaces.
- Caché LRU de 32 archivos y deduplicación concurrente por proceso. No persistente ni compartida entre instancias.
- Sin autenticación ni cuota por usuario: una URL pública permite consumir cuota. Limita acceso y presupuesto antes de divulgarla.
- SRT/VTT; se normaliza VTT a SRT, se excluye ASS. Puede haber errores de traducción; no ajusta sincronización/FPS. No aloja vídeos.
