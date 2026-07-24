FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_APP_SUPABASE_URL
ARG VITE_APP_SUPABASE_ANON_KEY
ENV VITE_APP_SUPABASE_URL=$VITE_APP_SUPABASE_URL
ENV VITE_APP_SUPABASE_ANON_KEY=$VITE_APP_SUPABASE_ANON_KEY
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
