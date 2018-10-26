#!/usr/bin/env bash
set -e

TAG=1.3.0
DOWNLOAD=erlang-formatter-$TAG.tar.gz
OUTDIR=erlang-formatter-$TAG

# exit if there is evidence of installation
[ -e "./$DOWNLOAD" ] && exit 0;

curl -L https://github.com/fenollp/erlang-formatter/archive/$TAG.tar.gz -o "$DOWNLOAD"

mkdir -p erlang-formatter

tar -xvf "./$DOWNLOAD" -C erlang-formatter --strip-components 1
