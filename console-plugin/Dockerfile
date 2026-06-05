FROM registry.access.redhat.com/ubi9/nodejs-22:latest AS build
USER 0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN chmod -R a+x node_modules/.bin && node node_modules/webpack/bin/webpack.js --mode production

FROM registry.access.redhat.com/ubi9/nginx-124:latest
COPY --from=build /app/dist /opt/app-root/src
COPY nginx.conf /opt/app-root/etc/nginx.d/default.conf
USER 1001
EXPOSE 9443
CMD ["nginx", "-g", "daemon off;"]
