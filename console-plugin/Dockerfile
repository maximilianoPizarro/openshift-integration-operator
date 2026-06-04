FROM registry.access.redhat.com/ubi8/nodejs-18:latest AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM registry.access.redhat.com/ubi8/nginx-120:latest
COPY --from=build /app/dist /opt/app-root/src
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 9443
CMD ["nginx", "-g", "daemon off;"]
