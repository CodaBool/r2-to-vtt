build:
	docker build -t r2 .

run:
	docker run --env-file .env -d --name r2 r2

stop:
	docker rm -f r2

upload:
  docker build -t ghcr.io/codabool/r2-to-vtt:latest .
  docker push ghcr.io/codabool/r2-to-vtt:latest
