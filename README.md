# Clipoteca

Plataforma de videos construida como SPA en React + Vite, API REST en FastAPI y base de datos SQLite para desarrollo local o PostgreSQL en Amazon RDS. Los videos y las miniaturas se guardan en buckets S3 separados.

## Estructura

```text
.
├── frontend/
│   ├── src/
│   │   ├── api/                 # Cliente HTTP y funciones agrupadas por recurso
│   │   ├── App.jsx
│   │   └── ...
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── api/routes/          # Endpoints por recurso
│   │   ├── services/            # S3 y reglas de negocio reutilizables
│   │   ├── config.py            # Variables de entorno
│   │   ├── database.py          # Motor, sesión y Base de SQLAlchemy
│   │   ├── dependencies.py     # Sesión de usuario/autenticación
│   │   ├── init_db.py           # Creación de tablas desde los modelos
│   │   ├── models.py            # Entidades users, videos y comments
│   │   ├── schemas.py           # Contratos de entrada y salida
│   │   └── main.py              # Aplicación FastAPI y middleware
│   ├── requirements.txt
│   └── main.py                  # Compatibilidad con uvicorn main:app
└── package.json                 # Comandos rápidos delegados al frontend
```

Los modelos definen las tablas `users`, `videos` y `comments`. `init_db.py` llama a `Base.metadata.create_all()` al iniciar FastAPI. Las tablas guardan metadatos; los archivos no se almacenan en la base de datos.

## Ejecutar en local

Instala dependencias de frontend y backend:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
cd ..\backend
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

En una terminal, inicia el API desde `backend/`:

```powershell
python -m uvicorn app.main:app --reload
```

En otra terminal, desde la raíz del proyecto:

```powershell
npm run dev
```

La SPA estará disponible en `http://localhost:5173`, el estado de API en `http://localhost:8000/health` y la documentación interactiva en `http://localhost:8000/docs`. En local, SQLite crea `backend/videos.db`. No se necesita AWS para navegar o probar autenticación y comentarios; publicar archivos sí requiere los buckets S3 y permisos.

También puedes usar directamente los comandos propios del frontend dentro de `frontend/`: `npm run dev`, `npm run build` y `npm run lint`.

## Funcionalidades

- Registro, login y contraseñas protegidas.
- Catálogo dinámico con búsqueda, reproducción y conteo de vistas.
- Comentarios y recomendaciones cargados desde la API.
- Perfil con cantidad de videos, publicación, edición y eliminación.
- Carga de MP4 (máximo 100 MB) y miniaturas JPG/JPEG/PNG (máximo 5 MB) a buckets S3 independientes.

## Variables de entorno

El frontend usa `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000
```

El backend usa `backend/.env`:

```dotenv
DATABASE_URL=sqlite:///./videos.db
JWT_SECRET=CAMBIA-POR-UN-SECRETO-ALEATORIO-LARGO
AWS_REGION=us-east-1
S3_VIDEO_BUCKET=
S3_THUMBNAIL_BUCKET=
FRONTEND_ORIGINS=http://localhost:5173
```

No guardes secretos ni claves de AWS en el repositorio o en el frontend.

## Endpoints principales

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/users` | Registro |
| `POST` | `/login` | Inicio de sesión |
| `GET` | `/users/{user_id}` | Perfil público |
| `GET` | `/users/{user_id}/videos` | Videos del usuario |
| `POST` | `/videos/upload-url` | URL firmada para carga |
| `POST` | `/videos` | Publicar video con formulario multipart (`title`, `description`, `video_file`, `thumbnail_file`); Swagger permite elegir los archivos localmente |
| `GET` | `/videos` | Catálogo |
| `GET` | `/videos/{video_id}` | Reproducción e incremento de vistas |
| `GET` | `/videos/{video_id}/recommendations` | Videos recomendados |
| `PUT` | `/videos/{video_id}` | Editar video propio |
| `DELETE` | `/videos/{video_id}` | Eliminar video propio |
| `GET`, `POST` | `/videos/{video_id}/comments` | Consultar o publicar comentarios |

## Despliegue AWS

La arquitectura de entrega es:

- Solo el contenido compilado de `frontend/dist/` se publica en el bucket S3 del frontend.
- FastAPI se despliega en EC2.
- PostgreSQL se despliega en RDS.
- Videos y miniaturas se guardan en buckets S3 privados independientes.

Crea una base PostgreSQL en RDS y tres buckets S3. Asigna a la instancia EC2 un IAM Role con permisos mínimos a los buckets de medios; no incluyas access keys en el código. Configura los Security Groups para que RDS acepte conexiones únicamente desde EC2 y establece CORS en los buckets de medios para el dominio de la SPA.

En EC2, instala los requisitos del API y configura `backend/.env` con `DATABASE_URL` de RDS, un `JWT_SECRET` robusto, la región, los nombres de ambos buckets de medios y el origen de la SPA. Inicia el servicio desde la carpeta `backend/`:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

La API quedará disponible en `http://IP-PUBLICA-EC2:8000` y Swagger en `/docs`.

El endpoint `POST /videos` recibe los archivos en multipart y el backend los guarda en S3 usando el IAM Role de EC2. En Swagger, autoriza primero la sesión con **Authorize** y luego selecciona los campos `video_file` y `thumbnail_file`. El límite recomendado para los videos es 100 MB.

Para crear el frontend de producción desde la raíz:

```powershell
$env:VITE_API_URL = "http://IP-PUBLICA-EC2:8000"
npm run build
```

Sube únicamente los archivos que están dentro de `frontend/dist/` al bucket del frontend. No subas `src/`, `node_modules/` ni archivos `.env`. Para HTTPS, usa CloudFront delante del sitio estático de S3.
