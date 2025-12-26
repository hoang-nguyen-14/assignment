# Full Stack Application (FastAPI + React + PostgreSQL)

This project contains a Dockerized full-stack application with a Python FastAPI backend, React frontend, and a PostgreSQL database.

## 🛠 Tech Stack

- **Backend:** Python 3.11.9 (FastAPI)
- **Frontend:** Node 20 (React/Vite)
- **Database:** PostgreSQL 15

## 📋 Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running.

## 🚀 How to Run

### 1. Start the Application
Run the following command in the root directory (where `docker-compose.yml` is located):

```bash
docker-compose up --build
```
---

## 🗄️ Database Migrations

You can run the migration command from your host machine by "reaching into" the running backend container. This is the most common approach during development because it gives you control over when the schema changes.

**Command:**

```bash
docker compose exec backend alembic upgrade head
```

---

### 2. Access the Services
Once the containers are running, you can access the services at:

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend** | http://localhost:5173 | The React User Interface |
| **Backend API** | http://localhost:8000 | The FastAPI Root |
| **API Docs** | http://localhost:8000/docs | Swagger UI for testing endpoints |
| **Redoc** | http://localhost:8000/redoc | Alternative API documentation |

---

## ⚙️ Configuration

### Environment Variables
The application uses the following default database credentials inside Docker. You do not need to configure these manually unless you want to change them.

- **DB Host:** `db` (Internal Docker Network)
- **DB Port:** `5432`
- **DB Name:** `app_db`
- **User:** `postgres`
- **Password:** `postgres`

*Note: If connecting to the database from outside Docker (e.g., using DBeaver), use `localhost` as the host.*

### Development vs Production Mode
The current configuration is set to **Development Mode**.

- **Frontend:** Updates live when you save files.
- **Backend:** Auto-reloads when you save python files (`--reload` flag enabled).

> **Note on Workers:**
> If you need to test performance with multiple workers, edit `backend/Dockerfile` and change the CMD line:
> `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]`
> *Warning: This will disable auto-reload.*

---

## 🛑 Stopping the App

To stop the containers:
```bash
docker-compose down
```

To stop and **delete the database volume** (reset data):
```bash
docker-compose down -v
```

### demo

#### Pages
![Login Page](/public/assets/images/login_page.png)
![Answer to task 1](/public/assets/images/task1.png)
![Answer to task 2](/public/assets/images/task2.png)
![Answer to task 3](/public/assets/images/task3.png)

#### Encrypted Database
User passwords and secure identities are encrypted
![users](/public/assets/images/db_ids.png)
![secure_identities](/public/assets/images/db_users.png)
