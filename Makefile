# land.svg is the map. index.html loads it with <img src="land.svg"> and is edited by hand,
# so only the map needs a build:  make

land.svg: gen.mjs | node_modules
	node gen.mjs > $@

node_modules:
	npm i world-atlas@2 topojson-client@3

.PHONY: clean
clean:
	rm -f package-lock.json package.json land.svg
	rm -rf node_modules
