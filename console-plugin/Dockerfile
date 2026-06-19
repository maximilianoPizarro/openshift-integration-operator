# Stage 1: Build frontend assets with Node/webpack
FROM registry.access.redhat.com/ubi9/nodejs-24:latest AS frontend
USER 0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN chmod -R a+x node_modules/.bin && node node_modules/webpack/bin/webpack.js --mode production

# Stage 2: Build Go static server
FROM registry.access.redhat.com/ubi9/go-toolset:1.22 AS gobuilder
WORKDIR /opt/app-root/src
COPY go.mod serve.go ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o serve serve.go

# Stage 3: Minimal runtime (UBI9 micro + Go serve binary, ~30MB)
FROM registry.access.redhat.com/ubi9-micro:latest
COPY --from=gobuilder /opt/app-root/src/serve /usr/local/bin/serve
COPY --from=frontend /app/dist /opt/app-root/src
USER 1001
EXPOSE 9443
ENTRYPOINT ["serve"]
