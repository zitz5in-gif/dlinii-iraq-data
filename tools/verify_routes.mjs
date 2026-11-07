import fs from 'node:fs';
const cases=[
  ['Baghdad',33.3152,44.3661,33.3302,44.4000],
  ['Basra',30.5085,47.7804,30.5200,47.8000],
  ['Erbil',36.1911,44.0092,36.2100,44.0300],
  ['Mosul',36.3400,43.1300,36.3550,43.1500],
  ['Halabja',35.1800,45.9860,35.1900,45.9950],
];
const results=[];
for(const [city,a,b,c,d] of cases){
  let result,lastError;
  for(let attempt=0;attempt<15;attempt++){
    try {
      const response=await fetch('http://127.0.0.1:8002/route',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({locations:[{lat:a,lon:b,radius:1000},{lat:c,lon:d,radius:1000}],costing:'auto'}),
        signal:AbortSignal.timeout(30000),
      });
      const value=await response.json();
      if(!response.ok||!value.trip?.legs?.length)throw new Error(JSON.stringify(value));
      if(value.trip.legs.some(leg=>!leg.shape||!leg.maneuvers?.length))throw new Error('Missing real road geometry/instructions');
      result={city,lengthKm:value.trip.summary.length,legs:value.trip.legs.length};break;
    }catch(error){lastError=error;await new Promise(resolve=>setTimeout(resolve,2000));}
  }
  if(!result)throw new Error(`${city}: ${lastError}`);
  results.push(result);
}
fs.writeFileSync('output/route-checks.json',JSON.stringify(results,null,2));
