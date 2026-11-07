import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const [directory,base,version]=process.argv.slice(2);
if(!directory||!base?.startsWith('https://')||!version)throw new Error('Expected directory HTTPS-release-base version');
const files=[];
for(const [role,name] of [['map','iraq.mbtiles'],['routing','roads.tar'],['search','search.sqlite']]){
  const file=path.join(directory,name),hash=createHash('sha256');
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  files.push({role,url:`${base.replace(/\/$/,'')}/${name}`,bytes:fs.statSync(file).size,sha256:hash.digest('hex')});
}
fs.writeFileSync(path.join(directory,'iraq-package.json'),JSON.stringify({schema:1,country:'IQ',version,
  attribution:'© OpenStreetMap contributors; Geofabrik extract. ODbL 1.0.',files},null,2));
