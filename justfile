build:
	podman build -t r2 .

run:
	podman run -d --name r2 r2

stop:
	podman stop r2

rm:
	podman rm r2

upload:
  docker build -t ghcr.io/codabool/r2-to-vtt:latest .
  docker push ghcr.io/codabool/r2-to-vtt:latest
