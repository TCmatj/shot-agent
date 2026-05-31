FROM golang:1.22-alpine AS build

WORKDIR /src
COPY go.mod ./
COPY main.go ./
COPY main_test.go ./
RUN go test ./... && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/shot-agent-server .

FROM alpine:3.20

RUN adduser -D -H -u 10001 appuser
USER appuser
WORKDIR /app
COPY --from=build /out/shot-agent-server /app/shot-agent-server

EXPOSE 8787
ENTRYPOINT ["/app/shot-agent-server"]
