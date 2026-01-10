FROM node:24-alpine
WORKDIR /app
#RUN apk -Uuv add tar less aws-cli curl busybox-suid && \
#  rm -rf /var/cache/apk/*
RUN npm install @aws-sdk/client-s3
COPY main.js .
CMD [ "crond", "-f"]
# CMD ["sh", "-c", "while true; do node main.js && sleep 86400; done"]
