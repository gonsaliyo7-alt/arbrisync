# Guía de Despliegue en GitHub y Railway

Esta guía te ayuda a subir tu proyecto de arbitraje a **GitHub** y configurarlo en **Railway** para que el bot de ejecución corra de forma continua 24/7 en la nube, de manera totalmente autónoma.

---

## Paso 1: Inicializar y subir a GitHub

> [!WARNING]
> **NUNCA** subas tu clave privada al código. Ya hemos añadido `.env` a tu archivo `.gitignore` para evitar que se suba por accidente.

Ejecuta los siguientes comandos en tu terminal local dentro del directorio del proyecto (`arbrisync`):

1. **Crear un nuevo repositorio en GitHub** (de preferencia **Privado** para mayor seguridad).
2. **Inicializar Git y añadir los archivos**:
   ```bash
   git init
   git add .
   git commit -m "feat: setup bot for railway and github"
   ```
3. **Vincular y subir a GitHub** (cambia `tu-usuario` por tu cuenta de GitHub):
   ```bash
   git branch -M main
   git remote add origin https://github.com/tu-usuario/tu-repositorio.git
   git push -u origin main
   ```

---

## Paso 2: Desplegar en Railway

1. Inicia sesión en [Railway.app](https://railway.app/).
2. Haz clic en **"New Project"** -> **"Deploy from GitHub repo"**.
3. Selecciona tu repositorio recién subido.
4. Railway detectará de forma automática el archivo `package.json` y usará el comando `npm start` para ejecutar tu bot `auto_bot_base.cjs`.

---

## Paso 3: Configurar Variables de Entorno (Variables) en Railway

Para que el bot funcione en Railway sin necesidad de un archivo `.env` local, debes ir a la pestaña **Variables** (o *Settings* -> *Variables*) de tu servicio en Railway y añadir las siguientes variables con sus respectivos valores:

| Variable | Descripción / Ejemplo |
| :--- | :--- |
| `PRIVATE_KEY` | Tu clave privada de MetaMask (sin `0x`) |
| `CONTRACT_ADDRESS` | `0x3F1972eeaF776916FFbd42139F10b3A1cb513A16` |
| `RPC_URL` | Tu nodo RPC, ej: `https://mainnet.base.org` |
| `USE_FLASH_LOAN` | `true` (para usar Flash Loans) o `false` (para usar Own Funds) |

---

## Estructura de despliegue en Railway
Railway mantendrá el bot activo 24/7 de forma autónoma. Puedes ver las consolas de ejecución en tiempo real desde la pestaña **Logs** de Railway.
