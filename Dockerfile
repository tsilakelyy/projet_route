FROM alpine:3.20

WORKDIR /workspace

CMD ["sh", "-c", "echo \"Use: docker compose up -d --build\" && sleep infinity"]
