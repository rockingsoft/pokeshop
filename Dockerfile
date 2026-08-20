FROM node:20-alpine AS build

WORKDIR /build
RUN npm i -g typescript
COPY ./api/package*.json ./
RUN npm ci

COPY ./api ./

RUN npm run build

# app
FROM node:20-alpine AS app

WORKDIR /app
COPY ./api/package.json ./api/package-lock.json ./
RUN npm clean-install

EXPOSE 8081
EXPOSE 8082

ENV NPM_RUN_COMMAND=api

COPY --from=build /build/.build/* ./
COPY --from=build /build/migrations/* ./migrations/
COPY --from=build /build/protos ./protos

CMD ["sh", "-c", "npm run $NPM_RUN_COMMAND"]
