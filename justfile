set dotenv-load := true



# List available recipes in the order in which they appear in this file
_default:
    @just --list --unsorted

# Reset and reseed database, and regenerate Keysely type definitions
reset-db:
	rm -f $APP_DATABASE_PATH
	npx tsx migrate.ts
	npx tsx seed.ts

# reset-db and also delete vote and score events files
reset-all:
  rm -rf ~/social-protocols-data/*
  mkdir -p ~/social-protocols-data
  touch $SCORE_EVENTS_PATH
  rm -f "$GB_DATABASE_PATH"
  ./gb_migrate.sh
  just reset-db

# run the migration script
migrate:
	npx tsx migrate.ts

# run the app locally and watch for changes
dev:
  npm install
  npm run dev

# open database in sqlite commandline 
db:
	sqlite3 $APP_DATABASE_PATH

# run typescript typechecker
typecheck:
	npx tsc --noEmit --watch

# run linters and formatter
lint:
	npx eslint . --fix

# run all tests non-e2e tests
test:
	npm run test 

# run all e2e tests
e2e-test:
	npm run test:e2e:dev 

# retrun seed script
reseed:
	npx tsx seed.ts

# import json.gz file containing conversations from HN
import-hn:
	npx tsx import-hn.ts ./other/hn-data/*.json.gz

# delete local database, download production database
download-prod-db:
  rm -f "$APP_DATABASE_PATH"
  rm -f "$APP_DATABASE_PATH"-shm
  rm -f "$APP_DATABASE_PATH"-wal
  flyctl ssh console -C "sqlite3 /litefs/data/sqlite.db '.backup /data/backup.db'"
  flyctl ssh sftp get /data/backup.db "$APP_DATABASE_PATH" || true

# build the docker container
docker-build:
  earthly +docker-image

# docker-build with --platform linux/amd64
docker-build-mac:
	docker build --platform linux/amd64 . -t deploy-sn

# run the app in the docker container (you must run docker-build first)
docker-run:
	docker run --rm -it -p 8081:8081 -e SESSION_SECRET -e INTERNAL_COMMAND_TOKEN -e HONEYPOT_SECRET --name deploy-sn deploy-sn bash startup.sh 

# delete the docker container
docker-rm:
	docker rm -f deploy-sn

# exec /bin/bash in the running docker container
docker-exec:
	docker exec -it deploy-sn /bin/bash

download-production-data:
	# todo: use sqlite .backup command and download copy
	rm -rf $SOCIAL_PROTOCOLS_DATADIR/production/
	mkdir -p $SOCIAL_PROTOCOLS_DATADIR/production/
	fly ssh sftp get /data/score-events.jsonl $SOCIAL_PROTOCOLS_DATADIR/production/score-events.jsonl
	fly ssh sftp get /data/vote-events.jsonl $SOCIAL_PROTOCOLS_DATADIR/production/vote-events.jsonl
	fly ssh sftp get /litefs/data/sqlite.db $SOCIAL_PROTOCOLS_DATADIR/production/sqlite.db
	fly ssh sftp get /litefs/data/global-brain.db $SOCIAL_PROTOCOLS_DATADIR/production/global-brain.db

use-production-data:
	cp -f $SOCIAL_PROTOCOLS_DATADIR/production/sqlite.db $SOCIAL_PROTOCOLS_DATADIR/
	just migrate
	sqlite3 $APP_DATABASE_PATH "delete from scoreEvent; delete from score;"
	rm -f "$SCORE_EVENTS_PATH"
	rm -f "$VOTE_EVENTS_PATH"
	rm -f "$GB_DATABASE_PATH"
	touch "$SCORE_EVENTS_PATH"


production-db:
	fly ssh console -C 'sqlite3 /litefs/data/sqlite.db'

install-local-node-extension:
	npm install --save-dev ../GlobalBrain.jl/globalbrain-node

install-node-extension-from-earthly:
  earthly --artifact +node-ext/artifact/ GlobalBrain.jl
  cd ./GlobalBrain.jl/globalbrain-node && npm install
  npm install --ignore-scripts --save './GlobalBrain.jl/globalbrain-node'

