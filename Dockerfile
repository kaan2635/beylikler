# Beylikler çok oyunculu sunucusu (bağımlılık yok, yalnızca Node.js).
FROM node:22-alpine
WORKDIR /app
COPY . .
ENV HOST=0.0.0.0 \
    PORT=8787 \
    DATA_DIR=/data
# Dünya ve hesaplar burada durur: barındırma sitesinde kalıcı bir diske bağla.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8787
USER node
CMD ["node", "server/index.js"]
