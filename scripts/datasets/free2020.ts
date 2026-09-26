import { readFile,writeFile,mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import XLSX from "xlsx";
import { BASIC_FREE_FIELDS, FREE_ASSETS, FREE_COLUMNS, FREE_COSTS, FREE_ID, buildFree2020Rows,freeRowsCsv,parseOfficialNumber,sourceIdentity,type FreeInput,type FreeSource,type OfficialRow } from "../../lib/freeDataset2020";
import { INCOME_STATEMENT_MAPPINGS,COST_COMPOSITION_MAPPINGS } from "../etl/statementMappings";
import { datasetCsv } from "../../lib/datasetEdition";
import { freeCalculationDefinitions,sourceFieldLabel,freeSourceTaxBasis,type SourceField } from "../../lib/freeDatasetTrace";
const root=process.cwd();const assetDir=path.join(root,"public",FREE_ASSETS);
const catalogFile=path.join(root,"data/static/free-2020-catalog.json");
const hash=(s:Buffer|string)=>createHash("sha256").update(s).digest("hex");
const codeFiles=["config/free-2020-sources.json","lib/freeDataset2020.ts","lib/freeDatasetTrace.ts","lib/calculations.ts","lib/costCompositionDefinition.ts","lib/prefecturePeerComparison.ts","lib/citizenMunicipalityAssessment.ts","scripts/etl/statementMappings.ts","scripts/datasets/free2020.ts"];
const codeHashes=Object.fromEntries(await Promise.all(codeFiles.map(async f=>[f,hash(await readFile(f))])));
if(process.argv.includes("--check")){
 const m=JSON.parse(await readFile(catalogFile,"utf8"));
 if(JSON.stringify(m.codeHashes)!==JSON.stringify(codeHashes))throw new Error("2020 sample generation code changed: regenerate from official source cache");
 for(const f of m.files){const b=await readFile(path.join(assetDir,f.name));if(hash(b)!==f.sha256||b.length!==f.bytes)throw new Error(`2020 sample mismatch: ${f.name}`);}
 console.log(`2020 free sample verified: ${m.rowCount} accounts, ${m.columnCount} columns, ${m.files.length} files`);
}else{
 const sourceRoot=process.env.FREE_DATA_SOURCE_ROOT??path.join(root,"data/raw/e-stat");
 const sources=JSON.parse(await readFile("config/free-2020-sources.json","utf8")) as FreeSource[];
 const input=new Map<string,FreeInput>();const cells=new Map<string,OfficialRow>();
 const sourceRecords:Record<string,unknown>[]=[];
 for(const source of sources){
  const buffer=await readFile(path.join(sourceRoot,source.file));if(hash(buffer)!==source.sha256)throw new Error(`Source hash mismatch: ${source.file}`);
  const wb=XLSX.read(buffer,{type:"buffer",cellDates:false});
  for(const sheetName of wb.SheetNames){const rs=XLSX.utils.sheet_to_json<OfficialRow>(wb.Sheets[sheetName],{defval:"",raw:false});
   for(const r of rs){if(Number(r["業種コード"])!==17||Number(r["事業コード"])!==1)continue;
    const ident=sourceIdentity(r);if(Number(r["表番号"])!==source.tableNo)throw new Error("Table mismatch");
    const rowNo=Number(r["行番号"]);if(![1,2].includes(rowNo))continue;
    const key=`${ident.operatorCode}:${ident.businessKey}:${source.accountingType}`;
    const cellKey=`${key}:${source.tableNo}:${rowNo}`;
    if(cells.has(cellKey))throw new Error(`Duplicate official record: ${cellKey}`);
    cells.set(cellKey,r);
    sourceRecords.push({"行識別子":`${key}:2020`,"出典ID":`${source.accountingType}:${source.tableNo}`,"団体コード":ident.operatorCode,"自治体・運営団体名":ident.operatorName,"事業キー":ident.businessKey,"会計区分":source.accountingType,"決算年度":2020,"表番号":source.tableNo,"行番号":rowNo,"シート名":sheetName,"Excel行番号":Number(r.__rowNum__)+1});
    if(source.tableNo===10&&rowNo===1)input.set(key,{...ident,accountingType:source.accountingType,fiscalYear:2020,values:{},notes:[]});
   }
  }
 }
 const sourceCorrespondence:Record<string,unknown>[]=[];const sourceFields:SourceField[]=[];
 const neededStatementKeys=new Set(FREE_COSTS.flatMap(c=>[...c.keys,c.denominator]));
 const statements=[...INCOME_STATEMENT_MAPPINGS,...COST_COMPOSITION_MAPPINGS].filter(x=>neededStatementKeys.has(x.itemCode));
 for(const [key,item] of input){
  const read=(table:number,row:number,col:number)=>parseOfficialNumber(cells.get(`${key}:${table}:${row}`)?.[`列${String(col).padStart(3,"0")}`]);
  for(const f of BASIC_FREE_FIELDS){const table=f.id==="sewerFeeRevenue"&&item.accountingType==="non_legal_applied"?26:f.table;item.values[f.id]=read(table,f.row,f.col);}
  if(item.accountingType==="legal_applied")for(const f of statements)item.values[f.itemCode]=read(f.tableNo,f.rowNo,f.colNo);
  for(const t of item.accountingType==="legal_applied"?[10,20,21,32,33]:[10,26,32,33])if(!cells.has(`${key}:${t}:1`))item.notes!.push(`第${t}表の対応行なし`);
 }
 // Never drop a source-only account silently; identity alignment is a release gate.
 const orphans=[...cells.keys()].filter(k=>!input.has(k.split(":").slice(0,3).join(":")));
 if(orphans.length)throw new Error(`Source accounts without facility baseline: ${orphans.slice(0,5).join(",")}`);
 for(const acc of ["legal_applied","non_legal_applied"]){
  const fields=[...BASIC_FREE_FIELDS.map(f=>({...f,table:f.id==="sewerFeeRevenue"&&acc==="non_legal_applied"?26:f.table})),...(acc==="legal_applied"?statements.map(f=>({id:f.itemCode,label:f.label,unit:"千円",table:f.tableNo,row:f.rowNo,col:f.colNo})):[])];
  for(const f of fields){const s=sources.find(s=>s.accountingType===acc&&s.tableNo===f.table)!;sourceFields.push({...f,accounting:acc});sourceCorrespondence.push({field:f.id,label:f.label,accounting:acc,fiscalYear:2020,catalogYear:2021,table:f.table,row:f.row,col:f.col,unit:f.unit,taxBasis:freeSourceTaxBasis(f,acc),layoutUrl:`https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=${acc==="legal_applied"?"000032122216":"000032122233"}`,sourceUrl:s.sourceUrl,sha256:s.sha256,join:"団体コード＋業種17＋事業1＋施設コード＋会計＋決算年度2020"});}
 }
 const rows=buildFree2020Rows([...input.values()]);
 const dataVersion=hash(JSON.stringify({codeHashes,sourceHashes:sources.map(s=>s.sha256),scope:"2020/17/1/account"}));
 const uniqueFields=[...new Map(sourceFields.map(f=>[f.id,f])).values()];
 const rawInputs=[...input.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>({
  "行識別子":`${key}:2020`,"団体コード":item.operatorCode,"自治体・運営団体名":item.operatorName,"事業キー":item.businessKey,"会計区分":item.accountingType,"決算年度":2020,
  ...Object.fromEntries(uniqueFields.map(f=>{const p=sourceFields.find(x=>x.id===f.id&&x.accounting===item.accountingType);return [sourceFieldLabel(f),p?cells.get(`${key}:${p.table}:${p.row}`)?.[`列${String(p.col).padStart(3,"0")}`]??null:null];}))
 }));
 const calculations=freeCalculationDefinitions(sourceFields);
 const files:Record<string,string>={
  "public-sewer-2020.csv":freeRowsCsv(rows),
  "columns.csv":datasetCsv(["id","label","definition"],FREE_COLUMNS),
  "sources.csv":datasetCsv(["field","label","accounting","fiscalYear","catalogYear","table","row","col","unit","taxBasis","layoutUrl","sourceUrl","sha256","join"],sourceCorrespondence),
  "input-values.csv":datasetCsv(Object.keys(rawInputs[0]),rawInputs),
  "source-records.csv":datasetCsv(Object.keys(sourceRecords[0]),sourceRecords.sort((a,b)=>`${a["行識別子"]}:${a["表番号"]}:${a["行番号"]}`.localeCompare(`${b["行識別子"]}:${b["表番号"]}:${b["行番号"]}`))),
  "calculations.csv":datasetCsv(Object.keys(calculations[0]),calculations),
  "README.md":`# 2020年度（令和2年度）全国・公共下水道 無料CSV\n\n${rows.length}事業会計、${FREE_COLUMNS.length}列。団体コード・事業・会計・年度を1行とする。法非適用も基本データに含み、組合等は原資料の団体コードで1回だけ収録する。構成市町村への配賦や現在の共同運営関係の遡及はしない。\n\n総務省・e-Stat「地方公営企業決算状況調査」（決算年度2020、カタログ年2021）を加工。政府が本データを作成・推奨したものではない。出典・位置はsources.csv、列の意味はcolumns.csvを参照。原資料利用条件：https://www.e-stat.go.jp/terms-of-use 。出典と加工した旨を明記して利用する。原資料の第三者権利は別途確認する。\n\n## 原値・計算式・公式Excelの照合\n1. input-values.csv は計算に使った原値を事業会計ごとに収録する。列末尾の [項目ID] を sources.csv の field と照合する。欠損記号は原資料どおり残す（算定用の主CSVでは空欄）。数式開始文字には安全のためアポストロフィを付ける。\n2. calculations.csv は主CSVの全列について、入力項目ID・算定式・対象条件・欠損と丸めの扱いを示す。派生項目は入力IDを同表でたどる。\n3. source-records.csv の同じ行識別子から、公式Excelのシート名・Excel行番号を確認する。「行番号」「列番号」は調査様式のコードであり、Excelの行・列位置とは別。原表では「列013」などの見出しを探す。\n4. sources.csv の sourceUrl から、抽出前の公式Excelを取得できる。sha256 は生成時に使用した原本のハッシュ。提供元による改訂があれば同一版とは限らない。公式Excelには公共下水道以外の行も含まれるため、年度2020・業種17・事業1・団体コード・施設コード・会計を照合する。\n5. 元資料は地方公営企業決算状況調査の原表で、自治体ごとの年鑑個表PDFそのものではない。出典先から取得する原本は本サイトでは改変しない。\n\n## CSVの開き方\nExcelの「データ→テキストまたはCSVから」でUTF-8を選択し、団体コード・都道府県コード・事業キーを文字列に指定する。直接開くと先頭ゼロが消えることがある。欠損は空欄、0は原資料の0。文字列の数式開始文字は無効化している。\n\n## 費目別の県内散布図\n1. 都道府県を1つ選び、「費用比較対象」が「対象」の行だけを使う。\n2. 例として「減価償却費：年額（千円/年）」が欠損でない行を選ぶ。0は残す。\n3. X軸＝年間有収水量（m³/年）÷1,000,000、Y軸＝当該費目の年額（千円/年）÷1,000とし、散布図を作る。単位は百万m³・百万円。\n4. 傾向線を付ける場合は切片を0に固定しない一次回帰。3点以上かつ水量の分散があるときだけ表示する。関係は因果を示さない。\n5. 県内中央値は同じ対象の「単位費用（円/m³）」のMEDIAN。自事業も含み、平均ではない。項目ごとの比較件数も確認する。対比棒グラフには自事業の単位費用と県内中央値を使う。\n\n## 金額の税区分\n家庭用20m³月額は両会計とも税込。その他の収入・費用は原表どおり、法適用は税抜、法非適用は税込で収録・算定する。法非適用の第26表2行69列（税抜収入）への置換や一律の税率換算は行わない。使用料単価・処理原価を会計区分をまたいで比較する場合は税区分の相違に注意する。費用比較の中央値は法適用だけで算定する。sources.csv の taxBasis と layoutUrl で確認できる。\n根拠：令和2年度地方公営企業決算状況調査表作成要領、法適用第32表（本文128頁）・法非適用（本文202～204頁）。https://www.e-stat.go.jp/stat-search/file-download?fileKind=2&statInfId=000032122192\n\n## 費用の範囲\n目的別（第20表）と性質別（第21表）は別の分類であり合算しない。業務費・総係費の合計列と個別列も重複加算しない。目的別の構成比の分母は営業費用、性質別は第21表費用合計、維持管理費・資本費は汚水処理費。維持管理費・資本費は法非適用にも収録するが、法適用の比較集計には含めない。第20/21表の費用は公費負担分を除いた汚水処理費と同一範囲とは限らない。\n\n家庭用20m³月額は第33表の公式値で、使用料単価×20ではない。2020単年で経年変化を推計しない。画面の2024年度・公共下水道/特環の比較とは年・母集団が異なる。現行の料金表として使わない。\n\n## 検証・版\n年度・識別・重複・出典結合・有限値を自動検証。原資料の全件手動照合ではない。項目別の欠損・母数と合計差はCSVに記録。データ版：${dataVersion}\n\nアンケート回答はCSVに含めず、Googleフォーム内で運営者が管理する。本CSVは無料で、note購入は不要。\n`
 };
 const previous=JSON.parse(await readFile(catalogFile,"utf8").catch(()=>"{}"));
 const manifest={schemaVersion:1,productId:FREE_ID,fiscalYear:2020,catalogYear:2021,dataVersion,generatedAt:previous.dataVersion===dataVersion?previous.generatedAt:new Date().toISOString(),rowCount:rows.length,columnCount:FREE_COLUMNS.length,legalCount:rows.filter(r=>r.accountingType==="法適用").length,nonLegalCount:rows.filter(r=>r.accountingType==="法非適用").length,eligibleCount:rows.filter(r=>r.comparisonEligible==="対象").length,costCount:FREE_COSTS.length,missingCounts:Object.fromEntries(FREE_COLUMNS.map(c=>[c.id,rows.filter(r=>r[c.id]==null).length])),codeHashes,sources,files:Object.entries(files).map(([name,s])=>({name,bytes:Buffer.byteLength(s),sha256:hash(s)}))};
 await mkdir(assetDir,{recursive:true});for(const [name,s] of Object.entries(files))await writeFile(path.join(assetDir,name),s);
 await writeFile(path.join(assetDir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
 await writeFile(catalogFile,JSON.stringify({...manifest,files:[...manifest.files,{name:"manifest.json",bytes:Buffer.byteLength(JSON.stringify(manifest,null,2)+"\n"),sha256:hash(JSON.stringify(manifest,null,2)+"\n")}]},null,2)+"\n");
 console.log(JSON.stringify({rows:rows.length,columns:FREE_COLUMNS.length,legal:manifest.legalCount,nonLegal:manifest.nonLegalCount,eligible:manifest.eligibleCount,dataVersion}));
}
