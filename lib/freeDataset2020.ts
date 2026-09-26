import { calculateExpenseRecoveryRate, calculateFeeUnitPrice, calculateTreatmentCost } from "./calculations";
import { COST_COMPOSITION_ITEM_DEFINITIONS } from "./costCompositionDefinition";
import { PREFECTURE_PEER_PURPOSE_COST_DEFINITIONS, costPerCubicMeter } from "./prefecturePeerComparison";
import { medianOfFiniteValues } from "./citizenMunicipalityAssessment";
import { prefectures } from "./prefectures";
import { datasetCsv } from "./datasetEdition";

export const FREE_YEAR = 2020;
export const FREE_ID = "public-sewer-2020-national";
export const FREE_ROUTE = "/datasets/free-2020";
export const FREE_ASSETS = "/free-data/public-sewer-2020-national";
export type FreeValue = string | number | null;
export type FreeRow = Record<string, FreeValue>;
export type OfficialRow = Record<string, unknown>;
export type FreeSource = {tableNo:number;accountingType:string;tableName:string;sourceUrl:string;file:string;publishedAt:string|null;sha256:string;fiscalYear:number;catalogYear:number};
export type FieldPosition = {id:string;label:string;unit:string;table:number;row:number;col:number};
// R2 positions agree with the existing horizontal ETL and 03_FIELD_MAPPING.yml.
export const BASIC_FREE_FIELDS: FieldPosition[] = [
  {id:"servicePopulation",label:"処理区域内人口",unit:"人",table:10,row:1,col:11},
  {id:"connectedPopulation",label:"水洗化人口",unit:"人",table:10,row:1,col:12},
  {id:"treatedVolume",label:"年間汚水処理水量",unit:"m³/年",table:10,row:1,col:50},
  {id:"annualBillableVolume",label:"年間有収水量",unit:"m³/年",table:10,row:1,col:52},
  {id:"householdFee20m3Yen",label:"一般家庭用20m³月額",unit:"円/月・税込",table:33,row:1,col:13},
  {id:"sewerFeeRevenue",label:"使用料収入",unit:"千円/年",table:20,row:1,col:3},
  {id:"wastewaterTreatmentCost",label:"汚水処理費",unit:"千円/年",table:32,row:2,col:16},
  {id:"opexComponent",label:"維持管理費分",unit:"千円/年",table:32,row:1,col:44},
  {id:"capitalCostComponent",label:"資本費分",unit:"千円/年",table:32,row:2,col:8}
];
export const FREE_COSTS = [
  {id:"maintenance",label:"維持管理費分",keys:["opexComponent"],group:"component",denominator:"wastewaterTreatmentCost"},
  {id:"capital",label:"資本費分",keys:["capitalCostComponent"],group:"component",denominator:"wastewaterTreatmentCost"},
  ...PREFECTURE_PEER_PURPOSE_COST_DEFINITIONS.map(x=>({id:`purpose_${x.id}`,label:x.label,keys:[...x.itemCodes],group:"purpose",denominator:"operating_expense"})),
  {id:"purpose_business",label:"業務費",keys:["business_expense"],group:"purpose",denominator:"operating_expense"},
  {id:"purpose_general",label:"総係費",keys:["general_administration_expense"],group:"purpose",denominator:"operating_expense"},
  ...COST_COMPOSITION_ITEM_DEFINITIONS.map(x=>({id:`nature_${x.id}`,label:x.label,keys:[x.itemCode],group:"nature",denominator:"total_cost"}))
];
export type FreeColumn = {id:string;label:string;definition:string};
const column=(id:string,label:string,definition:string):FreeColumn=>({id,label,definition});
export const FREE_COLUMNS:FreeColumn[] = [
 column("rowId","行識別子","団体コード・事業キー・会計区分・決算年度。共同会計を配賦しない"),
 column("operatorCode","団体コード","6桁文字列。自治体と共同運営団体を識別。Excelでは文字列型で取り込む"),
 column("operatorName","自治体・運営団体名","2020年度の原資料の団体名。現在の自治体名へ置換しない"),
 column("prefectureCode","都道府県コード","団体コードの先頭2桁。運営団体の所在県で集計し、構成市町村へ複製しない"),
 column("prefectureName","都道府県","団体コードに対応する都道府県"),
 column("businessKey","事業キー","業種17・事業1・原資料の施設コード"),
 column("businessName","事業区分","公共下水道のみ。特環・流域は含めない"),
 column("accountingType","会計区分","法適用または法非適用。家庭用月額以外の金額・単価は法適用が税抜、法非適用が税込の原表ベース。移行年の会計は別行"),
 column("fiscalYear","決算年度","2020年度。カタログ年2021と区別"),
 ...BASIC_FREE_FIELDS.map(x=>column(x.id,`${x.label}（${x.unit}）`,`第${x.table===20?"20表（法非適用は26表）":`${x.table}表`}・${x.row}行${x.col}列。欠損は空欄。家庭用料金を単価から推計しない`)),
 column("expenseRecoveryRate","経費回収率（%）","使用料収入÷汚水処理費×100。既存の共通計算（小数4桁）"),
 column("feeUnitPrice","使用料単価（円/m³）","使用料収入（千円）×1000÷年間有収水量。家庭用料金とは別"),
 column("treatmentCost","汚水処理原価（円/m³）","汚水処理費（千円）×1000÷年間有収水量"),
 column("operating_expense","営業費用（千円/年）","第20表26列。目的別の構成比の分母。法非適用は空欄"),
 column("total_cost","性質別費用合計（千円/年）","第21表29列。性質別の構成比の分母。法非適用は空欄"),
 column("comparisonEligible","費用比較対象","法適用・正の年間有収水量・都道府県識別可。費目の欠損はさらに個別除外"),
 column("exclusionReason","費用比較対象外理由","法非適用または水量不足など。未確認をなしとしない"),
 ...FREE_COSTS.flatMap(x=>[
   column(`${x.id}_annual`,`${x.label}：年額（千円/年）`,`${x.keys.join("＋")}。業務費・総係費の合計と個別列は重複加算しない`),
   column(`${x.id}_unit`,`${x.label}：単位費用（円/m³）`,"年額（千円）×1000÷年間有収水量。丸め前の値"),
   column(`${x.id}_share`,`${x.label}：構成比（%）`,`年額÷${x.denominator}×100。目的別と性質別は別分類で合算不可`),
   column(`${x.id}_median`,`${x.label}：県内中央値（円/m³）`,"同県・2020年度・公共下水道・法適用・水量正・当該費目有効の事業会計を各1票。自事業も含む"),
   column(`${x.id}_difference`,`${x.label}：県内中央値との差（円/m³）`,"当該事業の単位費用－県内中央値。比較対象外は空欄"),
   column(`${x.id}_count`,`${x.label}：県内比較件数`,"中央値の有効な事業会計数。欠損を0に置き換えて含めない"),
   column(`${x.id}_state`,`${x.label}：状態`,"収録／原資料欠損／水量不足／法非適用のため費用内訳対象外／負値のため算定不可")]),
 column("validationStatus","検証状態","年度・識別・結合・有限値の自動検証。原資料の全件手動照合を意味しない"),
 column("qualityNotes","確認事項","空欄・合計差・データ不足を記録。確認済みという包括的な保証ではない")
];
export function parseOfficialNumber(value:unknown):number|null {
 if(value==null)return null; const s=String(value).trim().replaceAll(",","");
 if(!s || ["-","－","―","…","...","X","x","***"].includes(s))return null;
 if(!/^-?\d+(\.\d+)?$/.test(s))throw new Error(`Unexpected numeric cell: ${s}`);
 const n=Number(s); if(!Number.isFinite(n))throw new Error("Non-finite source value"); return n;
}
export function sourceIdentity(row:OfficialRow){
 if(Number(row["決算年度"])!==FREE_YEAR)throw new Error("Source fiscal year mismatch");
 const code=String(row["団体コード"]??"").trim().padStart(6,"0");
 const facility=String(row["施設コード"]??"").trim().padStart(3,"0");
 if(!/^\d{6}$/.test(code)||!/^\d{3}$/.test(facility))throw new Error("Invalid source identity");
 return {operatorCode:code,operatorName:String(row["団体名"]??"").trim(),businessKey:`17-1-${facility}`};
}
export type FreeInput={operatorCode:string;operatorName:string;businessKey:string;accountingType:string;fiscalYear:number;values:Record<string,number|null>;notes?:string[]};
export function buildFree2020Rows(inputs:FreeInput[]):FreeRow[]{
 const seen=new Set<string>();
 const rows=inputs.map(input=>{
  if(input.fiscalYear!==2020 || !/^17-1-\d{3}$/.test(input.businessKey) || !/^\d{6}$/.test(input.operatorCode))throw new Error("Invalid scope");
  if(!["legal_applied","non_legal_applied"].includes(input.accountingType))throw new Error("Invalid accounting type");
  const rowId=`${input.operatorCode}:${input.businessKey}:${input.accountingType}:2020`;
  if(seen.has(rowId))throw new Error("Duplicate account");seen.add(rowId);
  for(const n of Object.values(input.values))if(n!=null&&!Number.isFinite(n))throw new Error("Non-finite input");
  const legal=input.accountingType==="legal_applied";
  const v=input.values;const volume=v.annualBillableVolume??null;const pref=prefectures.find(p=>p.code===input.operatorCode.slice(0,2));
  if(!pref)throw new Error("Unknown prefecture");
  const eligible=legal && volume!=null && volume>0;
  const row:FreeRow={rowId,operatorCode:input.operatorCode,operatorName:input.operatorName,prefectureCode:pref.code,prefectureName:pref.name,businessKey:input.businessKey,businessName:"公共下水道",accountingType:legal?"法適用":"法非適用",fiscalYear:2020,
   ...Object.fromEntries(BASIC_FREE_FIELDS.map(x=>[x.id,v[x.id]??null])),
   expenseRecoveryRate:calculateExpenseRecoveryRate(v.sewerFeeRevenue??null,v.wastewaterTreatmentCost??null),feeUnitPrice:calculateFeeUnitPrice(v.sewerFeeRevenue??null,volume),treatmentCost:calculateTreatmentCost(v.wastewaterTreatmentCost??null,volume),
   operating_expense:legal?v.operating_expense??null:null,total_cost:legal?v.total_cost??null:null,comparisonEligible:eligible?"対象":"対象外",exclusionReason:legal?(eligible?"":"年間有収水量が欠損または0以下"):"法非適用（費用比較の会計基準が異なる）",validationStatus:"自動検証済み（全件手動照合ではない）"};
  const notes=[...(input.notes??[])];
  for(const c of FREE_COSTS){
   const ns=c.keys.map(k=>v[k]??null);const applicable=legal||c.group==="component";
   const amount=applicable&&ns.every(n=>n!=null)?ns.reduce<number>((sum,n)=>sum+n!,0):null;
   const unit=amount!=null?costPerCubicMeter(amount,volume):null;
   const total=v[c.denominator]??null;
   row[`${c.id}_annual`]=amount;row[`${c.id}_unit`]=unit;
   row[`${c.id}_share`]=amount!=null&&amount>=0&&total!=null&&total>0?amount/total*100:null;
   row[`${c.id}_state`]=!applicable?"法非適用のため費用内訳対象外":amount==null?"原資料欠損":amount<0?"負値のため算定不可":unit==null?"水量不足":"収録";
  }
  const parts=[v.opexComponent,v.capitalCostComponent,v.wastewaterTreatmentCost];
  if(parts.every(n=>n!=null)&&Math.abs(parts[0]!+parts[1]!-parts[2]!)>1)notes.push("汚水処理費と維持管理費分＋資本費分に差あり");
  if(BASIC_FREE_FIELDS.some(x=>row[x.id]==null))notes.push("基本項目に欠損あり");
  row.qualityNotes=notes.length?notes.join("／"):"実施した自動検証で追加指摘なし";return row;
 }).sort((a,b)=>String(a.rowId).localeCompare(String(b.rowId)));
 for(const row of rows)for(const c of FREE_COSTS){
  const peers=rows.filter(p=>p.prefectureCode===row.prefectureCode && p.comparisonEligible==="対象").map(p=>p[`${c.id}_unit`]).filter((n):n is number=>typeof n==="number"&&Number.isFinite(n));
  const median=medianOfFiniteValues(peers);const own=row[`${c.id}_unit`];
  row[`${c.id}_count`]=peers.length;
  row[`${c.id}_median`]=row.comparisonEligible==="対象"?median:null;
  row[`${c.id}_difference`]=row.comparisonEligible==="対象"&&typeof own==="number"&&median!=null?own-median:null;
 }
 return rows;
}
export function freeRowsCsv(rows:FreeRow[]){return datasetCsv(FREE_COLUMNS.map(c=>c.label),rows.map(r=>Object.fromEntries(FREE_COLUMNS.map(c=>[c.label,r[c.id]??null]))));}
