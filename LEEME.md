# La palabra oculta

Juego para el taller de tecnología: cada chico recibe una pista sobre una palabra secreta, conversan para descubrirla y votan quién es el saboteador (que tiene una pista falsa).

## Subirlo a Netlify (una sola vez, unos 10 minutos)

1. Entrá a github.com, creá una cuenta si no tenés y tocá **New repository**. Ponele de nombre `palabra-oculta`, marcalo como **Public** y tocá **Create repository**.
2. En la página del repositorio tocá **uploading an existing file**. Arrastrá **todo el contenido** de esta carpeta (los archivos `netlify.toml`, `package.json`, `LEEME.md` y las carpetas `netlify` y `public`). Tocá **Commit changes**.
3. Entrá a app.netlify.com, tocá **Add new project → Import an existing project → GitHub** y elegí `palabra-oculta`.
4. No cambies nada de la configuración y tocá **Deploy**. En uno o dos minutos te da una dirección del estilo `algo.netlify.app`. Podés cambiarla en **Project configuration → Change project name** para que sea fácil de escribir.

Importante: arrastrar la carpeta directo a Netlify (sin GitHub) no sirve, porque así no se activa la parte que conecta a los chicos.

## Usarlo en el taller

- **Vos:** abrí `tu-sitio.netlify.app/anfitrion.html`. Elegí el grupo y la palabra **sin proyectar**, tocá **Crear sala** y recién ahí proyectá.
- **Los chicos:** entran a `tu-sitio.netlify.app`, escriben su nombre y el código de 4 letras que aparece en el pizarrón.
- Vos pasás de fase con el botón grande de abajo. El reloj es una guía: no avanza solo.
- **👁 Ver pistas** muestra quién tiene cada pista y quién es el saboteador. No lo proyectes.
- **Ocultar** en un mensaje lo saca de las pantallas de los chicos.
- **Otra ronda** juega otra palabra con los mismos chicos. **Sala nueva** es para el próximo grupo.
- Dejá el panel abierto todo el juego: es el que reparte los mensajes a los chicos.

## Niveles

| Grupo | Mensajes | Adivinar | Saboteadores |
|---|---|---|---|
| Primer grado | 5 dibujitos o “mostrar mi pista” | 4 opciones con dibujo y audio | 1 |
| Segundo y tercero | 3 mensajes de hasta 30 letras | 6 opciones | 1 |
| Cuarto y quinto | 3 mensajes de hasta 40 letras | Escriben la palabra | 2 (si son 8 o más) |

Para cambiar palabras o pistas, editá la parte `WORDS` del archivo `netlify/functions/api.mjs`.

## Costo

Entra en el plan gratis de Netlify. Una partida de 30 minutos con 25 chicos gasta aproximadamente 20 de los 300 créditos mensuales, así que alcanza para los 3 grupos de sobra.
