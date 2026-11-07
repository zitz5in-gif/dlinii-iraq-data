// Derive an offline name index from the actual country vector map, not a list
// of invented coordinates. Requires Node 24 and npm ci in this directory.
import {DatabaseSync} from 'node:sqlite';
import {VectorTile} from '@mapbox/vector-tile';
import {PbfReader} from 'pbf';
import {gunzipSync} from 'node:zlib';
import fs from 'node:fs';
const [input, output] = process.argv.slice(2);
if (!input || !output || fs.existsSync(output)) throw new Error('Pass input MBTiles and a new output SQLite path');
const normalize=s=>s.toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'')
  .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const source=new DatabaseSync(input,{readOnly:true});
if(source.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw new Error('Corrupt source map');
const target=new DatabaseSync(output);
target.exec(`CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  INSERT INTO metadata VALUES('country','IQ'),('schema','1');
  CREATE TABLE places(id TEXT PRIMARY KEY,name TEXT NOT NULL,normalized TEXT NOT NULL,
  lat REAL NOT NULL,lon REAL NOT NULL,zoom INTEGER NOT NULL);`);
const insert=target.prepare(`INSERT INTO places VALUES(?,?,?,?,?,?) ON CONFLICT(id)
  DO UPDATE SET name=excluded.name,normalized=excluded.normalized,lat=excluded.lat,lon=excluded.lon,zoom=excluded.zoom
  WHERE excluded.zoom>places.zoom`);
target.exec('BEGIN');
let count=0;
for(const row of source.prepare('SELECT zoom_level,tile_column,tile_row,tile_data FROM tiles ORDER BY zoom_level').iterate()){
  const z=row.zoom_level,x=row.tile_column,y=(2**z)-1-row.tile_row;
  let bytes=row.tile_data;
  if(bytes[0]===31&&bytes[1]===139)bytes=gunzipSync(bytes);
  const tile=new VectorTile(new PbfReader(bytes));
  for(const [name,layer] of Object.entries(tile.layers)){
    if(!['place_labels','pois','poi_labels','street_labels','street_labels_points','streets'].includes(name))continue;
    for(let i=0;i<layer.length;i++){
      const feature=layer.feature(i),p=feature.properties;
      const aliases=[...new Set(Object.entries(p).filter(([key,value])=>
        (key==='name'||key.startsWith('name:')||key.startsWith('name_'))&&typeof value==='string'&&value.trim()).map(([,v])=>v))];
      if(!aliases.length)continue;
      const points=feature.loadGeometry().flat();
      if(!points.length)continue;
      // Choose a point on the real feature, rather than a centroid off-road.
      const point=points[Math.floor(points.length/2)];
      const lon=(x+point.x/layer.extent)/(2**z)*360-180;
      const lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+point.y/layer.extent)/(2**z))))*180/Math.PI;
      if(lat<28.5||lat>37.5||lon<38.5||lon>49)continue;
      const label=p['name:ar']||p.name_ar||p.name||aliases[0];
      const identity=feature.id?`${name}:${feature.id}`:`${name}:${label}:${lat.toFixed(4)}:${lon.toFixed(4)}`;
      insert.run(identity,String(label),normalize(aliases.join(' ')),lat,lon,z);
    }
  }
  if(++count%5000===0){target.exec('COMMIT; BEGIN');console.log(`Indexed ${count} source tiles`);}
}
target.exec('COMMIT; CREATE INDEX places_coordinates ON places(lat,lon); ANALYZE;');
const places=target.prepare('SELECT count(*) AS n FROM places').get().n;
if(places<1000)throw new Error(`Incomplete Iraq search index: ${places} names`);
console.log(JSON.stringify({tiles:count,places}));
target.close();source.close();
