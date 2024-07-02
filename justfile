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
  rm -rf ~/social-protocols-data/*.db
  rm -rf ~/social-protocols-data/*.db-wal
  rm -rf ~/social-protocols-data/*.db-shm
  mkdir -p ~/social-protocols-data
  rm -f "$GB_DATABASE_PATH"
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
	CI=true npx eslint . --fix

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

import-society-library json="other/society-library-openai-debatemap.json" username="developer":
	npx tsx other/import-society-library-debatemap.ts {{json}} {{username}}

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
  docker image ls

# docker-build with --platform linux/amd64
docker-build-mac:
	docker build --platform linux/amd64 . -t deploy-sn

# run the app in the docker container (you must run docker-build first)
docker-run:
  docker-compose up

# exec /bin/bash in the running docker container
docker-exec:
	docker exec -it deploy-sn /bin/bash

download-production-data:
	# todo: use sqlite .backup command and download copy
	rm -rf $SOCIAL_PROTOCOLS_DATADIR/production/
	mkdir -p $SOCIAL_PROTOCOLS_DATADIR/production/
	fly ssh sftp get /litefs/data/sqlite.db $SOCIAL_PROTOCOLS_DATADIR/production/sqlite.db
	fly ssh sftp get /litefs/data/global-brain.db $SOCIAL_PROTOCOLS_DATADIR/production/global-brain.db
	fly ssh sftp get /litefs/data/sqlite.db $SOCIAL_PROTOCOLS_DATADIR/production/sqlite.db-wal
	fly ssh sftp get /litefs/data/global-brain.db $SOCIAL_PROTOCOLS_DATADIR/production/global-brain.db-wal


use-production-data:
	cp -f $SOCIAL_PROTOCOLS_DATADIR/production/sqlite.db $SOCIAL_PROTOCOLS_DATADIR/
	cp -f $SOCIAL_PROTOCOLS_DATADIR/production/global-brain.db $SOCIAL_PROTOCOLS_DATADIR/
	cp -f $SOCIAL_PROTOCOLS_DATADIR/production/sqlite.db-wal $SOCIAL_PROTOCOLS_DATADIR/
	cp -f $SOCIAL_PROTOCOLS_DATADIR/production/global-brain.db-wal $SOCIAL_PROTOCOLS_DATADIR/
	just migrate
	just replay-vote-events

production-db:
	fly ssh console -C 'sqlite3 /litefs/data/sqlite.db'


install-node-extension-from-earthly:
  earthly --artifact +globalbrain-node-package/artifact ./GlobalBrain.jl/globalbrain-node
  (cd ./GlobalBrain.jl/globalbrain-node && npm install)
  npm install --ignore-scripts --save './GlobalBrain.jl/globalbrain-node'

recent-sessions:
	fly ssh console -C 'other/recent-sessions.sh'

replay-vote-events:
	rm -f $SOCIAL_PROTOCOLS_DATADIR/global-brain.db
	sqlite3 $APP_DATABASE_PATH "delete from effectEvent where 1=1"
	sqlite3 $APP_DATABASE_PATH "delete from effect where 1=1"
	sqlite3 $APP_DATABASE_PATH "delete from score where 1=1"
	sqlite3 $APP_DATABASE_PATH "delete from scoreEvent where 1=1"
	time npx tsx other/replay-vote-events.ts
