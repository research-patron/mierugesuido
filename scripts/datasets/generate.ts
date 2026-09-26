import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { buildDatasetEdition, datasetColumns, datasetCsv, datasetMetrics } from "@/lib/datasetEdition";
import type { DatasetProduct } from "@/lib/datasetProduct";

const root = process.cwd();
const publicOnly = process.argv.includes("--public-only");
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const read = (file: string) => readFile(path.join(root,file), "utf8");
const configText = await read("config/dataset-products.json");
const products = JSON.parse(configText) as DatasetProduct[];
const homeText = await read("data/static/home.json");
const provenance = JSON.parse(await read("data/static/source-provenance.json")).items;
const definitions = datasetCsv(["id","label","unit","definition"],datasetColumns);
const metadata: any[] = [];
const runTime = new Date().toISOString();
const previousCatalog: any[] = JSON.parse(await read("data/static/dataset-catalog.json").catch(()=>"[]"));
const sourceTermsUrl = "https://www.e-stat.go.jp/terms-of-use";
const sourceInputs = ["data/static/home.json", "data/static/data-sources.json", "data/static/source-provenance.json", "lib/comparison.ts", "lib/datasetEdition.ts", "lib/rankingDisplay.ts", "lib/rankings.ts", "lib/copy.ts", "scripts/datasets/generate.ts"];
for (const product of products) {
  try {
  if (!/^[a-z0-9-]+$/.test(product.slug) || !/^[a-z0-9-]+$/.test(product.productId)
    || !["draft","preview","published","retired"].includes(product.status)
    || !["17/1","17/4"].includes(product.businessType)
    || ![null,"legal_applied","non_legal_applied"].includes(product.accountingType)
    || product.rowUnit !== "municipality" || !Number.isInteger(product.fiscalYear)
    || !Number.isInteger(product.sampleSize) || product.sampleSize < 1 || product.sampleSize > 10
    || !Array.isArray(product.regions)) throw new Error("Invalid product configuration");
    const edition = buildDatasetEdition(JSON.parse(homeText),product);
    if (edition.rows.length <= product.sampleSize) throw new Error("Sample must be a strict subset of the product");
    const inputHashes: Record<string,string> = {};
    for (const file of sourceInputs) inputHashes[file] = digest(await read(file));
    const sources: Record<string,any>[] = [];
    for (const row of edition.rows) {
      const file = `public/data/static/municipalities/${row.municipalityCode}.json`;
      const detailText = await read(file); inputHashes[file] = digest(detailText);
      const detail = JSON.parse(detailText);
      const business = detail.businesses.find((b: any) => b.businessKey === row.businessKey && b.accountingType === row.accountingType);
      if (!business?.annualFinancials.some((annual: any) => annual.surveyYear === product.fiscalYear)) throw new Error("Product identity/year absent from detail");
      const evidenceCurrent = Math.max(...business.annualFinancials.map((annual: any) => annual.surveyYear)) === product.fiscalYear;
      const evidence = new Map<string, any>(business.evidenceEntries);
      for (const metric of datasetMetrics) for (const field of metric.sources) {
        const item = evidenceCurrent ? evidence.get(field) : null;
        const record = provenance.find((source: any) => source.sourceUrl === item?.sourceUrl);
        sources.push({ rowId: row.rowId, metricId: metric.id, sourceField: field, fiscalYear: row.fiscalYear,
          tableNo: item?.tableNo ?? null, tableName: item?.tableName ?? null,
          sourceUrl: item?.sourceUrl?.startsWith("https://") ? item.sourceUrl : null,
          catalogYear: record?.catalogYear ?? null, publishedAt: record?.publishedAt ?? null,
          acquiredAt: record?.downloadedAt ?? null, validation: "取込出典の対応・全件手動照合は未実施" });
      }
    }
    const dataVersion = digest(JSON.stringify({ schemaVersion:1, editorial:{title:product.title,licenseSummary:product.licenseSummary,correctionPolicy:product.correctionPolicy,newEditionPolicy:product.newEditionPolicy,contactUrl:product.contactUrl,corrections:product.corrections}, scope:{ fiscalYear:product.fiscalYear, regions:product.regions,businessType:product.businessType,accountingType:product.accountingType,rowUnit:product.rowUnit }, inputHashes }));
    const generatedAt = previousCatalog.find(entry=>entry.slug===product.slug && entry.dataVersion===dataVersion)?.generatedAt ?? runTime;
    const columns = datasetColumns.map(column=>column.id);
    const fullCsv = datasetCsv(columns,edition.rows);
    const sourceColumns = ["rowId","metricId","sourceField","fiscalYear","tableNo","tableName","sourceUrl","catalogYear","publishedAt","acquiredAt","validation"];
    const sampleIds = new Set(edition.sampleRows.map(row=>row.rowId));
    const sampleSources = sources.filter(row=>sampleIds.has(row.rowId));
    const conditions = `${product.fiscalYear}年度決算・${product.regions.join("、")||"全国"}・${product.businessType === "17/1" ? "公共下水道" : "特定環境保全公共下水道"}・${product.accountingType||"法適用／法非適用（参考）"}・自治体代表1事業`;
    const sourceMissing = sources.filter(row=>!row.sourceUrl).length;
    const commonReadme = `# ${product.title}\n\n条件: ${conditions}\nデータ版: ${dataVersion}\n生成日時: ${generatedAt}\n\n既存無料の自治体比較と同じ選定・集計です。流域下水道・組合等の独立した共同運営会計は対象外。自治体への財務額の配賦は行いません。母数は${edition.rows.length}自治体、経費回収率の有効値は${edition.summary.recoveryCount}自治体。平均は自治体値の単純平均です。\n\n家庭用料金の表ではありません。使用料単価×20で家庭用料金を作れません。欠損は空欄、0は0です。欠損理由の詳細を特定できない行は未収録・算定不可として扱い、非該当や非公表と推測しません。指標は画面と同じ保存値を用い、表示の丸めで再計算しません。\n\nCSVはUTF-8 BOM・CRLF・カンマ区切りです。自治体コードと事業キーは文字列列として取り込んでください。Excelで直接開くと先頭ゼロが失われる場合があります。文字列の数式開始文字には先頭にアポストロフィを付けています。数値・欠損・改行・二重引用符は保持します。\n\n公的出典: 総務省・地方公営企業決算状況調査（e-Stat）。各行の出典はsources.csvを参照。原資料を加工したもので政府による作成・推奨ではありません。利用条件: ${sourceTermsUrl} 。編集物の利用許諾: ${product.licenseSummary||"販売者による確認待ち（販売開始前）"}\n訂正: ${product.correctionPolicy||"販売者による確認待ち"}\n新版: ${product.newEditionPolicy||"販売者による確認待ち"}\n問い合わせ: ${product.contactUrl||"未設定"}\n\n検証は行識別、対象年度、重複、有限値、既存比較との整合です。原資料全件手動照合は未実施。出典URL未収録の対応行は${sourceMissing}件です。カタログ年・公表日・取得日は出典の取込記録で、公開反映日ではありません。\n`;
    const files: Record<string,string> = {
      "indicators.csv": fullCsv, "columns.csv": definitions, "sources.csv": datasetCsv(sourceColumns,sources),
      "README.md": commonReadme,
      "corrections.json": JSON.stringify(product.corrections,null,2)+"\n"
    };
    const fileSummaries = Object.entries(files).map(([name,body])=>({name,bytes:Buffer.byteLength(body),sha256:digest(body)}));
    const manifest = { productId:product.productId,dataVersion,schemaVersion:1,generatedAt,conditions,rowCount:edition.rows.length,columnCount:columns.length,
      missingCounts:edition.missingCounts,summary:edition.summary,sourceMissingCount:sourceMissing,sourceTermsUrl,
      validation:{identity:true,commonYear:true,finiteValues:true,duplicateAccounts:false,manualSourceReview:false},inputHashes,files:fileSummaries };
    files["manifest.json"]=JSON.stringify(manifest,null,2)+"\n";
    if (!publicOnly) {
      const privateRoot = path.join(root,"private-products",product.slug,dataVersion.slice(0,12));
      execFileSync("git",["check-ignore","--quiet","private-products/check"],{cwd:root});
      await mkdir(privateRoot,{recursive:true});
      for (const [name,body] of Object.entries(files)) await writeFile(path.join(privateRoot,name),body);
      execFileSync(process.env.PYTHON_BINARY||"python3",["scripts/datasets/package.py",privateRoot],{cwd:root});
    }
    const publicEntry = { productId:product.productId,slug:product.slug,dataVersion,schemaVersion:1,generatedAt,conditions,
      rowCount:edition.rows.length,columnCount:columns.length,missingCounts:edition.missingCounts,
      summary:{recoveryCount:edition.summary.recoveryCount,averageExpenseRecoveryRate:edition.summary.averageExpenseRecoveryRate},
      sampleRows:edition.sampleRows,sampleCount:edition.sampleRows.length,sourceMissingCount:sourceMissing,
      files:[...fileSummaries,{name:"manifest.json",bytes:Buffer.byteLength(files["manifest.json"]),sha256:digest(files["manifest.json"])}],
      filesReady:true,error:null };
    metadata.push(publicEntry);
    if (product.status !== "draft") {
      const directory = path.join(root,"public","samples",product.slug);
      await mkdir(directory,{recursive:true});
      for (const [name,body] of Object.entries({"sample.csv":datasetCsv(columns,edition.sampleRows),"columns.csv":definitions,"sources.csv":datasetCsv(sourceColumns,sampleSources),"README.md":`無料見本: 自治体コード順の先頭${edition.sampleRows.length}行。全国の代表標本ではありません。\n\n`+commonReadme,
        "manifest.json":JSON.stringify({productId:product.productId,dataVersion,schemaVersion:1,generatedAt,scope:conditions,sampleCount:edition.sampleRows.length,totalCount:edition.rows.length,selection:"自治体コード昇順の先頭行",missingCounts:edition.missingCounts},null,2)+"\n"})) await writeFile(path.join(directory,name),body);
    }
  } catch(error) {
    if (!publicOnly) throw error;
    // A failed product must not take unrelated free comparison pages offline.
    metadata.push({productId:product.productId,slug:product.slug,filesReady:false,error:"この版の生成・検証を完了できませんでした。無料比較は引き続き利用できます。"});
    console.warn(`Dataset withheld: ${product.productId}`);
  }
}
// Remove stale samples of draft, deleted, or failed products.
const sampleRoot=path.join(root,"public","samples");
const {rm}=await import("node:fs/promises");
for(const entry of await readdir(sampleRoot,{withFileTypes:true}).catch(()=>[])) {
 if(entry.isDirectory() && !products.some(p=>p.slug===entry.name && p.status!=="draft" && metadata.some(m=>m.slug===p.slug&&m.filesReady))) await rm(path.join(sampleRoot,entry.name),{recursive:true});
}
await mkdir(path.join(root,"data","static"),{recursive:true});
await writeFile(path.join(root,"data","static","dataset-catalog.json"),JSON.stringify(metadata,null,2)+"\n");
console.log(JSON.stringify(metadata.map(({slug,rowCount,sampleCount,dataVersion,filesReady})=>({slug,rowCount,sampleCount,dataVersion,filesReady}))));
