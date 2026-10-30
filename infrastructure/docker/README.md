# Infrastructure

PostgreSQL geliştirme ortamını başlatmak için:

```text
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres
```

Şema [001_initial_schema.sql](../postgres/001_initial_schema.sql) dosyasında
yer alır. Production parolaları compose dosyasına yazılmamalıdır; `.env`
üzerinden verilmelidir.
