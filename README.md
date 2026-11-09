# School Admission System

ASP.NET Core (.NET 10) API, React + Vite frontend, PostgreSQL 18.

## Run

Requires Docker with Compose v2.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:8080 |
| API docs | http://localhost:8080/scalar/v1 |
| Health | http://localhost:8080/api/health |
| PostgreSQL | localhost:5432, db `school_admission`, user/password `postgres` |

Stop with `docker compose down`. Add `-v` to delete the database volume.

## Local development

Start only the database:

```bash
docker compose up db
```

API (uses `appsettings.Development.json`):

```bash
cd backend/src/SchoolAdmission.Api
dotnet run
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Migrations

```bash
cd backend
dotnet tool restore
dotnet ef migrations add <Name> --project src/SchoolAdmission.Api
dotnet ef database update --project src/SchoolAdmission.Api
```
