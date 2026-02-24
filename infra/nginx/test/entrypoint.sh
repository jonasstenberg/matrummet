#!/bin/sh
bun /mock-upstream.ts app       3001 &
bun /mock-upstream.ts postgrest 4444 &
bun /mock-upstream.ts images    4006 &
bun /mock-upstream.ts events    4004 &
bun /mock-upstream.ts email     4005 &
sleep 0.5
exec nginx -g "daemon off;"
