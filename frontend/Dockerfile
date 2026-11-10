FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_API_URL=$VITE_API_URL
RUN npm run build

# Used only by `docker compose --profile test run --rm frontend-tests`; the default build skips it.
FROM build AS test
CMD ["npm", "test"]

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
