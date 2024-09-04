#!/bin/bash

set -e
docker build -t hiepht/bullfarm:$1 .
docker push hiepht/bullfarm:$1