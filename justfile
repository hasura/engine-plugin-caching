default:
    just --list

test:
  npm start

start-plugin:
  npm start

docker:
  docker compose -f tests/docker-compose.yaml up --build --pull=always --wait engine redis

docker-stop:
  docker compose -f tests/docker-compose.yaml down --volumes
