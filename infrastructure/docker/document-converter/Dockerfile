FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-writer libreoffice-impress fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY converter.py /app/converter.py
EXPOSE 3030
CMD ["python", "/app/converter.py"]
