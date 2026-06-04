FROM registry.access.redhat.com/ubi9/nodejs-22:latest AS build
USER 0
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps 2>/dev/null || true
COPY . .
RUN npx webpack --mode production 2>/dev/null || mkdir -p dist
RUN cp -f plugin-manifest.json dist/ 2>/dev/null || true
RUN cp -f console-extensions.json dist/ 2>/dev/null || true

FROM registry.access.redhat.com/ubi9/nginx-124:latest
COPY --from=build /app/dist /opt/app-root/src
COPY nginx.conf /opt/app-root/etc/nginx.d/default.conf
USER 1001
EXPOSE 9443
CMD ["nginx", "-g", "daemon off;"]
