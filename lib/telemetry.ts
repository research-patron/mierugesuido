// No transport, tags, cookies or storage are installed. An operator may attach
// an approved adapter only after configuring ownership, consent and policy.
export type UsageEventName = "municipality_data_view" | "comparison_view" | "view_item" | "sample_download_click" | "note_outbound_click" | "data_load_error";
export type UsageEvent = { name: UsageEventName; properties: Record<string,string|number> };
const allowedNames = new Set<UsageEventName>(["municipality_data_view","comparison_view","view_item","sample_download_click","note_outbound_click","data_load_error"]);
const allowedKeys = new Set(["entityCode","fiscalYear","businessType","metric","dataVersion","comparisonType","itemCount","productId","fileType","placement","routeType","safeErrorCode"]);
let adapter: ((event:UsageEvent)=>void) | null = null;
let enabled=false;
const seen = new Set<string>();
export function configureUsageMeasurement(options:{enabled:boolean;consent:boolean;send?: (event:UsageEvent)=>void}) {
  enabled=options.enabled&&options.consent&&typeof options.send==="function";
  adapter=enabled?options.send!:null;
  if(!enabled)seen.clear();
}
export function emitUsage(name:UsageEventName, properties:Record<string,unknown>, onceKey?:string) {
  if(!enabled||!adapter||!allowedNames.has(name))return false;
  const clean:Record<string,string|number>={};
  for(const [key,value] of Object.entries(properties)) {
    if(!allowedKeys.has(key))continue;
    if(typeof value==="number"&&Number.isFinite(value))clean[key]=value;
    else if(typeof value==="string"&&value.length<=100&&/^[a-zA-Z0-9_./:-]+$/.test(value)&&!value.includes("://"))clean[key]=value;
  }
  const key=onceKey ? `${name}:${onceKey}:${JSON.stringify(clean)}` : null;
  if(key&&seen.has(key))return false;
  try {adapter({name,properties:clean});if(key)seen.add(key);return true;}catch{return false;}
}
